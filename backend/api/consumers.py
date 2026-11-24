import asyncio
import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .worker_status import WORKER_STATUS_GROUP, get_or_probe_worker_status, probe_worker_once


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


class WorkerStatusConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for pushing real-time Robot Worker availability and queue status.
    Route: ws/worker/status/
    """

    async def connect(self):
        self.group_name = None
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4403)
            return

        self.group_name = WORKER_STATUS_GROUP
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        payload = await asyncio.to_thread(get_or_probe_worker_status, False)
        await self.send(text_data=json.dumps({"type": "worker_status", **payload}))

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            msg = json.loads(text_data)
        except (ValueError, TypeError):
            return
        if isinstance(msg, dict) and msg.get("action") == "refresh":
            await asyncio.to_thread(probe_worker_once)

    async def worker_status_update(self, event):
        """
        Forward broadcasted worker status events to the WebSocket client.
        """
        await self.send(text_data=json.dumps({"type": "worker_status", **(event.get("data") or {})}))

