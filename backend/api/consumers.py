import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


@database_sync_to_async
def _can_access_job(user, job_id: int) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    from .models import CalculationJob
    return CalculationJob.objects.filter(id=job_id, user=user).exists()


class CalculationProgressConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for streaming real-time calculation progress
    from Windows Robot Worker -> Django -> Browser.
    Route: ws/calculations/<job_id>/
    """

    async def connect(self):
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        self.group_name = None

        user = self.scope.get("user")
        try:
            job_id_int = int(self.job_id)
        except (ValueError, TypeError):
            await self.close(code=4400)
            return

        if not await _can_access_job(user, job_id_int):
            await self.close(code=4403)
            return

        self.group_name = f"calc_{job_id_int}"

        # Join calculation group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

        # Send connection confirmation
        await self.send(text_data=json.dumps({
            "type": "connected",
            "job_id": job_id_int,
            "message": f"Connecté au canal de suivi du job #{job_id_int}"
        }))

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def calc_progress(self, event):
        """
        Receives broadcasted progress events and forwards them to the client.
        """
        await self.send(text_data=json.dumps(event.get("data", {})))

