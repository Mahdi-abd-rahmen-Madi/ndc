"""
Centralized, process-isolated LibreOffice PDF conversion helper.
Guarantees an isolated `-env:UserInstallation` profile per invocation so concurrent
conversions never collide on LibreOffice lock files, and cleans up temp profiles reliably.
"""
import logging
import os
import shutil
import subprocess
import tempfile
from typing import Iterable, List, Optional, Union

logger = logging.getLogger(__name__)


def _find_soffice_binary() -> str:
    return shutil.which("soffice") or shutil.which("libreoffice") or "libreoffice"


def convert_to_pdf(
    input_paths: Union[str, Iterable[str]],
    out_dir: str,
    timeout: int = 90,
) -> List[str]:
    """
    Convert one or more RTF/DOC/DOCX files to PDF in `out_dir` using an isolated
    headless LibreOffice instance. Returns list of expected output PDF paths that exist.
    Raises subprocess.TimeoutExpired / subprocess.CalledProcessError / FileNotFoundError on failure.
    """
    if isinstance(input_paths, str):
        paths = [input_paths]
    else:
        paths = [p for p in input_paths if p]

    if not paths:
        return []

    os.makedirs(out_dir, exist_ok=True)
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

