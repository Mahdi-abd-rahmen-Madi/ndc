import os
import subprocess
from django.conf import settings

def get_pdf_preview_path(relative_path):
    """
    Given a relative path (e.g., catalogue/terrain/...),
    if it's a docx, convert to pdf using libreoffice and return the new relative path.
    """
    full_path = os.path.join(settings.MEDIA_ROOT, relative_path)
    if not os.path.exists(full_path):
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
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError:
            return None
            
    return pdf_relative
