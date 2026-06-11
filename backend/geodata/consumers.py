import json
import hashlib
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time notifications"""

    async def connect(self):
        self.email = self.scope['url_route']['kwargs']['email']
        # Create a safe group name from email
        email_hash = hashlib.md5(self.email.encode()).hexdigest()
        self.group_name = f'notifications_{email_hash}'

        # Join the notification group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

        # Send a connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connecté aux notifications en temps réel'
        }))

    async def disconnect(self, close_code):
        # Leave the notification group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        """Handle incoming messages from the client (e.g., mark as read)"""
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')

            if msg_type == 'mark_read':
                notification_id = data.get('notification_id')
                if notification_id:
                    from .models import Notification
                    from channels.db import database_sync_to_async

                    @database_sync_to_async
                    def mark_notification_read(nid, email):
                        try:
                            notif = Notification.objects.get(id=nid, recipient_email=email)
                            notif.is_read = True
                            notif.save()
                            return True
                        except Notification.DoesNotExist:
                            return False

                    success = await mark_notification_read(notification_id, self.email)
                    await self.send(text_data=json.dumps({
                        'type': 'read_confirmed',
                        'notification_id': notification_id,
                        'success': success
                    }))

        except json.JSONDecodeError:
            pass

    # Handler for notification messages sent to the group
    async def send_notification(self, event):
        """Send notification to WebSocket client"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification': event['notification']
        }))
