import logging
import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from utils.ws_hub import publish_ws_event

logger = logging.getLogger(__name__)

WORKER_STATUS_CACHE_KEY = "robot_worker_live_status"
WORKER_STATUS_GROUP = "worker_status"

_AVAILABLE_STATES = {"IDLE", "AVAILABLE", "READY", "ONLINE"}
_BUSY_STATES = {"BUSY", "RUNNING", "PROCESSING", "WORKING"}
_OFFLINE_STATES = {"OFFLINE", "DOWN", "STOPPED", "UNREACHABLE"}


def normalize_worker_state(raw_status: str | None, current_job_id=None) -> str:
    """
    Normalize raw worker status strings into: 'available' | 'busy' | 'offline'.
    """
    token = str(raw_status or "").strip().upper()
    if token in _OFFLINE_STATES:
        return "offline"
    if token in _BUSY_STATES:
        return "busy"
    if token in _AVAILABLE_STATES:
        return "busy" if current_job_id else "available"
    return "busy" if current_job_id else "available"


def build_status_payload(
    state: str,
    queue_size: int = 0,
    current_job_type: str | None = None,
    source: str = "worker",
) -> dict:
    """
    Build a sanitized status dictionary safe to expose to authenticated clients.
    """
    try:
        parsed_queue = max(0, int(queue_size or 0))
    except (TypeError, ValueError):
        parsed_queue = 0

    active_jobs = 1 if state == "busy" else 0
    safe_queue = parsed_queue if state != "offline" else 0
    total_ahead = (active_jobs + safe_queue) if state != "offline" else 0

    return {
        "state": state,
        "active_jobs": active_jobs,
        "queue_size": safe_queue,
        "total_ahead": total_ahead,
        "current_job_type": current_job_type if state == "busy" else None,
        "source": source,
        "updated_at": timezone.now().isoformat(),
    }


def broadcast_worker_status(payload: dict) -> None:
    """
    Broadcast a worker status snapshot to all WebSocket subscribers.
    """
    publish_ws_event(
        WORKER_STATUS_GROUP,
        {"type": "worker_status", **payload},
        channel_event={"type": "worker_status_update", "data": payload},
    )


def set_worker_status(
    raw_status: str | None,
    queue_size: int = 0,
    current_job_type: str | None = None,
    source: str = "worker",
    current_job_id=None,
) -> dict:
    """
    Normalize, persist in cache indefinitely, and broadcast a worker status update.
    """
    state = normalize_worker_state(raw_status, current_job_id=current_job_id)
    payload = build_status_payload(
        state=state,
        queue_size=queue_size,
        current_job_type=current_job_type,
        source=source,
    )
    cache.set(WORKER_STATUS_CACHE_KEY, payload, timeout=None)
    broadcast_worker_status(payload)
    return payload


def get_cached_worker_status() -> dict | None:
    """Return cached worker status if present, else None."""
    return cache.get(WORKER_STATUS_CACHE_KEY)


def probe_worker_once(timeout: float = 2.5) -> dict:
    """
    Perform a single synchronous check against ROBOT_WORKER_STATUS_URL and update cache/WS.
    Used only on cold start (empty cache) or manual refresh — never on a polling loop.
    """
    status_url = getattr(
        settings,
        "ROBOT_WORKER_STATUS_URL",
        f"{getattr(settings, 'WORKER_BASE_URL', 'http://100.97.172.27:8001').rstrip('/')}/api/status",
    )
    try:
        resp = requests.get(status_url, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json() if resp.content else {}
            if not isinstance(data, dict):
                data = {}
            return set_worker_status(
                data.get("status"),
                queue_size=data.get("queue_size", 0),
                current_job_type=data.get("current_job_type"),
                source="probe",
                current_job_id=data.get("current_job_id"),
            )
        logger.warning("Worker status probe returned HTTP %s from %s", resp.status_code, status_url)
    except (requests.exceptions.RequestException, ValueError) as exc:
        logger.warning("Worker status probe failed (%s): %s", status_url, exc)

    return set_worker_status("OFFLINE", queue_size=0, source="probe")


def get_or_probe_worker_status(force_probe: bool = False) -> dict:
    """
    Return the cached worker status unless empty or force_probe is requested.
    """
    if not force_probe:
        cached = get_cached_worker_status()
        if isinstance(cached, dict) and cached.get("state") in ("available", "busy", "offline"):
            return cached
    return probe_worker_once()
