import json
from channels.generic.websocket import AsyncWebsocketConsumer

class CalculationProgressConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for streaming real-time calculation progress
    from Windows Robot Worker -> Django -> Browser.
    Route: ws/calculations/<job_id>/
    """

    async def connect(self):
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        self.group_name = f"calc_{self.job_id}"

        # Join calculation group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

        # Send connection confirmation
        await self.send(text_data=json.dumps({
            "type": "connected",
            "job_id": int(self.job_id),
            "message": f"Connecté au canal de suivi du job #{self.job_id}"
        }))

    async def disconnect(self, close_code):
        # Leave calculation group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def calc_progress(self, event):
        """
        Receives broadcasted progress events and forwards them to the client.
        """
        await self.send(text_data=json.dumps(event.get("data", {})))

