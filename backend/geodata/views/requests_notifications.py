"""Height calculation requests & real-time notification ViewSets."""
import hashlib

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.models import User as AuthUser
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from api.permissions import IsAdminOrEngineerPermission
from geodata.models import HeightCalculationRequest, Notification
from geodata.serializers import (
    HeightCalculationRequestAdminSerializer,
    HeightCalculationRequestSerializer,
    NotificationSerializer,
)


def send_ws_notification(email: str, notification_data: dict):
    """Send a WebSocket notification to a specific email's channel group."""
    channel_layer = get_channel_layer()
    email_hash = hashlib.md5(email.encode()).hexdigest()
    group_name = f'notifications_{email_hash}'

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'send_notification',
            'notification': notification_data,
        },
    )


class HeightCalculationRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for managing height calculation requests."""

    queryset = HeightCalculationRequest.objects.select_related(
        'requester_user', 'assigned_to', 'completed_equipment'
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'region', 'montage_type']
    search_fields = ['requester_name', 'requester_email', 'address', 'montage_type']
    ordering_fields = ['created_at', 'updated_at', 'status']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['create', 'my_requests']:
            self.permission_classes = [permissions.AllowAny]
        else:
            self.permission_classes = [IsAdminOrEngineerPermission]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return HeightCalculationRequestSerializer
        return HeightCalculationRequestAdminSerializer

    def perform_create(self, serializer):
        """Create a height calculation request and batch-notify génie civil staff."""
        instance = serializer.save()

        staff_users = list(AuthUser.objects.filter(is_staff=True))
        if not staff_users:
            return

        notifications = [
            Notification(
                recipient_email=staff.email,
                recipient_user=staff,
                title='Nouvelle demande de calcul',
                message=f"{instance.requester_name} a demandé un calcul pour une hauteur de {instance.requested_building_height}m (Montage {instance.montage_type})",
                notification_type='request_received',
                related_request=instance,
            )
            for staff in staff_users
        ]
        Notification.objects.bulk_create(notifications)

        payload = {
            'id': instance.id,
            'type': 'request_received',
            'title': 'Nouvelle demande de calcul',
            'message': f"{instance.requester_name} a demandé un calcul pour une hauteur de {instance.requested_building_height}m",
            'request_id': instance.id,
        }
        for staff in staff_users:
            if not staff.email:
                continue
            try:
                send_ws_notification(staff.email, payload)
            except Exception:
                pass

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update the status of a request and notify the requester."""
        height_request = self.get_object()
        new_status = request.data.get('status')
        admin_notes = request.data.get('admin_notes', '')

        if new_status not in dict(HeightCalculationRequest.STATUS_CHOICES):
            return Response({'error': f'Statut invalide : {new_status}'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = height_request.status
        height_request.status = new_status
        if admin_notes:
            height_request.admin_notes = admin_notes
        if request.user.is_authenticated:
            height_request.assigned_to = request.user
        height_request.save()

        status_messages = {
            'in_progress': (
                'request_in_progress',
                'Demande en cours de traitement',
                f'Votre demande de calcul pour {height_request.requested_building_height}m est maintenant en cours de traitement.',
            ),
            'completed': (
                'request_completed',
                'Demande terminée',
                f'Les calculs pour la hauteur {height_request.requested_building_height}m sont maintenant disponibles !',
            ),
            'rejected': (
                'request_rejected',
                'Demande rejetée',
                f'Votre demande de calcul pour {height_request.requested_building_height}m a été rejetée. {admin_notes}',
            ),
        }

        if new_status in status_messages and new_status != old_status:
            notif_type, title, message = status_messages[new_status]
            notif = Notification.objects.create(
                recipient_email=height_request.requester_email,
                recipient_user=height_request.requester_user,
                title=title,
                message=message,
                notification_type=notif_type,
                related_request=height_request,
            )

            try:
                send_ws_notification(height_request.requester_email, {
                    'id': notif.id,
                    'type': notif_type,
                    'title': title,
                    'message': message,
                    'request_id': height_request.id,
                    'new_status': new_status,
                })
            except Exception:
                pass

        serializer = HeightCalculationRequestAdminSerializer(height_request)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def my_requests(self, request):
        email = request.query_params.get('email')
        if not email:
            return Response({'error': 'Le paramètre email est requis'}, status=status.HTTP_400_BAD_REQUEST)
        requests_qs = HeightCalculationRequest.objects.filter(requester_email=email)
        serializer = HeightCalculationRequestSerializer(requests_qs, many=True)
        return Response(serializer.data)


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing notifications (scoped to authenticated user)."""

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post']

    def _user_emails(self):
        user = self.request.user
        return [e for e in {user.email, user.username} if e]

    def get_queryset(self):
        user = self.request.user
        email = self.request.query_params.get('email')
        if user.is_staff or user.is_superuser:
            if email:
                return Notification.objects.filter(recipient_email=email)
            return Notification.objects.all()
        return Notification.objects.filter(
            Q(recipient_user=user) | Q(recipient_email__in=self._user_emails())
        )

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'status': 'Notification marquée comme lue'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': f'{count} notifications marquées comme lues'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

