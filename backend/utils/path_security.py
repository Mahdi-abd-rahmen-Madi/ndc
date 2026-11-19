import os
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlparse

from django.conf import settings


def safe_resolve_under(base_dir: str, relative_path: str) -> Optional[str]:
    """
    Resolve `relative_path` under `base_dir` and return the canonical absolute path
    only if it stays strictly inside `base_dir`. Returns None on traversal or invalid input.
    """
    if not base_dir or not relative_path:
        return None
    cleaned = unquote(str(relative_path)).strip()
    if not cleaned or os.path.isabs(cleaned):
        return None
    try:
        base = Path(base_dir).resolve()
        candidate = (base / cleaned).resolve()
        if candidate == base or base in candidate.parents:
            return str(candidate)
    except (OSError, ValueError):
        return None
    return None


def safe_media_path(url_or_path: Optional[str]) -> Optional[str]:
    """
    Resolve a media URL (`/media/...` or full `http(s)://.../media/...`) or
    relative media path to a canonical path inside `settings.MEDIA_ROOT`.
    Returns None if the path escapes `MEDIA_ROOT`.
    """
    if not url_or_path:
        return None
    raw = unquote(str(url_or_path)).strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    path = parsed.path if parsed.scheme in ("http", "https") else raw

    media_url = getattr(settings, "MEDIA_URL", "/media/")
    if path.startswith(media_url):
        rel = path[len(media_url):]
        return safe_resolve_under(settings.MEDIA_ROOT, rel)

    # Allow already-absolute paths only if they resolve inside MEDIA_ROOT
    if os.path.isabs(path):
        try:
            base = Path(settings.MEDIA_ROOT).resolve()
            candidate = Path(path).resolve()
            if base in candidate.parents:
                return str(candidate)
        except (OSError, ValueError):
            return None
        return None

    return safe_resolve_under(settings.MEDIA_ROOT, path)
