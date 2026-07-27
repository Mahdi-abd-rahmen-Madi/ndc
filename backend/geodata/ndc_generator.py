import os
import uuid
import subprocess
from django.conf import settings
from docxtpl import DocxTemplate, InlineImage
from docx.shared import Mm

def generate_ndc_pdf(job, photo_url_or_path):
    """
    Generates a PDF from Template NDC_modified.docx using job calculation results.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(base_dir, 'data', 'Template NDC_modified.docx')
    
    if not os.path.exists(template_path):
        raise Exception(f"Template file not found at {template_path}")
        
    doc = DocxTemplate(template_path)
    
    context = {}
    
    # 1. Fill generic variables (var_1, var_2...) with some default or mapped values
    # For now we'll put some placeholders if job result_data doesn't map them perfectly
    # or if we need to parse them.
    result_data = job.result_data if job else {}
    input_data = job.input_data if job else {}
    
    # Fill generic variables var_1 to var_63 with visible dummy text if no job is provided
    if not job:
        for i in range(1, 64):
            context[f'var_{i}'] = f'[VAR_{i}]'
            
    # Site info and date mapping
    from datetime import datetime
    site_info = input_data.get('site', {})
    context['site_address'] = site_info.get('address', '[ADRESSE_DU_SITE]') if job else '[ADRESSE_DU_SITE]'
    context['site_name'] = site_info.get('name', '[NOM_DU_SITE]') if job else '[NOM_DU_SITE]'
    context['client_name'] = site_info.get('client', '[CLIENT]') if job else '[CLIENT]'
    context['current_date'] = datetime.now().strftime("%d/%m/%Y")
    
    # Insert Favorable/Defavorable logic
    context['avis_structure'] = result_data.get('avis_structure', '[AVIS_STRUCTURE]') if not job else result_data.get('avis_structure', 'Favorable')
    context['avis_deplacement'] = result_data.get('avis_deplacement', '[AVIS_DEPLACEMENT]') if not job else result_data.get('avis_deplacement', 'Favorable')
    context['avis_glissement'] = result_data.get('avis_glissement', '[AVIS_GLISSEMENT]') if not job else result_data.get('avis_glissement', 'Favorable')
    context['avis_renversement'] = result_data.get('avis_renversement', '[AVIS_RENVERSEMENT]') if not job else result_data.get('avis_renversement', 'Favorable')
    
    # Insert Photo
    # photo_url_or_path might be a URL like /media/uploads/...
    # We need to get the absolute path
    if photo_url_or_path.startswith(settings.MEDIA_URL):
        photo_rel = photo_url_or_path[len(settings.MEDIA_URL):]
        photo_abs = os.path.join(settings.MEDIA_ROOT, photo_rel)
    else:
        photo_abs = photo_url_or_path
        
    if os.path.exists(photo_abs):
        # Add InlineImage to context
        context['photo_img'] = InlineImage(doc, photo_abs, width=Mm(150))
    else:
        context['photo_img'] = ''
        
    doc.render(context)
    
    # Save the populated docx temporarily
    job_id_str = job.id if job else "preview"
    output_filename = f"NDC_{job_id_str}_{uuid.uuid4().hex[:8]}"
    outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
    os.makedirs(outdir, exist_ok=True)
    
    output_docx_path = os.path.join(outdir, f"{output_filename}.docx")
    doc.save(output_docx_path)
    
    # Convert to PDF
    cmd = [
        'libreoffice',
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        outdir,
        output_docx_path
    ]
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
    except subprocess.CalledProcessError as e:
        raise Exception(f"LibreOffice conversion failed: {e.stderr.decode()}")
        
    pdf_path = os.path.join(outdir, f"{output_filename}.pdf")
    if not os.path.exists(pdf_path):
        raise Exception("PDF file was not generated.")
        
    # Return the relative URL of the generated PDF
    pdf_url = settings.MEDIA_URL + f"uploads/{output_filename}.pdf"
    return pdf_url
