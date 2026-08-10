import os
import uuid
import urllib.parse
from datetime import datetime
from django.conf import settings
from django.template.loader import render_to_string
from weasyprint import HTML

def generate_ndc_pdf(job, photo_url_or_path, preview_data=None):
    """
    Generates a PDF from HTML templates using WeasyPrint based on job calculation results.
    """
    context = {}
    
    result_data = job.result_data if job else {}
    input_data = job.input_data if job else {}
    
    # Fill generic variables var_1 to var_63 with visible dummy text if no job is provided
    if not job:
        for i in range(1, 64):
            context[f'var_{i}'] = f'[VAR_{i}]'
            
    # Site info and date mapping
    site_info = input_data.get('site', {})
    if not job and preview_data:
        site_info = preview_data.get('site', {})

    context['site_address'] = site_info.get('address') or '[ADRESSE_DU_SITE]'
    context['site_name'] = site_info.get('name') or '[NOM_DU_SITE]'
    context['client_name'] = site_info.get('client') or '[CLIENT]'
    context['current_date'] = datetime.now().strftime("%d/%m/%Y")
    
    # -----------------------------
    # Page 3 Variables Mapping
    # -----------------------------
    active_data = input_data if job else (preview_data or {})
    
    import re
    structure_data = active_data.get('structure', {})

    # Helper for regex extraction
    def parse_dimensions(section_str):
        if section_str:
            match = re.search(r'(\d+)\s*[xX]\s*(\d+)', section_str)
            if match:
                return match.group(1), match.group(2)
        return None, None

    # Mât Principal (4G)
    mat_principal_str = structure_data.get('mat_principal') or ''
    diam_4g, epaisseur_4g = parse_dimensions(mat_principal_str)
    
    context['mat_4g_diam'] = diam_4g or '[DIAM_4G]'
    context['mat_4g_epaisseur'] = epaisseur_4g or '[EPAISSEUR_4G]'
    
    # 4G Mast Length (mast_height_m * 1000)
    mast_height_m = structure_data.get('mast_height_m') or structure_data.get('hauteur_mat_m')
    if mast_height_m:
        try:
            context['mat_4g_longueur'] = int(float(mast_height_m) * 1000)
        except (ValueError, TypeError):
            context['mat_4g_longueur'] = '[LONGUEUR_4G]'
    else:
        context['mat_4g_longueur'] = '[LONGUEUR_4G]'

    # Mât 5G (Secondaire)
    mat_secondaire_str = structure_data.get('mat_secondaire') or ''
    diam_5g, epaisseur_5g = parse_dimensions(mat_secondaire_str)
    
    context['mat_5g_diam'] = diam_5g or '[DIAM_5G]'
    context['mat_5g_epaisseur'] = epaisseur_5g or '[EPAISSEUR_5G]'
    context['mat_5g_longueur'] = 1000  # Hardcoded to 1000mm (1.0m) as in robot_worker.py

    # Bras de déport (parsed from raw string via Regex)
    bras_str = structure_data.get('bras_de_deport') or 'TCAR 50x5'
    diam_bras, epaisseur_bras = parse_dimensions(bras_str)
            
    context['bras_deport_diam'] = diam_bras or '[DIAM_BRAS]'
    context['bras_deport_epaisseur'] = epaisseur_bras or '[EPAISSEUR_BRAS]'
    context['bras_deport_longueur'] = 300 # Standardized to 300mm (0.3m) as in robot_worker.py

    # Plot Métallique
    plot_str = structure_data.get('plot_metallique') or ''
    diam_plot, epaisseur_plot = parse_dimensions(plot_str)
    context['plot_diam'] = diam_plot or '[PLOT_DIAM]'
    context['plot_epaisseur'] = epaisseur_plot or '[PLOT_EPAISSEUR]'

    # 4G Antenna info
    antenna_4g = active_data.get('antenna_4g', {})
    a4g_w = antenna_4g.get('largeur_mm') or antenna_4g.get('width_mm')
    a4g_h = antenna_4g.get('hauteur_mm') or antenna_4g.get('height_mm')
    a4g_t = antenna_4g.get('epaisseur_mm') or antenna_4g.get('thickness_mm')
    if a4g_h and a4g_w and a4g_t:
        context['ant_4g_dims'] = f"{int(float(a4g_h))}x{int(float(a4g_w))}x{int(float(a4g_t))}"
    else:
        context['ant_4g_dims'] = '[ANT_4G_DIMS]'
    context['ant_4g_weight'] = antenna_4g.get('poids_kg') or antenna_4g.get('weight_dan') or '[ANT_4G_WEIGHT]'

    # 5G Antenna info
    antenna_5g = active_data.get('antenna_5g', {})
    a5g_w = antenna_5g.get('largeur_mm') or antenna_5g.get('width_mm')
    a5g_h = antenna_5g.get('hauteur_mm') or antenna_5g.get('height_mm')
    a5g_t = antenna_5g.get('epaisseur_mm') or antenna_5g.get('thickness_mm')
    if a5g_h and a5g_w and a5g_t:
        context['ant_5g_dims'] = f"{int(float(a5g_h))}x{int(float(a5g_w))}x{int(float(a5g_t))}"
    else:
        context['ant_5g_dims'] = '[ANT_5G_DIMS]'
    context['ant_5g_weight'] = antenna_5g.get('poids_kg') or antenna_5g.get('weight_dan') or '[ANT_5G_WEIGHT]'
    
    # 5G Mast HBA (from robot_worker.py: hauteur_mat_m + 0.2)
    if mast_height_m:
        try:
            context['ant_5g_hba'] = round(float(mast_height_m) + 0.2, 2)
        except (ValueError, TypeError):
            context['ant_5g_hba'] = '[ANT_5G_HBA]'
    else:
        context['ant_5g_hba'] = '[ANT_5G_HBA]'
    
    # Hauteur mat m (for page 4 and 5)
    context['hauteur_mat_m'] = '[HAUTEUR_MAT_M]' if mast_height_m is None else mast_height_m

    # Environment
    env = active_data.get('environment', {})
    region_data = env.get('region')
    
    if isinstance(region_data, dict):
        region_num = region_data.get('number')
        region_name = region_data.get('name')
    else:
        try:
            region_num = int(str(region_data).replace('Region ', '').strip())
            region_name = f"Region {region_num}"
        except (ValueError, TypeError):
            region_num = None
            region_name = str(region_data) if region_data else '[REGION_VENT]'

    context['region_vent'] = region_name
    context['categorie_terrain'] = env.get('terrain_type') or '[CATEGORIE_TERRAIN]'
    context['hauteur_m'] = env.get('building_height_m') or '[HAUTEUR_M]'
    context['plot_height_m'] = env.get('plot_height_m') or '[PLOT_HEIGHT_M]'

    # Static Vb mapping
    vb_map = {1: 22, 2: 24, 3: 26, 4: 28}
    context['vb_m_s'] = vb_map.get(region_num, '[Vb_m/s]')
    
    # Client Logo
    client_logo_url = site_info.get('client_logo_url')
    print(f"Debug NDC Generator: client_logo_url is {client_logo_url}")
    if client_logo_url:
        from urllib.parse import urlparse, unquote
        client_logo_url = unquote(client_logo_url)
        parsed_url = urlparse(client_logo_url)
        path = parsed_url.path
        
        # Resolve from MEDIA_URL (usually /media/...) to MEDIA_ROOT
        if path.startswith(settings.MEDIA_URL):
            relative_path = path[len(settings.MEDIA_URL):]
            client_logo_abs = os.path.join(settings.MEDIA_ROOT, relative_path)
            print(f"Debug NDC Generator: resolving relative path {relative_path} to {client_logo_abs}, exists={os.path.exists(client_logo_abs)}")
            if os.path.exists(client_logo_abs):
                context['client_logo_abs'] = client_logo_abs
            else:
                context['client_logo_abs'] = None
        else:
            print(f"Debug NDC Generator: path {path} doesn't start with MEDIA_URL {settings.MEDIA_URL}")
            context['client_logo_abs'] = None
    else:
        context['client_logo_abs'] = None
    
    # Resolve Photo Path
    photo_url_or_path = urllib.parse.unquote(photo_url_or_path)

    if photo_url_or_path.startswith(settings.MEDIA_URL):
        photo_rel = photo_url_or_path[len(settings.MEDIA_URL):]
        photo_abs = os.path.join(settings.MEDIA_ROOT, photo_rel)
    else:
        photo_abs = photo_url_or_path
        
    if os.path.exists(photo_abs):
        context['photo_abs'] = photo_abs
    else:
        context['photo_abs'] = None
        
    # Robot Screenshot Path
    if job and job.screenshot:
        screenshot_path = job.screenshot.path
        if os.path.exists(screenshot_path):
            context['robot_screenshot_abs'] = screenshot_path
        else:
            context['robot_screenshot_abs'] = None
    else:
        context['robot_screenshot_abs'] = None
        
    # Logo Path
    logo_path = os.path.join(settings.MEDIA_ROOT, 'uploads', 'logo_cometa.png')
    context['logo_abs'] = logo_path if os.path.exists(logo_path) else None
        
    # Render HTML template
    html_string = render_to_string('ndc/base.html', context)
    
    job_id_str = job.id if job else "preview"
    output_filename = f"NDC_{job_id_str}_{uuid.uuid4().hex[:8]}"
    outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
    os.makedirs(outdir, exist_ok=True)
    
    pdf_path = os.path.join(outdir, f"{output_filename}.pdf")
    
    # Generate PDF using WeasyPrint
    # Note: base_url is required for loading local resources like images
    html = HTML(string=html_string, base_url=f"file://{settings.MEDIA_ROOT}")
    html.write_pdf(pdf_path)
    
    if not os.path.exists(pdf_path):
        raise Exception("PDF file was not generated.")
        
    # Return the relative URL of the generated PDF
    pdf_url = settings.MEDIA_URL + f"uploads/{output_filename}.pdf"
    return pdf_url

def generate_ndc_pdf_task(job_id, photo_url_or_path):
    from api.models import CalculationJob
    try:
        job = CalculationJob.objects.get(id=job_id)
        pdf_url = generate_ndc_pdf(job, photo_url_or_path)
        # Assuming the job has a pdf_url field, or we store it in result_data
        if not isinstance(job.result_data, dict):
            job.result_data = {}
        job.result_data['ndc_pdf_url'] = pdf_url
        job.save()
        return pdf_url
    except CalculationJob.DoesNotExist:
        print(f"Job {job_id} not found for PDF generation")
        return None
