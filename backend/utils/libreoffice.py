"""
Centralized, process-isolated PDF conversion helper.
Uses Gotenberg over pooled HTTP when `GOTENBERG_URL` is configured (avoiding
cold-start LibreOffice RAM spikes per conversion), and falls back to an isolated
`-env:UserInstallation` headless LibreOffice subprocess in local dev/tests.
"""
import logging
import os
import shutil
import subprocess
import tempfile
from typing import Iterable, List, Union

import requests
from requests.adapters import HTTPAdapter

logger = logging.getLogger(__name__)

_GOTENBERG_SESSION = requests.Session()
_GOTENBERG_ADAPTER = HTTPAdapter(pool_connections=4, pool_maxsize=8)
_GOTENBERG_SESSION.mount("http://", _GOTENBERG_ADAPTER)
_GOTENBERG_SESSION.mount("https://", _GOTENBERG_ADAPTER)


def _get_gotenberg_url() -> str:
    env_val = (os.environ.get("GOTENBERG_URL", "") or "").strip().rstrip("/")
    if env_val:
        return env_val
    try:
        from django.conf import settings
        if settings.configured:
            return (getattr(settings, "GOTENBERG_URL", "") or "").strip().rstrip("/")
    except Exception:
        pass
    return ""


def _find_soffice_binary() -> str:
    return shutil.which("soffice") or shutil.which("libreoffice") or "libreoffice"


def _convert_via_gotenberg(paths: List[str], out_dir: str, gotenberg_url: str, timeout: int) -> List[str]:
    endpoint = f"{gotenberg_url}/forms/libreoffice/convert"
    produced: List[str] = []
    for src in paths:
        if not os.path.isfile(src):
            continue
        stem = os.path.splitext(os.path.basename(src))[0]
        pdf_path = os.path.join(out_dir, f"{stem}.pdf")
        with open(src, "rb") as fh:
            resp = _GOTENBERG_SESSION.post(
                endpoint,
                files={"files": (os.path.basename(src), fh)},
                timeout=timeout,
            )
        resp.raise_for_status()
        with open(pdf_path, "wb") as out_fh:
            out_fh.write(resp.content)
        produced.append(pdf_path)
    return produced


def convert_to_pdf(
    input_paths: Union[str, Iterable[str]],
    out_dir: str,
    timeout: int = 90,
) -> List[str]:
    """
    Convert one or more RTF/DOC/DOCX files to PDF in `out_dir`.
    Routes to Gotenberg when GOTENBERG_URL is configured; otherwise spawns an
    isolated headless LibreOffice instance. Returns list of produced PDF paths.
    """
    if isinstance(input_paths, str):
        paths = [input_paths]
    else:
        paths = [p for p in input_paths if p]

    if not paths:
        return []

    os.makedirs(out_dir, exist_ok=True)

    gotenberg_url = _get_gotenberg_url()
    if gotenberg_url:
        return _convert_via_gotenberg(paths, out_dir, gotenberg_url, timeout=timeout)

    profile_dir = tempfile.mkdtemp(prefix="lo_profile_")
    binary = _find_soffice_binary()
    cmd = [
        binary,
        f"-env:UserInstallation=file://{profile_dir}",
        "--headless",
        "--invisible",
        "--nocrashreport",
        "--nodefault",
        "--nofirststartwizard",
        "--nologo",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        out_dir,
    ] + paths

    try:
        subprocess.run(cmd, check=True, timeout=timeout, capture_output=True)
        produced = []
        for src in paths:
            stem = os.path.splitext(os.path.basename(src))[0]
            pdf_path = os.path.join(out_dir, f"{stem}.pdf")
            if os.path.exists(pdf_path):
                produced.append(pdf_path)
        return produced
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)
