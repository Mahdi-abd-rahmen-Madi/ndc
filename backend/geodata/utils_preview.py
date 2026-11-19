import os
import logging
from django.conf import settings
from utils.libreoffice import convert_to_pdf
from utils.path_security import safe_resolve_under

logger = logging.getLogger(__name__)


def get_pdf_preview_path(relative_path):
    """
    Given a relative path under MEDIA_ROOT (e.g., catalogue/terrain/...),
    if it's a docx/doc, convert to pdf using isolated LibreOffice and return the new relative path.
    """
    full_path = safe_resolve_under(settings.MEDIA_ROOT, relative_path)
    if not full_path or not os.path.isfile(full_path):
        logger.warning("Preview: File not found or invalid path: %s", relative_path)
        return None

    safe_rel = os.path.relpath(full_path, settings.MEDIA_ROOT)
    if not full_path.lower().endswith(('.docx', '.doc')):
        return safe_rel

    pdf_path = os.path.splitext(full_path)[0] + '.pdf'
    pdf_relative = os.path.splitext(safe_rel)[0] + '.pdf'

    if not os.path.exists(pdf_path):
        outdir = os.path.dirname(full_path)
        try:
            logger.info("Preview: Converting %s to PDF...", full_path)
            convert_to_pdf(full_path, outdir, timeout=60)
        except Exception as e:
            logger.error("Preview: LibreOffice conversion failed for %s: %s", full_path, e)
            return None

    if not os.path.exists(pdf_path):
        logger.error("Preview: PDF file not created at %s", pdf_path)
        return None

    return pdf_relative
