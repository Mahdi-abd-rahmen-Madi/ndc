from django.urls import re_path
from . import consumers
from api.consumers import CalculationProgressConsumer

websocket_urlpatterns = [
    re_path(r'ws/notifications/(?P<email>[^/]+)/$', consumers.NotificationConsumer.as_asgi()),
    re_path(r'ws/calculations/(?P<job_id>\d+)/$', CalculationProgressConsumer.as_asgi()),
]
