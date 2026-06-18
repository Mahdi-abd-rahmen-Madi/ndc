import os
import subprocess
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def get_pdf_preview_path(relative_path):
    """
    Given a relative path (e.g., catalogue/terrain/...),
    if it's a docx, convert to pdf using libreoffice and return the new relative path.
    """
    full_path = os.path.join(settings.MEDIA_ROOT, relative_path)
    if not os.path.exists(full_path):
        logger.warning(f"Preview: File not found: {full_path}")
        return None
    
    if not full_path.lower().endswith('.docx') and not full_path.lower().endswith('.doc'):
        return relative_path
        
    pdf_path = os.path.splitext(full_path)[0] + '.pdf'
    pdf_relative = os.path.splitext(relative_path)[0] + '.pdf'
    
    if not os.path.exists(pdf_path):
        outdir = os.path.dirname(full_path)
        cmd = [
            'libreoffice',
            '--headless',
            '--convert-to',
            'pdf',
            '--outdir',
            outdir,
            full_path
        ]
        try:
            logger.info(f"Preview: Converting {full_path} to PDF...")
            result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            logger.info(f"Preview: Conversion successful. Output: {result.stdout.decode()}")
        except subprocess.TimeoutExpired:
            logger.error(f"Preview: LibreOffice conversion timed out for {full_path}")
            return None
        except subprocess.CalledProcessError as e:
            logger.error(f"Preview: LibreOffice conversion failed for {full_path}: {e.stderr.decode()}")
            return None
    
    if not os.path.exists(pdf_path):
        logger.error(f"Preview: PDF file not created at {pdf_path}")
        return None
            
    return pdf_relative

