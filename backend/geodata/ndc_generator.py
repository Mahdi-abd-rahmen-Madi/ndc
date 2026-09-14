import os
import math
import uuid
import urllib.parse
from datetime import datetime
from django.conf import settings
from django.template.loader import render_to_string
from weasyprint import HTML

# ---------------------------------------------------------------------------
# EC1 Wind Calculation (EN 1991-1-4)
# ---------------------------------------------------------------------------

# z₀ roughness lengths and z_min per terrain category
# Keys match the canonical frontend/DB values: '0', 'II', 'IIIa', 'IIIb', 'IV'
TERRAIN_Z0 = {
    '0':    (0.003,  1),   # (z0 in m, zmin in m)
    'II':   (0.05,   2),
    'IIIa': (0.2,    5),
    'IIIb': (0.5,   10),
    'IV':   (1.0,   15),
}

# Reference terrain is always Terrain II
Z0_II = 0.05

# Air density (kg/m³) — standard EN 1991-1-4 value
RHO_AIR = 1.25


def calculate_wind_params(terrain_type: str, z_total: float, vb: float) -> dict:
    """
    Compute the EC1 wind chain for a given terrain category, total height z,
    and reference wind speed Vb.

    Parameters
    ----------
    terrain_type : str
        One of '0', 'II', 'IIIa', 'IIIb', 'IV'.  Falls back to 'IIIa' if
        the value is not recognised.
    z_total : float
        Total height above ground (m): building + plot + mast.
    vb : float
        Reference wind speed (m/s) from the regional Vb map.

    Returns
    -------
    dict with keys:
        kr      – roughness factor
        cr_z    – roughness coefficient cr(z)
        vm      – mean wind speed Vm (m/s)
        iv_z    – turbulence intensity Iv(z)
        qp_pa   – peak velocity pressure (Pa)
        qp_dan  – peak velocity pressure (daN/m²)
        z_used  – effective z after clamping to zmin
    """
    z0, zmin = TERRAIN_Z0.get(terrain_type, TERRAIN_Z0['IIIa'])

    # Clamp z to zmin (EC1 §4.3.2)
    z_used = max(z_total, zmin)

    # kr — terrain roughness factor (EC1 eq. 4.5)
    kr = 0.19 * (z0 / Z0_II) ** 0.07

    # cr(z) — roughness coefficient (EC1 eq. 4.4)
    cr_z = kr * math.log(z_used / z0)

    # c₀ = 1.0 (flat terrain, no orography correction)
    c0 = 1.0

    # Vm — mean wind speed (EC1 eq. 4.3)
    vm = cr_z * c0 * vb

    # Iv(z) — turbulence intensity (EC1 eq. 4.7, kI=1, c0=1)
    iv_z = 1.0 / math.log(z_used / z0)

    # qp(z) — peak velocity pressure in Pa (EC1 eq. 4.8)
    qp_pa = (1 + 7 * iv_z) * 0.5 * RHO_AIR * vm ** 2

    # Convert Pa → daN/m²  (1 daN/m² = 10 Pa)
    qp_dan = qp_pa / 10.0

    return {
        'kr':     round(kr, 3),
        'cr_z':   round(cr_z, 3),
        'vm':     round(vm, 2),
        'iv_z':   round(iv_z, 4),
        'qp_pa':  round(qp_pa, 2),
        'qp_dan': round(qp_dan, 2),
        'z_used': round(z_used, 2),
    }

def generate_ndc_pdf(job, photo_url_or_path, preview_data=None, is_subsequent_sector=False, is_cover_only=False):
    """
    Generates a PDF from HTML templates using WeasyPrint based on job calculation results.
    """
    context = {}
    context['is_subsequent_sector'] = is_subsequent_sector
    context['is_cover_only'] = is_cover_only
    
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
    context['etancheite'] = env.get('etancheite') or '[ETANCHEITE]'
    
    dalle_m = env.get('dalle_thickness_m')
    if dalle_m:
        try:
            context['epaisseur_dalle_mm'] = int(float(dalle_m) * 1000)
        except (ValueError, TypeError):
            context['epaisseur_dalle_mm'] = '[EPAISSEUR_DALLE_MM]'
    else:
        context['epaisseur_dalle_mm'] = '[EPAISSEUR_DALLE_MM]'
        
    context['nombre_secteurs'] = structure_data.get('nombre_secteurs') or 3

    # Static Vb mapping
    vb_map = {1: 22, 2: 24, 3: 26, 4: 28}
    vb = vb_map.get(region_num)
    context['vb_m_s'] = vb if vb is not None else '[Vb_m/s]'

    # ------------------------------------------------------------------
    # Wind calculation (EC1 / EN 1991-1-4)
    # z = hauteur_bâtiment + hauteur_plot + hauteur_mât
    # ------------------------------------------------------------------
    terrain_type_str = str(env.get('terrain_type') or 'IIIa')

    try:
        h_bat  = float(env.get('building_height_m') or 0)
    except (ValueError, TypeError):
        h_bat = 0.0
    try:
        h_plot = float(env.get('plot_height_m') or 0)
    except (ValueError, TypeError):
        h_plot = 0.0
    try:
        h_mat  = float(mast_height_m or 0)
    except (ValueError, TypeError):
        h_mat = 0.0

    z_total = h_bat + h_plot + h_mat

    if vb is not None and z_total > 0:
        wind = calculate_wind_params(terrain_type_str, z_total, float(vb))
        context['vm_z']    = wind['vm']
        context['iv_z']    = wind['iv_z']
        context['qp_z']    = wind['qp_dan']
        context['cr_z']    = wind['cr_z']
        context['kr_z']    = wind['kr']
        context['z_total'] = wind['z_used']
    else:
        context['vm_z']    = '[Vm]'
        context['iv_z']    = '[Iv(z)]'
        context['qp_z']    = '[qp]'
        context['cr_z']    = '[cr(z)]'
        context['kr_z']    = '[kr]'
        context['z_total'] = '[z]'
    
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
    
    context['is_subsequent_sector'] = is_subsequent_sector
    
    # Resolve Photo Path
    photo_url_or_path = urllib.parse.unquote(photo_url_or_path or '')

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
    screenshot_found = False
    
    if job:
        # 1. Try to read from worker share folder first as requested by user
        worker_screenshot_path = f"/home/mahdi/worker_share/screenshots/job_{job.id}_3d_view.jpg"
        if os.path.exists(worker_screenshot_path):
            context['robot_screenshot_abs'] = worker_screenshot_path
            screenshot_found = True
        # 2. Fallback to django uploaded screenshot
        elif job.screenshot:
            screenshot_path = job.screenshot.path
            if os.path.exists(screenshot_path):
                context['robot_screenshot_abs'] = screenshot_path
                screenshot_found = True
                
    if not screenshot_found:
        context['robot_screenshot_abs'] = None
        
    # Combinaisons Image Path
    combinaisons_path = os.path.join(settings.MEDIA_ROOT, 'combinaisons', 'table.png')
    if os.path.exists(combinaisons_path):
        context['combinaisons_abs'] = combinaisons_path
    else:
        context['combinaisons_abs'] = None
        
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
