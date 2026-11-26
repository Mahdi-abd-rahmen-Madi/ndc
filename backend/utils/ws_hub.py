"""
Unified WebSocket event broadcaster.
Routes real-time events to the Go `ws-hub` microservice over pooled HTTP POST
when `WS_HUB_URL` is configured (enabling multi-worker WSGI Gunicorn + qcluster
without Redis), falling back to Django Channels `channel_layer.group_send` in
local development / unit tests.
"""
import logging
import requests
from requests.adapters import HTTPAdapter
from django.conf import settings

logger = logging.getLogger(__name__)

_HUB_SESSION = requests.Session()
_HUB_ADAPTER = HTTPAdapter(pool_connections=8, pool_maxsize=16)
_HUB_SESSION.mount("http://", _HUB_ADAPTER)
_HUB_SESSION.mount("https://", _HUB_ADAPTER)


def publish_ws_event(group: str, payload: dict, channel_event: dict | None = None) -> bool:
    """
    Publish a real-time JSON payload to a WebSocket group.

    Args:
        group: Target group name (e.g. 'calc_42', 'worker_status', 'notifications_<md5>').
        payload: Exact JSON object sent to browser WebSocket clients by ws-hub.
        channel_event: Optional Django Channels event dict for local InMemoryChannelLayer fallback.
    """
    ws_hub_url = (getattr(settings, "WS_HUB_URL", "") or "").strip().rstrip("/")
    if ws_hub_url:
        headers = {}
        secret = getattr(settings, "WS_HUB_SECRET", "") or ""
        if secret:
            headers["X-Hub-Secret"] = secret
        try:
            resp = _HUB_SESSION.post(
                f"{ws_hub_url}/internal/publish",
                json={"group": group, "payload": payload},
                headers=headers,
                timeout=1.5,
            )
            if resp.status_code < 400:
                return True
            logger.warning("ws-hub publish HTTP %s for group=%s", resp.status_code, group)
            return False
        except requests.exceptions.RequestException as exc:
            logger.warning("ws-hub publish failed for group=%s: %s", group, exc)
            return False

    if channel_event is None:
        return False

    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(group, channel_event)
            return True
    except Exception as exc:
        logger.warning("Channels fallback broadcast failed for group=%s: %s", group, exc)
    return False
