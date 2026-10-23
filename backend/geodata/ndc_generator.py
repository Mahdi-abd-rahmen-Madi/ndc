import os
import re
import glob
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


def sanitize_assemblage_rtf(rtf_text: str) -> str:
    """
    Sanitize Autodesk Robot Structural Analysis RTF output:
    1. Fix Greek & mathematical symbols that use Symbol font (which render as
       broken symbols, plus signs, or missing glyphs in LibreOffice headless).
       Convert them to standard Unicode with Arial/sans-serif font.
    2. Fix corrupted table cell widths (e.g., cellx480 on Gauche, Section, Soudures,
       and the 3-cell conclusion box cellx480/cellx960/cellx1440) that cause LibreOffice
       to render narrow 8.5mm columns with vertically wrapped text on an extra page.
    """
    # 1. Identify Symbol font index in the font table
    symbol_font_ids = set(re.findall(r"\\f(\d+)[^}]*?Symbol;", rtf_text, flags=re.IGNORECASE))
    if not symbol_font_ids:
        symbol_font_ids = set(re.findall(r"\\f(\d+)[^}]*?\\fcharset2", rtf_text, flags=re.IGNORECASE))
    if not symbol_font_ids:
        symbol_font_ids = {'3'}

    # 2. Fix symbols for each Symbol font ID
    symbol_map = {
        'g': r'\u947?',   # γ (gamma)
        'b': r'\u946?',   # β (beta)
        'p': r'\u960?',   # π (pi)
        's': r'\u963?',   # σ (sigma)
        't': r'\u964?',   # τ (tau)
        'a': r'\u945?',   # α (alpha)
        'd': r'\u948?',   # δ (delta)
        'e': r'\u949?',   # ε (epsilon)
        'h': r'\u951?',   # η (eta)
        'q': r'\u952?',   # θ (theta)
        'l': r'\u955?',   # λ (lambda)
        'm': r'\u956?',   # μ (mu)
        'r': r'\u961?',   # ρ (rho)
        'f': r'\u966?',   # φ (phi)
        'w': r'\u969?',   # ω (omega)
        'D': r'\u916?',   # Δ (Delta)
        'S': r'\u931?',   # Σ (Sigma)
        'W': r'\u937?',   # Ω (Omega)
        '^': r'\u8869?',  # ⊥ (perpendicular / up tack)
    }

    for fid in symbol_font_ids:
        # Radical / square root: \u214\'d6 or \'d6
        rtf_text = re.sub(
            rf"\\f{fid}((?:\\(?:fs\d+|insrsid\d+|b|i|sub|super|cf\d+))*)\s*(?:\\u214\\'d6|\\'d6)",
            r"\\f1\1 \\u8730?",
            rtf_text
        )

        def make_repl(f_id):
            def repl_char(m):
                flags = m.group(1) or ""
                char = m.group(2)
                repl = symbol_map.get(char, char)
                return rf"\f1{flags} {repl}"
            return repl_char

        chars_class = "".join(re.escape(c) for c in symbol_map.keys())
        pattern = rf"\\f{fid}((?:\\(?:fs\d+|insrsid\d+|b|i|sub|super|cf\d+))*)\s+([{chars_class}])"
        rtf_text = re.sub(pattern, make_repl(fid), rtf_text)

    # 3. Fix 3-cell conclusion box:
    # Robot erroneously writes: \cellx480 ... \cellx960 ... \cellx1440
    # Replace with full-width columns: \cellx7000 ... \cellx8200 ... \cellx9360
    pattern_3cell = r"(\\cellx)480((?:(?!\\cellx).)*?\\cellx)960((?:(?!\\cellx).)*?\\cellx)1440"
    def repl_3cell(m):
        return m.group(1) + "7000" + m.group(2) + "8200" + m.group(3) + "9360"
    rtf_text = re.sub(pattern_3cell, repl_3cell, rtf_text, flags=re.DOTALL)

    # 4. Fix 2-cell spacer rows:
    pattern_2cell = r"(\\cellx)480((?:(?!\\cellx).)*?\\cellx)960"
    def repl_2cell(m):
        return m.group(1) + "8200" + m.group(2) + "9360"
    rtf_text = re.sub(pattern_2cell, repl_2cell, rtf_text, flags=re.DOTALL)

    # 5. Fix all remaining 1-cell rows with \cellx480 (such as Gauche, Section, Soudures):
    rtf_text = rtf_text.replace(r"\cellx480", r"\cellx9360")

    return rtf_text


def generate_ndc_pdf(job, photo_url_or_path, preview_data=None, is_subsequent_sector=False, is_cover_only=False, start_page=1):
    """
    Generates a PDF from HTML templates using WeasyPrint based on job calculation results.
    """
    context = {}
    context['is_subsequent_sector'] = is_subsequent_sector
    context['is_cover_only'] = is_cover_only
    context['start_page'] = start_page
    
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

    active_data = input_data if job else (preview_data or {})
    
    context['site_address'] = site_info.get('address') or active_data.get('address') or '[ADRESSE_DU_SITE]'
    context['site_name'] = site_info.get('name') or active_data.get('site_name') or '[NOM_DU_SITE]'
    code_site_val = (
        site_info.get('code_site')
        or site_info.get('ref_site')
        or active_data.get('code_site')
        or active_data.get('ref_site')
    )
    context['code_site'] = code_site_val or '[RÉF_DU_SITE]'
    context['ref_site'] = context['code_site']
    context['client_name'] = site_info.get('client') or active_data.get('client_name') or '[CLIENT]'
    context['current_date'] = datetime.now().strftime("%d/%m/%Y")
    
    # -----------------------------
    # Page 3 Variables Mapping
    # -----------------------------

    import re
    structure_data = active_data.get('structure', {})

    # Helper for regex extraction
    def parse_dimensions(section_str):
        if section_str:
            match = re.search(r'(\d+)\s*[xX]\s*(\d+(\.\d+)?)', section_str)
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
    raw_echelle = (
        structure_data.get('echelle')
        or active_data.get('echelle')
        or env.get('echelle')
        or 'Echelle Söll'
    )
    if raw_echelle and ("pas d'echelle" in raw_echelle.lower() or "pas d'échelle" in raw_echelle.lower()):
        context['echelle_name'] = None
        context['has_echelle'] = False
    else:
        context['echelle_name'] = raw_echelle
        context['has_echelle'] = True

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

    # Verification Screenshot Path
    verification_screenshot_found = False
    
    if job:
        # 1. Try to read from worker share folder
        worker_verification_screenshot_path = f"/home/mahdi/worker_share/screenshots/job_{job.id}_verification_view.jpg"
        if os.path.exists(worker_verification_screenshot_path):
            context['verification_screenshot_abs'] = worker_verification_screenshot_path
            verification_screenshot_found = True
        # 2. Fallback to django uploaded screenshot
        elif hasattr(job, 'verification_screenshot') and job.verification_screenshot:
            verification_screenshot_path = job.verification_screenshot.path
            if os.path.exists(verification_screenshot_path):
                context['verification_screenshot_abs'] = verification_screenshot_path
                verification_screenshot_found = True
                
    if not verification_screenshot_found:
        context['verification_screenshot_abs'] = None
    elif context.get('verification_screenshot_abs') and os.path.exists(context['verification_screenshot_abs']):
        try:
            from PIL import Image
            import numpy as np
            
            orig_path = context['verification_screenshot_abs']
            with Image.open(orig_path) as im:
                arr = np.array(im.convert('RGB'))
                h, w, _ = arr.shape
                
                dark = (arr[:, :, 0] < 80) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)
                
                vert_counts = dark[min(70, h-20):max(h-10, min(70, h-20)+1), :].sum(axis=0)
                vert_lines = np.where(vert_counts > 20)[0]
                table_vert_lines = vert_lines[vert_lines <= min(w, 880)]
                
                if len(table_vert_lines) > 0 and w > 840:
                    right = min(w, int(table_vert_lines[-1]) + 3)
                else:
                    right = w
                    
                horiz_counts = dark[:, min(50, right-10):max(50, right-5)].sum(axis=1)
                min_span = max(10, (right - 55) * 0.4)
                horiz_lines = np.where(horiz_counts > min_span)[0]
                table_horiz = horiz_lines[horiz_lines > 60]
                
                if len(table_horiz) > 0 and h > 160:
                    bottom = min(h, int(table_horiz[-1]) + 3)
                else:
                    bottom = h
                    
                if right < w - 20 or bottom < h - 15:
                    cropped_im = im.crop((0, 0, right, bottom))
                    convert_dir = os.path.join(settings.MEDIA_ROOT, 'screenshots', 'verification')
                    os.makedirs(convert_dir, exist_ok=True)
                    base_name = os.path.splitext(os.path.basename(orig_path))[0]
                    cropped_path = os.path.join(convert_dir, f"{base_name}_cropped.png")
                    cropped_im.save(cropped_path, "PNG")
                    context['verification_screenshot_abs'] = cropped_path
        except Exception as e:
            print(f"Warning: Failed to auto-crop verification screenshot: {e}")

        
    # Note de Calcul (RTF) Path
    note_de_calcul_found = False
    
    if job:
        # 1. Try to read from worker share folder first
        worker_ndc_path = f"/home/mahdi/worker_share/screenshots/job_{job.id}_note_de_calcul.rtf"
        if os.path.exists(worker_ndc_path):
            context['note_de_calcul_abs'] = worker_ndc_path
            note_de_calcul_found = True
        # 2. Fallback to django uploaded file
        elif hasattr(job, 'note_de_calcul') and job.note_de_calcul:
            ndc_path = job.note_de_calcul.path
            if os.path.exists(ndc_path):
                context['note_de_calcul_abs'] = ndc_path
                note_de_calcul_found = True
                
    if not note_de_calcul_found:
        context['note_de_calcul_abs'] = None

    # Convert RTF to Images (for embedding directly in the HTML template)
    context['note_de_calcul_images'] = []
    if context.get('note_de_calcul_abs'):
        import subprocess
        import tempfile
        rtf_path = context['note_de_calcul_abs']
        # Use LibreOffice to convert RTF → PDF
        convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul')
        os.makedirs(convert_dir, exist_ok=True)
        try:
            subprocess.run([
                'soffice', '--headless', '--convert-to', 'pdf',
                '--outdir', convert_dir, rtf_path
            ], timeout=30, check=True, capture_output=True)
            # The output PDF has the same basename with .pdf extension
            rtf_basename = os.path.splitext(os.path.basename(rtf_path))[0]
            pdf_output = os.path.join(convert_dir, f"{rtf_basename}.pdf")
            if os.path.exists(pdf_output):
                # Convert PDF to images using PyMuPDF
                import fitz
                doc = fitz.open(pdf_output)
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    # Higher resolution (e.g. 2x zoom)
                    zoom = 2.0
                    mat = fitz.Matrix(zoom, zoom)
                    pix = page.get_pixmap(matrix=mat)
                    
                    # Convert fitz pixmap to PIL Image to crop white space
                    from PIL import Image, ImageChops
                    mode = "RGBA" if pix.alpha else "RGB"
                    img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
                    
                    # Trim white space
                    bg = Image.new(img.mode, img.size, (255, 255, 255) if not pix.alpha else (255, 255, 255, 255))
                    diff = ImageChops.difference(img, bg)
                    diff = ImageChops.add(diff, diff, 2.0, -100)
                    bbox = diff.getbbox()
                    
                    if bbox:
                        # Add a small padding of 20 pixels
                        pad = 20
                        bbox = (
                            max(0, bbox[0] - pad),
                            max(0, bbox[1] - pad),
                            min(img.width, bbox[2] + pad),
                            min(img.height, bbox[3] + pad)
                        )
                        img = img.crop(bbox)
                    
                    img_path = os.path.join(convert_dir, f"{rtf_basename}_page_{page_num+1}.png")
                    img.save(img_path)
                    context['note_de_calcul_images'].append(img_path)
                doc.close()
        except Exception as e:
            print(f"Warning: Failed to convert RTF to Images: {e}")

    # Assemblage Note (RTF) Path
    assemblage_note_found = False
    
    if job:
        # 1. Try to read from worker share folder first
        worker_assemblage_path = f"/home/mahdi/worker_share/screenshots/job_{job.id}_assemblage_note.rtf"
        if os.path.exists(worker_assemblage_path):
            context['assemblage_note_abs'] = worker_assemblage_path
            assemblage_note_found = True
        # 2. Fallback to django uploaded file
        elif hasattr(job, 'assemblage_note') and job.assemblage_note:
            try:
                assemblage_path = job.assemblage_note.path
                if os.path.exists(assemblage_path):
                    context['assemblage_note_abs'] = assemblage_path
                    assemblage_note_found = True
            except Exception:
                pass
        # 3. Fallback to media/assemblages default path
        if not assemblage_note_found:
            fallback_media_path = os.path.join(settings.MEDIA_ROOT, 'assemblages', f'job_{job.id}_assemblage_note.rtf')
            if os.path.exists(fallback_media_path):
                context['assemblage_note_abs'] = fallback_media_path
                assemblage_note_found = True
        # 4. Fallback to worker result_data path if provided
        if not assemblage_note_found and isinstance(job.result_data, dict):
            raw_path = job.result_data.get('assemblage_note_path')
            if raw_path:
                basename = os.path.basename(raw_path.replace('\\', '/'))
                candidate_paths = [
                    f"/home/mahdi/worker_share/screenshots/{basename}",
                    f"/home/mahdi/worker_share/screenshots/default_client/{basename}",
                    os.path.join(settings.MEDIA_ROOT, 'assemblages', basename)
                ]
                for cp in candidate_paths:
                    if os.path.exists(cp):
                        context['assemblage_note_abs'] = cp
                        assemblage_note_found = True
                        break

    if not assemblage_note_found:
        context['assemblage_note_abs'] = None

    # Convert Assemblage RTF to Images (for embedding directly in the HTML template)
    context['assemblage_note_images'] = []
    if context.get('assemblage_note_abs'):
        import subprocess
        rtf_path = context['assemblage_note_abs']
        convert_dir = os.path.join(settings.MEDIA_ROOT, 'assemblages')
        os.makedirs(convert_dir, exist_ok=True)
        try:
            rtf_basename = os.path.splitext(os.path.basename(rtf_path))[0]
            if rtf_path.endswith('.pdf'):
                pdf_output = rtf_path
            else:
                # Sanitize RTF before converting to PDF:
                # Fixes Symbol font characters (Greek/math) and corrupted \cellx480 widths
                clean_rtf_path = os.path.join(convert_dir, f"{rtf_basename}_clean.rtf")
                with open(rtf_path, 'r', encoding='latin1') as rf:
                    raw_rtf = rf.read()
                cleaned_rtf = sanitize_assemblage_rtf(raw_rtf)
                with open(clean_rtf_path, 'w', encoding='latin1') as wf:
                    wf.write(cleaned_rtf)

                subprocess.run([
                    'soffice', '--headless', '--convert-to', 'pdf',
                    '--outdir', convert_dir, clean_rtf_path
                ], timeout=30, check=True, capture_output=True)
                pdf_output = os.path.join(convert_dir, f"{rtf_basename}_clean.pdf")

            if os.path.exists(pdf_output):
                # Clean up any previously generated page images to avoid stale extra pages (e.g., old page 4)
                for old_img in glob.glob(os.path.join(convert_dir, f"{rtf_basename}_page_*.png")):
                    try:
                        os.remove(old_img)
                    except Exception:
                        pass

                import fitz
                doc = fitz.open(pdf_output)
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    zoom = 2.0
                    mat = fitz.Matrix(zoom, zoom)
                    pix = page.get_pixmap(matrix=mat)
                    
                    from PIL import Image, ImageChops
                    mode = "RGBA" if pix.alpha else "RGB"
                    img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
                    
                    bg = Image.new(img.mode, img.size, (255, 255, 255) if not pix.alpha else (255, 255, 255, 255))
                    diff = ImageChops.difference(img, bg)
                    diff = ImageChops.add(diff, diff, 2.0, -100)
                    bbox = diff.getbbox()
                    
                    if bbox:
                        pad = 20
                        bbox = (
                            max(0, bbox[0] - pad),
                            max(0, bbox[1] - pad),
                            min(img.width, bbox[2] + pad),
                            min(img.height, bbox[3] + pad)
                        )
                        img = img.crop(bbox)
                    
                    img_path = os.path.join(convert_dir, f"{rtf_basename}_page_{page_num+1}.png")
                    img.save(img_path)
                    context['assemblage_note_images'].append(img_path)
                doc.close()
        except Exception as e:
            print(f"Warning: Failed to convert Assemblage RTF to Images: {e}")
    
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

def generate_auxiliary_pdfs(job, start_page=1):
    """
    Generate auxiliary PDFs (TD, FH, RRH, RRU) based on job.input_data.
    Returns a list of absolute paths to the generated PDFs.
    """
    input_data = job.input_data if job else {}
    generated_pdfs = []

    # Prepare common context
    context = {}
    context['start_page'] = start_page
    
    # Static context that was extracted previously...
    env = input_data.get('environment', {})
    structure_data = input_data.get('structure', {})

    # Helper for parsing dimensions
    import re
    def parse_dimensions(section_str):
        if section_str:
            match = re.search(r'(\d+)\s*[xX]\s*(\d+(\.\d+)?)', section_str)
            if match:
                return match.group(1), match.group(2)
        return None, None

    # Mât Principal
    mat_principal_str = structure_data.get('mat_principal') or ''
    diam, epaisseur = parse_dimensions(mat_principal_str)
    context['mat_diam'] = diam or '[DIAM]'
    context['mat_epaisseur'] = epaisseur or '[EPAISSEUR]'
    
    mast_height_m = structure_data.get('mast_height_m') or structure_data.get('hauteur_mat_m')
    try:
        context['mat_longueur'] = int(float(mast_height_m) * 1000) if mast_height_m else '[LONGUEUR]'
        context['mat_longueur_m'] = float(mast_height_m) if mast_height_m else '[LONGUEUR_M]'
    except (ValueError, TypeError):
        context['mat_longueur'] = '[LONGUEUR]'
        context['mat_longueur_m'] = '[LONGUEUR_M]'
    context['mat_section'] = mat_principal_str or '[MAT_SECTION]'

    # Plot
    plot_str = structure_data.get('plot_metallique') or ''
    context['plot_section'] = plot_str or '[PLOT_SECTION]'
    context['plot_longueur_m'] = env.get('plot_height_m') or '[PLOT_HEIGHT_M]'

    # Wind
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

    context['region'] = region_name
    context['terrain_type'] = env.get('terrain_type') or '[CATEGORIE_TERRAIN]'
    context['building_height'] = env.get('building_height_m') or '[HAUTEUR_BATIMENT]'
    
    vb_map = {1: 22, 2: 24, 3: 26, 4: 28}
    vb = vb_map.get(region_num)
    context['vb_m_s'] = vb if vb is not None else '[Vb]'

    try:
        h_bat = float(env.get('building_height_m') or 0)
        h_plot = float(env.get('plot_height_m') or 0)
        h_mat = float(mast_height_m or 0)
        z_total = h_bat + h_plot + h_mat
    except (ValueError, TypeError):
        z_total = 0

    if vb is not None and z_total > 0:
        terrain_type_str = str(env.get('terrain_type') or 'IIIa')
        wind = calculate_wind_params(terrain_type_str, z_total, float(vb))
        context['vm_z'] = wind['vm']
        context['iv_z'] = wind['iv_z']
        context['qp_z'] = wind['qp_dan']
        context['cr_z'] = wind['cr_z']
        context['kr_z'] = wind['kr']
    else:
        context['vm_z'] = '[Vm]'
        context['iv_z'] = '[Iv(z)]'
        context['qp_z'] = '[qp]'
        context['cr_z'] = '[cr(z)]'
        context['kr_z'] = '[kr]'

    # Client Logo
    site_info = input_data.get('site', {})
    client_logo_url = site_info.get('client_logo_url')
    if client_logo_url:
        from urllib.parse import urlparse, unquote
        client_logo_url = unquote(client_logo_url)
        parsed_url = urlparse(client_logo_url)
        path = parsed_url.path
        if path.startswith(settings.MEDIA_URL):
            relative_path = path[len(settings.MEDIA_URL):]
            client_logo_abs = os.path.join(settings.MEDIA_ROOT, relative_path)
            if os.path.exists(client_logo_abs):
                context['client_logo_abs'] = client_logo_abs
    else:
        context['client_logo_abs'] = None
        
    logo_path = os.path.join(settings.MEDIA_ROOT, 'uploads', 'logo_cometa.png')
    context['logo_abs'] = logo_path if os.path.exists(logo_path) else None

    def _render_and_save(template_name, equipment_context):
        from django.template.loader import render_to_string
        from weasyprint import HTML
        import uuid
        import os
        from django.conf import settings
        
        ctx = context.copy()
        ctx.update(equipment_context)
        html_string = render_to_string(f'ndc/{template_name}.html', ctx)
        output_filename = f"{template_name.upper()}_{job.id if job else 'preview'}_{uuid.uuid4().hex[:8]}.pdf"
        outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(outdir, exist_ok=True)
        pdf_path = os.path.join(outdir, output_filename)
        html = HTML(string=html_string, base_url=f"file://{settings.MEDIA_ROOT}")
        html.write_pdf(pdf_path)

        if os.path.exists(pdf_path):
            try:
                from pypdf import PdfReader
                reader = PdfReader(pdf_path)
                context['start_page'] += len(reader.pages)
            except Exception:
                context['start_page'] += 1

        return pdf_path

    # Check for TD
    td_eq = input_data.get('td_equipment', {})
    if td_eq.get('enabled'):
        generated_pdfs.append(_render_and_save('td', {
            'eq_qty': 1,
            'eq_dims': '[TD_DIMS]',
            'eq_weight': '[TD_WEIGHT]'
        }))

    # Check for FH
    fh_eq = input_data.get('fh_equipment', {})
    if fh_eq.get('enabled'):
        diameter = fh_eq.get('diameter_mm')
        generated_pdfs.append(_render_and_save('fh', {
            'eq_qty': fh_eq.get('quantity') or 1,
            'eq_dims': f"Ø{diameter}" if diameter else '[FH_DIMS]',
            'eq_weight': fh_eq.get('weight_kg') or '[FH_WEIGHT]'
        }))

    # Check for RRH
    rrh_eq = input_data.get('rrh_equipment', {})
    if rrh_eq.get('enabled'):
        items = rrh_eq.get('items', [])
        qty = sum(item.get('quantity', 1) for item in items) if items else 1
        generated_pdfs.append(_render_and_save('rrh', {
            'eq_qty': qty,
            'eq_dims': '[RRH_DIMS]',
            'eq_weight': '[RRH_WEIGHT]'
        }))

    # Check for RRU
    rru_eq = input_data.get('rru_equipment', {})
    if rru_eq.get('enabled'):
        items = rru_eq.get('items', [])
        qty = sum(item.get('quantity', 1) for item in items) if items else 1
        generated_pdfs.append(_render_and_save('rru', {
            'eq_qty': qty,
            'eq_dims': '[RRU_DIMS]',
            'eq_weight': '[RRU_WEIGHT]'
        }))

    return generated_pdfs
