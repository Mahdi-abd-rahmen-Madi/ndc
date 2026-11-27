"""WeasyPrint HTML-to-PDF rendering for primary site NDC and auxiliary (TD, FH, RRH, RRU) annexes."""
import logging
import os
import uuid
from datetime import datetime

from django.conf import settings
from django.template.loader import render_to_string
from weasyprint import HTML

from utils.domain_constants import (
    WIND_REGION_VB0,
    OPERATORS_WITHOUT_TD,
    FH_DEFAULT_MAST_SECTION,
    LOVAGE_CF_FRONT,
    LOVAGE_CF_LAT,
    LOVAGE_DEFAULT_MAST_HEIGHT_M,
    LOVAGE_DEFAULT_MAST_SECTION,
    LOVAGE_DEFAULT_PLOT_HEIGHT_M,
    LOVAGE_DEFAULT_PLOT_SECTION,
    normalize_operator,
    resolve_fh_mast_profile,
    resolve_sans_plot,
    resolve_support_has_echelle,
)
from utils.path_security import safe_media_path
from utils.validators import get_support_mast_height_m

from .artifact_locator import (
    _first_existing_file,
    _worker_screenshots_dir,
    find_job_assemblage_note_path,
    find_job_note_de_calcul_path,
    find_job_rrh_rtf_paths,
    find_job_rru_rtf_paths,
    find_job_fh_rtf_paths,
    find_job_lovage_rtf_paths,
)
from .equipment_context import (
    clean_equipment_designation,
    clean_fh_designation,
    extract_rrh_ndc_context,
    extract_rru_ndc_context,
    extract_fh_ndc_context,
    extract_lovage_ndc_context,
)
from .image_cropper import (
    _crop_tableau_charges_image,
    crop_verification_screenshot,
)
from .rtf_converter import _convert_rtf_file_to_images
from .wind_ec1 import (
    TERRAIN_Z0,
    _parse_section_dimensions,
    _resolve_support_wind_params,
    calculate_wind_params,
    compute_wind_z,
    get_support_structure_params,
    resolve_antenna_wind_params,
)

logger = logging.getLogger(__name__)


def generate_ndc_pdf(
    job,
    photo_url_or_path,
    preview_data=None,
    is_subsequent_sector=False,
    is_cover_only=False,
    start_page=1,
    preconverted_images=None,
):
    """
    Generates a PDF from HTML templates using WeasyPrint based on job calculation results.
    Accepts preconverted_images mapping to reuse images generated in batch, avoiding
    redundant LibreOffice startup overhead.
    """
    context = {
        'is_subsequent_sector': is_subsequent_sector,
        'is_cover_only': is_cover_only,
        'start_page': start_page,
    }

    input_data = job.input_data if job else {}
    res_data = job.result_data if (job and isinstance(getattr(job, 'result_data', None), dict)) else {}

    if not job:
        for i in range(1, 64):
            context[f'var_{i}'] = f'[VAR_{i}]'
    elif isinstance(res_data.get('ndc_vars'), dict):
        for k, v in res_data['ndc_vars'].items():
            if v is not None:
                context[k] = v

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

    # Page 3 Variables Mapping
    structure_data = active_data.get('structure', {})
    parse_dimensions = _parse_section_dimensions

    mat_principal_str = structure_data.get('mat_principal') or ''
    diam_4g, epaisseur_4g = parse_dimensions(mat_principal_str)
    context['mat_4g_diam'] = diam_4g or '[DIAM_4G]'
    context['mat_4g_epaisseur'] = epaisseur_4g or '[EPAISSEUR_4G]'

    mast_height_m = structure_data.get('mast_height_m') or structure_data.get('hauteur_mat_m')
    if mast_height_m:
        try:
            context['mat_4g_longueur'] = int(float(mast_height_m) * 1000)
        except (ValueError, TypeError):
            context['mat_4g_longueur'] = '[LONGUEUR_4G]'
    else:
        context['mat_4g_longueur'] = '[LONGUEUR_4G]'

    mat_secondaire_str = structure_data.get('mat_secondaire') or ''
    diam_5g, epaisseur_5g = parse_dimensions(mat_secondaire_str)
    context['mat_5g_diam'] = diam_5g or '[DIAM_5G]'
    context['mat_5g_epaisseur'] = epaisseur_5g or '[EPAISSEUR_5G]'
    context['mat_5g_longueur'] = 1000

    bras_str = structure_data.get('bras_de_deport') or 'TCAR 50x5'
    diam_bras, epaisseur_bras = parse_dimensions(bras_str)
    context['bras_deport_diam'] = diam_bras or '[DIAM_BRAS]'
    context['bras_deport_epaisseur'] = epaisseur_bras or '[EPAISSEUR_BRAS]'
    context['bras_deport_longueur'] = 300

    plot_str = structure_data.get('plot_metallique') or ''
    diam_plot, epaisseur_plot = parse_dimensions(plot_str)
    context['plot_diam'] = diam_plot or '[PLOT_DIAM]'
    context['plot_epaisseur'] = epaisseur_plot or '[PLOT_EPAISSEUR]'

    antenna_4g = active_data.get('antenna_4g', {})
    a4g_w = antenna_4g.get('largeur_mm') or antenna_4g.get('width_mm')
    a4g_h = antenna_4g.get('hauteur_mm') or antenna_4g.get('height_mm')
    a4g_t = antenna_4g.get('epaisseur_mm') or antenna_4g.get('thickness_mm')
    if a4g_h and a4g_w and a4g_t:
        context['ant_4g_dims'] = f"{int(float(a4g_h))}x{int(float(a4g_w))}x{int(float(a4g_t))}"
    else:
        context['ant_4g_dims'] = '[ANT_4G_DIMS]'
    context['ant_4g_weight'] = antenna_4g.get('poids_kg') or antenna_4g.get('weight_dan') or '[ANT_4G_WEIGHT]'

    antenna_5g = active_data.get('antenna_5g', {})
    a5g_w = antenna_5g.get('largeur_mm') or antenna_5g.get('width_mm')
    a5g_h = antenna_5g.get('hauteur_mm') or antenna_5g.get('height_mm')
    a5g_t = antenna_5g.get('epaisseur_mm') or antenna_5g.get('thickness_mm')
    if a5g_h and a5g_w and a5g_t:
        context['ant_5g_dims'] = f"{int(float(a5g_h))}x{int(float(a5g_w))}x{int(float(a5g_t))}"
    else:
        context['ant_5g_dims'] = '[ANT_5G_DIMS]'
    context['ant_5g_weight'] = antenna_5g.get('poids_kg') or antenna_5g.get('weight_dan') or '[ANT_5G_WEIGHT]'

    if mast_height_m:
        try:
            context['ant_5g_hba'] = round(float(mast_height_m) + 0.2, 2)
        except (ValueError, TypeError):
            context['ant_5g_hba'] = '[ANT_5G_HBA]'
    else:
        context['ant_5g_hba'] = '[ANT_5G_HBA]'

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

    vb = WIND_REGION_VB0.get(region_num)
    context['vb_m_s'] = vb if vb is not None else '[Vb_m/s]'

    antenna_wind = resolve_antenna_wind_params(
        res_data,
        env,
        mast_height_m,
        vb,
        structure_data=structure_data,
        active_data=active_data,
    )
    context['vm_z'] = antenna_wind['vm_z']
    context['iv_z'] = antenna_wind['iv_z']
    context['qp_z'] = antenna_wind['qp_z']
    context['cr_z'] = antenna_wind['cr_z']
    context['kr_z'] = antenna_wind['kr_z']
    context['z_total'] = antenna_wind['z_total']
    if antenna_wind.get('vb_m_s') is not None:
        context['vb_m_s'] = antenna_wind['vb_m_s']
    for force_key in ('fw_mast', 'fw_4g_front', 'fw_4g_lat', 'fw_5g_front', 'fw_5g_lat'):
        if antenna_wind.get(force_key) is not None:
            context[force_key] = antenna_wind[force_key]

    # Client Logo & Site Photo (confined to MEDIA_ROOT)
    client_logo_url = site_info.get('client_logo_url')
    if client_logo_url:
        client_logo_abs = safe_media_path(client_logo_url)
        context['client_logo_abs'] = client_logo_abs if (client_logo_abs and os.path.exists(client_logo_abs)) else None
    else:
        context['client_logo_abs'] = None

    photo_abs = safe_media_path(photo_url_or_path)
    context['photo_abs'] = photo_abs if (photo_abs and os.path.exists(photo_abs)) else None

    # Robot 3D Screenshot
    ws_dir = _worker_screenshots_dir()
    screenshot_found = False
    if job:
        if hasattr(job, 'screenshot') and job.screenshot:
            try:
                screenshot_path = job.screenshot.path
                if os.path.exists(screenshot_path):
                    context['robot_screenshot_abs'] = screenshot_path
                    screenshot_found = True
            except Exception:
                pass
        if not screenshot_found:
            found = _first_existing_file([
                f"{ws_dir}/job_{job.id}_3d_view.jpg",
                os.path.join(settings.MEDIA_ROOT, 'screenshots', f'job_{job.id}_3d_view.jpg'),
            ])
            if found:
                context['robot_screenshot_abs'] = found
                screenshot_found = True
    if not screenshot_found:
        context['robot_screenshot_abs'] = None

    # Verification Screenshot
    verification_screenshot_found = False
    if job:
        if hasattr(job, 'verification_screenshot') and job.verification_screenshot:
            try:
                verification_screenshot_path = job.verification_screenshot.path
                if os.path.exists(verification_screenshot_path):
                    context['verification_screenshot_abs'] = verification_screenshot_path
                    verification_screenshot_found = True
            except Exception:
                pass
        if not verification_screenshot_found:
            found = _first_existing_file([
                f"{ws_dir}/job_{job.id}_verification_view.jpg",
                f"{ws_dir}/job_{job.id}_verification.jpg",
                f"{ws_dir}/job_{job.id}_antenna_verification.jpg",
                os.path.join(settings.MEDIA_ROOT, 'screenshots', 'verification', f'job_{job.id}_verification.jpg'),
                os.path.join(settings.MEDIA_ROOT, 'screenshots', 'verification', f'job_{job.id}_antenna_verification.jpg'),
                os.path.join(settings.MEDIA_ROOT, 'screenshots', f'job_{job.id}_verification.jpg'),
                os.path.join(settings.MEDIA_ROOT, 'screenshots', f'job_{job.id}_antenna_verification.jpg'),
            ])
            if found:
                context['verification_screenshot_abs'] = found
                verification_screenshot_found = True
        if not verification_screenshot_found and isinstance(getattr(job, 'result_data', None), dict):
            for k in ['verification_screenshot_path', 'antenna_verification_screenshot_path', 'verification_view_path']:
                raw_path = job.result_data.get(k)
                if raw_path and isinstance(raw_path, str):
                    base = os.path.basename(raw_path.replace('\\', '/'))
                    found = _first_existing_file([
                        os.path.join(settings.MEDIA_ROOT, 'screenshots', 'verification', base),
                        os.path.join(settings.MEDIA_ROOT, 'screenshots', base),
                        f"{ws_dir}/{base}",
                    ])
                    if found:
                        context['verification_screenshot_abs'] = found
                        verification_screenshot_found = True
                        break

    if not verification_screenshot_found:
        context['verification_screenshot_abs'] = None
    elif context.get('verification_screenshot_abs') and os.path.exists(context['verification_screenshot_abs']):
        context['verification_screenshot_abs'] = crop_verification_screenshot(context['verification_screenshot_abs'])

    # Note de Calcul & Assemblage RTFs
    context['note_de_calcul_abs'] = find_job_note_de_calcul_path(job)
    context['note_de_calcul_images'] = []
    job_prefix = f"job_{job.id if job else 'preview'}_note_de_calcul"
    if preconverted_images and job_prefix in preconverted_images and preconverted_images[job_prefix]:
        context['note_de_calcul_images'] = preconverted_images[job_prefix]
    elif context.get('note_de_calcul_abs') and os.path.exists(context['note_de_calcul_abs']):
        convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul')
        try:
            context['note_de_calcul_images'] = _convert_rtf_file_to_images(
                context['note_de_calcul_abs'], convert_dir, job_prefix
            )
        except Exception as e:
            logger.warning("Failed to convert RTF note de calcul to images: %s", e)

    context['assemblage_note_abs'] = find_job_assemblage_note_path(job)
    context['assemblage_note_images'] = []
    job_prefix = f"job_{job.id if job else 'preview'}_assemblage"
    if preconverted_images and job_prefix in preconverted_images and preconverted_images[job_prefix]:
        context['assemblage_note_images'] = preconverted_images[job_prefix]
    elif context.get('assemblage_note_abs') and os.path.exists(context['assemblage_note_abs']):
        convert_dir = os.path.join(settings.MEDIA_ROOT, 'assemblages')
        try:
            context['assemblage_note_images'] = _convert_rtf_file_to_images(
                context['assemblage_note_abs'], convert_dir, job_prefix, is_assemblage=True
            )
        except Exception as e:
            logger.warning("Failed to convert Assemblage RTF to images: %s", e)

    combinaisons_path = os.path.join(settings.MEDIA_ROOT, 'combinaisons', 'table.png')
    context['combinaisons_abs'] = combinaisons_path if os.path.exists(combinaisons_path) else None

    logo_path = os.path.join(settings.MEDIA_ROOT, 'uploads', 'logo_cometa.png')
    context['logo_abs'] = logo_path if os.path.exists(logo_path) else None

    # Hardened Artifact Guard
    if job and job.id != 'preview' and job.id != 'fast':
        missing_mandatory = []
        if not context.get('robot_screenshot_abs') or not os.path.exists(context['robot_screenshot_abs']):
            missing_mandatory.append("Capture 3D modélisation Robot (page 4)")
        if not context.get('verification_screenshot_abs') or not os.path.exists(context['verification_screenshot_abs']):
            missing_mandatory.append("Capture de vérification Robot ELU/ELS (page 7)")
        if not context.get('note_de_calcul_images'):
            missing_mandatory.append("Note de calcul RTF du mât principal (page 8)")
        if not context.get('assemblage_note_images'):
            missing_mandatory.append("Note de calcul d'assemblage Robot (page 9+)")

        if missing_mandatory:
            err_msg = (
                f"Génération NDC bloquée pour le Job {job.id} : artéfacts obligatoires manquants ({', '.join(missing_mandatory)}). "
                f"La création d'un PDF incomplet est strictement interdite afin de ne jamais transmettre un document tronqué au client."
            )
            logger.error("[NDC HARDENING ERROR] %s", err_msg)
            raise ValueError(err_msg)

    html_string = render_to_string('ndc/base.html', context)

    job_id_str = job.id if job else "preview"
    output_filename = f"NDC_{job_id_str}_{uuid.uuid4().hex[:8]}"
    outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
    os.makedirs(outdir, exist_ok=True)
    pdf_path = os.path.join(outdir, f"{output_filename}.pdf")

    html = HTML(string=html_string, base_url=f"file://{settings.MEDIA_ROOT}")
    html.write_pdf(pdf_path)

    if not os.path.exists(pdf_path):
        raise RuntimeError("PDF file was not generated.")

    return settings.MEDIA_URL + f"uploads/{output_filename}.pdf"


def generate_ndc_pdf_task(job_id, photo_url_or_path):
    from api.models import CalculationJob
    try:
        job = CalculationJob.objects.get(id=job_id)
        pdf_url = generate_ndc_pdf(job, photo_url_or_path)
        if not isinstance(job.result_data, dict):
            job.result_data = {}
        job.result_data['ndc_pdf_url'] = pdf_url
        job.save()
        return pdf_url
    except CalculationJob.DoesNotExist:
        logger.warning("Job %s not found for PDF generation", job_id)
        return None


def generate_auxiliary_pdfs(job, start_page=1, preconverted_images=None):
    """
    Generate auxiliary PDFs (TD, FH, RRH, RRU) based on job.input_data.
    Returns a list of absolute paths to the generated PDFs.
    """
    input_data = job.input_data if job else {}
    generated_pdfs = []

    context = {'start_page': start_page}
    env = input_data.get('environment', {})
    structure_data = input_data.get('structure', {})
    parse_dimensions = _parse_section_dimensions

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

    plot_str = structure_data.get('plot_metallique') or ''
    context['plot_section'] = plot_str or '[PLOT_SECTION]'
    context['plot_longueur_m'] = env.get('plot_height_m') or '[PLOT_HEIGHT_M]'

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

    vb = WIND_REGION_VB0.get(region_num)
    context['vb_m_s'] = vb if vb is not None else '[Vb]'

    terrain_type_str = str(env.get('terrain_type') or 'IIIa')
    res_data_base = getattr(job, 'result_data', {}) if (job and isinstance(getattr(job, 'result_data', None), dict)) else {}
    base_wind = resolve_antenna_wind_params(
        res_data_base,
        env,
        mast_height_m,
        vb,
        structure_data=structure_data,
        active_data=input_data,
    )
    context['vm_z'] = base_wind['vm_z']
    context['iv_z'] = base_wind['iv_z']
    context['qp_z'] = base_wind['qp_z']
    context['cr_z'] = base_wind['cr_z']
    context['kr_z'] = base_wind['kr_z']
    if base_wind.get('vb_m_s') is not None:
        context['vb_m_s'] = base_wind['vb_m_s']

    site_info = input_data.get('site', {})
    client_logo_url = site_info.get('client_logo_url')
    client_logo_abs = safe_media_path(client_logo_url) if client_logo_url else None
    context['client_logo_abs'] = client_logo_abs if (client_logo_abs and os.path.exists(client_logo_abs)) else None

    logo_path = os.path.join(settings.MEDIA_ROOT, 'uploads', 'logo_cometa.png')
    context['logo_abs'] = logo_path if os.path.exists(logo_path) else None

    def _render_and_save(template_name, equipment_context):
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

    td_eq = input_data.get('td_equipment', {})
    operator = normalize_operator(input_data.get('operateur'), fallback_site=input_data.get('site'))
    if td_eq.get('enabled') and operator not in OPERATORS_WITHOUT_TD:
        is_td_sans_plot = bool(td_eq.get('sans_plot') is True or td_eq.get('with_plot') is False)
        td_h_mat = td_eq.get('hauteur_mat_m') if td_eq.get('hauteur_mat_m') is not None else mast_height_m
        td_h_plot = 0.0 if is_td_sans_plot else env.get('plot_height_m')
        z_td = compute_wind_z(
            env.get('building_height_m'),
            td_h_mat,
            h_plot=td_h_plot,
            sans_plot=is_td_sans_plot,
        )
        td_has_echelle = resolve_support_has_echelle(
            input_data,
            None,
            kind="td",
            is_sans_plot=is_td_sans_plot,
            hauteur_mat_m=td_h_mat if td_h_mat is not None else 1.70,
        )
        td_ctx = {
            'eq_qty': 1,
            'eq_dims': '[TD_DIMS]',
            'eq_weight': '[TD_WEIGHT]',
            'td_has_echelle': td_has_echelle,
            'td_sans_plot': is_td_sans_plot,
            'is_sans_plot': is_td_sans_plot,
        }
        if vb is not None and z_td > TERRAIN_Z0.get(terrain_type_str, TERRAIN_Z0['IIIa']):
            td_wind = calculate_wind_params(terrain_type_str, z_td, float(vb))
            td_ctx.update({
                'kr_z': td_wind['kr'],
                'cr_z': td_wind['cr_z'],
                'vm_z': td_wind['vm'],
                'iv_z': td_wind['iv_z'],
                'qp_z': td_wind['qp_dan'],
            })
        generated_pdfs.append(_render_and_save('td', td_ctx))

    fh_eq = input_data.get('fh_equipment', {})
    rru_eq = input_data.get('rru_equipment', {})
    rrh_eq = input_data.get('rrh_equipment', {})
    lovage_eq = input_data.get('boitier_lovage') or input_data.get('lovage_equipment') or {}
    res_data = getattr(job, 'result_data', {}) if job else {}
    if not isinstance(res_data, dict):
        res_data = {}
    calc_type = str(getattr(job, 'calculation_type', '') if job else '').lower()
    active_eqs = res_data.get('active_equipments') if isinstance(res_data.get('active_equipments'), list) else []

    # Check each equipment section independently (`if is_rrh_active:`, `if is_rru_active:`, `if is_fh_active:`)
    # and append in the canonical worker stage order:
    # 1. RRH section (if has_rrh) OR RRU section (if has_rru)
    # 2. FH section (if has_fh)
    has_rrh_result = (
        res_data.get('has_rrh') is True
        or 'rrh' in active_eqs
        or ('rrh' in res_data and isinstance(res_data['rrh'], dict))
        or bool(res_data.get('rrh_items'))
        or bool(res_data.get('rrh_totals'))
    )
    is_rrh_calc = bool(
        input_data.get('is_rrh')
        or 'rrh' in calc_type.split('_')
        or getattr(job, 'note_de_calcul_rrh', None)
    )
    is_rrh_active = (
        res_data.get('has_rrh') is not False
        and ((isinstance(rrh_eq, dict) and rrh_eq.get('enabled')) or has_rrh_result or is_rrh_calc)
    )

    has_rru_result = (
        res_data.get('has_rru') is True
        or 'rru' in active_eqs
        or ('rru' in res_data and isinstance(res_data['rru'], dict))
        or bool(res_data.get('rru_items'))
        or bool(res_data.get('rru_totals'))
    )
    is_rru_calc = bool(input_data.get('is_rru') or 'rru' in calc_type.split('_'))
    is_rru_active = (
        not is_rrh_active
        and res_data.get('has_rru') is not False
        and ((isinstance(rru_eq, dict) and rru_eq.get('enabled')) or has_rru_result or is_rru_calc)
    )

    has_fh_result = (
        res_data.get('has_fh') is True
        or 'fh' in active_eqs
        or ('fh' in res_data and isinstance(res_data['fh'], dict))
        or bool(res_data.get('fh_items'))
        or bool(res_data.get('fh_totals'))
    )
    is_fh_calc = bool(input_data.get('is_fh') or 'fh' in calc_type.split('_'))
    is_fh_active = (
        res_data.get('has_fh') is not False
        and ((isinstance(fh_eq, dict) and fh_eq.get('enabled')) or has_fh_result or is_fh_calc)
    )

    has_lovage_result = (
        res_data.get('has_lovage') is True
        or 'lovage' in active_eqs
        or ('lovage' in res_data and isinstance(res_data['lovage'], dict))
        or bool(res_data.get('lovage_items'))
        or bool(res_data.get('lovage_totals'))
    )
    is_lovage_calc = bool(input_data.get('is_lovage') or 'lovage' in calc_type.split('_'))
    is_lovage_active = (
        res_data.get('has_lovage') is not False
        and ((isinstance(lovage_eq, dict) and lovage_eq.get('enabled')) or has_lovage_result or is_lovage_calc)
    )

    def _get_or_convert_rtf_images(key_prefix, rtf_abs, convert_dir, is_assemblage=False):
        if preconverted_images and key_prefix in preconverted_images and preconverted_images[key_prefix]:
            return preconverted_images[key_prefix]
        if rtf_abs and os.path.exists(rtf_abs):
            try:
                return _convert_rtf_file_to_images(rtf_abs, convert_dir, key_prefix, is_assemblage=is_assemblage)
            except Exception as e:
                logger.warning("Failed to convert %s RTF to images: %s", key_prefix, e)
        return []

    ws_dir = _worker_screenshots_dir()

    # 1. Check for RRH (Stage 2a)
    if is_rrh_active:
        try:
            qp_val = float(context.get('qp_z', 0))
        except (ValueError, TypeError):
            qp_val = 0.0

        rrh_ctx = extract_rrh_ndc_context(res_data, input_data=input_data, qp_val=qp_val)
        items = rrh_ctx['items']
        totals = rrh_ctx['totals']
        wind_p = rrh_ctx['wind']
        is_multi = rrh_ctx['is_multi']
        qty_total = rrh_ctx['qty_total']

        first_item = items[0] if items else {}
        eq_dims = first_item.get('dimensions_str', '[RRH_DIMS]')
        eq_weight = first_item.get('weight_kg', '[RRH_WEIGHT]')
        cx_front = first_item.get('cf_front', 0.1352)
        cx_lat = first_item.get('cf_lat', 0.0523)
        fw_front = (
            totals.get('fw_front')
            if totals.get('fw_front') is not None
            else (
                wind_p.get('fw_front')
                if wind_p.get('fw_front') is not None
                else (round(cx_front * qp_val, 2) if qp_val else '[Fw,Front]')
            )
        )
        fw_lat = (
            totals.get('fw_lat')
            if totals.get('fw_lat') is not None
            else (
                wind_p.get('fw_lat')
                if wind_p.get('fw_lat') is not None
                else (round(cx_lat * qp_val, 2) if qp_val else '[Fw,Lat]')
            )
        )

        worker_rrh = res_data.get('rrh', {}) if isinstance(res_data.get('rrh'), dict) else {}
        extremes = rrh_ctx.get('extremes') or worker_rrh.get('extremes', {}) or res_data.get('extremes', {})
        struct_p = rrh_ctx.get('structure') or get_support_structure_params(res_data, 'rrh')

        res_d = getattr(job, 'result_data', {}) if isinstance(getattr(job, 'result_data', None), dict) else {}
        inp_d = getattr(job, 'input_data', {}) if isinstance(getattr(job, 'input_data', None), dict) else (input_data if isinstance(input_data, dict) else {})
        is_rrh_sans_plot = resolve_sans_plot(
            inp_d,
            res_d,
            calc_type=getattr(job, "calculation_type", ""),
            kind="rrh",
        )

        rrh_mat_section = struct_p.get('mast_section') or 'TRON 88x3.2'
        if is_rrh_sans_plot:
            rrh_plot_section = None
            rrh_plot_longueur_m = 0.0
        else:
            rrh_plot_section = struct_p.get('plot_section') or context.get('plot_section')
            rrh_plot_longueur_m = (
                struct_p.get('plot_h_m')
                if struct_p.get('plot_h_m') is not None
                else context.get('plot_longueur_m')
            )
        rrh_mat_longueur_m = get_support_mast_height_m(
            res_data, 'rrh',
            fallback_h=struct_p.get('hauteur_mat_m') or (input_data.get('rrh_equipment') or {}).get('hauteur_mat_m', 1.50)
        )

        rrh_wind = _resolve_support_wind_params(
            wind_p,
            context,
            env,
            vb,
            rrh_plot_longueur_m,
            rrh_mat_longueur_m,
            sans_plot=is_rrh_sans_plot,
        )
        rrh_qp_z = rrh_wind['qp_z']

        try:
            rrh_mat_longueur = int(round(float(rrh_mat_longueur_m) * 1000))
        except (ValueError, TypeError):
            rrh_mat_longueur = 1500

        m_diam, m_ep = parse_dimensions(rrh_mat_section)
        try:
            rrh_mat_diam = m_diam or (int(float(struct_p.get('mast_d_m')) * 1000) if struct_p.get('mast_d_m') else context.get('mat_diam'))
        except (ValueError, TypeError):
            rrh_mat_diam = context.get('mat_diam')

        try:
            rrh_mat_epaisseur = m_ep or (round(float(struct_p.get('mast_t_m')) * 1000, 1) if struct_p.get('mast_t_m') else context.get('mat_epaisseur'))
        except (ValueError, TypeError):
            rrh_mat_epaisseur = context.get('mat_epaisseur')

        rrh_cf_mat = struct_p.get('cf_mast') or wind_p.get('cf_mast') or 1.0
        try:
            m_diam_m = float(
                struct_p.get('mast_d_m')
                or (float(rrh_mat_diam) / 1000.0 if rrh_mat_diam and str(rrh_mat_diam).replace('.', '').isdigit() else 0.088)
            )
        except (ValueError, TypeError):
            m_diam_m = 0.088

        if wind_p.get('fw_mast') is not None:
            fw_mat = wind_p.get('fw_mast')
        else:
            try:
                fw_mat = round(1.0 * float(rrh_cf_mat) * m_diam_m * float(rrh_qp_z or context.get('qp_z', 0)), 2)
            except (ValueError, TypeError):
                fw_mat = '[Fw,Mat]'

        rrh_files = res_data.get('rrh_files') if isinstance(res_data.get('rrh_files'), dict) else {}
        rrh_screenshot_abs = None
        if job and getattr(job, 'rrh_screenshot', None) and job.rrh_screenshot:
            try:
                if os.path.exists(job.rrh_screenshot.path):
                    rrh_screenshot_abs = job.rrh_screenshot.path
            except Exception:
                pass
        if not rrh_screenshot_abs and job:
            rrh_screenshot_abs = _first_existing_file([
                rrh_files.get('rrh_screenshot'),
                f"{ws_dir}/job_{job.id}_rrh_3d_view.jpg",
                os.path.join(settings.MEDIA_ROOT, 'screenshots_rrh', f'job_{job.id}_rrh_3d_view.jpg'),
            ])

        rrh_tableau_charges_abs = None
        if job and getattr(job, 'rrh_tableau_charges', None) and job.rrh_tableau_charges:
            try:
                if os.path.exists(job.rrh_tableau_charges.path):
                    rrh_tableau_charges_abs = job.rrh_tableau_charges.path
            except Exception:
                pass
        if not rrh_tableau_charges_abs and job:
            rrh_tableau_charges_abs = _first_existing_file([
                rrh_files.get('rrh_tableau_charges'),
                f"{ws_dir}/job_{job.id}_rrh_tableau_charges.png",
                os.path.join(settings.MEDIA_ROOT, 'charges_rrh', f'job_{job.id}_rrh_tableau_charges.png'),
            ])
        rrh_tableau_charges_abs = _crop_tableau_charges_image(rrh_tableau_charges_abs)

        rrh_verification_screenshot_abs = None
        if job and getattr(job, 'rrh_verification_screenshot', None) and job.rrh_verification_screenshot:
            try:
                if os.path.exists(job.rrh_verification_screenshot.path):
                    rrh_verification_screenshot_abs = job.rrh_verification_screenshot.path
            except Exception:
                pass
        if not rrh_verification_screenshot_abs and job:
            rrh_verification_screenshot_abs = _first_existing_file([
                rrh_files.get('rrh_verification_screenshot'),
                f"{ws_dir}/job_{job.id}_rrh_verification.jpg",
                os.path.join(settings.MEDIA_ROOT, 'verif_rrh', f'job_{job.id}_rrh_verification.jpg'),
            ])

        rrh_paths = find_job_rrh_rtf_paths(job)
        rrh_convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_rrh')
        job_id_lbl = job.id if job else 'preview'
        rrh_note_mat_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_rrh_note_mat", rrh_paths.get('note_mat'), rrh_convert_dir)
        rrh_note_plot_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_rrh_note_plot", rrh_paths.get('note_plot'), rrh_convert_dir)
        rrh_assemblage_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_rrh_assemblage", rrh_paths.get('assemblage_note'), rrh_convert_dir, is_assemblage=True)

        if job and job.id != 'preview' and job.id != 'fast':
            missing_rrh = []
            if not rrh_screenshot_abs or not os.path.exists(rrh_screenshot_abs):
                missing_rrh.append("Capture 3D modélisation RRH (page 14)")
            if not rrh_tableau_charges_abs or not os.path.exists(rrh_tableau_charges_abs):
                missing_rrh.append("Tableau des charges RRH (page 15)")
            if not rrh_verification_screenshot_abs or not os.path.exists(rrh_verification_screenshot_abs):
                missing_rrh.append("Capture de vérification Robot RRH (page 16)")
            if not rrh_note_mat_images:
                missing_rrh.append("Note de calcul RTF du mât RRH (page 17)")
            if not is_rrh_sans_plot and not rrh_assemblage_images:
                missing_rrh.append("Note d'assemblage Robot RRH (page 21+)")

            if missing_rrh:
                err_msg = f"Génération annexe RRH bloquée pour le Job {job.id} : artéfacts obligatoires manquants ({', '.join(missing_rrh)})."
                logger.error("[NDC HARDENING ERROR] %s", err_msg)
                raise ValueError(err_msg)

        generated_pdfs.append(_render_and_save('rrh', {
            'region': rrh_wind['region'],
            'terrain_type': rrh_wind['terrain_type'],
            'building_height': rrh_wind['building_height'],
            'vb_m_s': rrh_wind['vb_m_s'],
            'cr_z': rrh_wind['cr_z'],
            'vm_z': rrh_wind['vm_z'],
            'iv_z': rrh_wind['iv_z'],
            'kr_z': rrh_wind['kr_z'],
            'qp_z': rrh_qp_z,
            'eq_qty': qty_total,
            'rrh_name': clean_equipment_designation(first_item.get('name', 'RRH')),
            'eq_dims': eq_dims,
            'eq_weight': eq_weight,
            'cx_front': cx_front,
            'cx_lat': cx_lat,
            'fw_front': fw_front,
            'fw_lat': fw_lat,
            'fw_mat': fw_mat,
            'extremes': extremes,
            'rrh_mat_section': rrh_mat_section,
            'rrh_mat_diam': rrh_mat_diam,
            'rrh_mat_epaisseur': rrh_mat_epaisseur,
            'rrh_mat_longueur': rrh_mat_longueur,
            'rrh_mat_longueur_m': rrh_mat_longueur_m,
            'rrh_plot_section': rrh_plot_section,
            'rrh_plot_longueur_m': rrh_plot_longueur_m,
            'rrh_mat_diam_m': f"{m_diam_m:.3f}" if isinstance(m_diam_m, (int, float)) else "0.088",
            'rrh_cf_mat': rrh_cf_mat,
            'rrh_screenshot_abs': rrh_screenshot_abs,
            'rrh_tableau_charges_abs': rrh_tableau_charges_abs,
            'rrh_verification_screenshot_abs': rrh_verification_screenshot_abs,
            'rrh_note_mat_images': rrh_note_mat_images,
            'rrh_note_plot_images': rrh_note_plot_images,
            'rrh_assemblage_images': rrh_assemblage_images,
            'rrh_items': items,
            'rrh_totals': totals,
            'rrh_is_multi': is_multi,
            'rrh_qty_total': qty_total,
            'is_sans_plot': is_rrh_sans_plot,
            'rrh_has_echelle': resolve_support_has_echelle(input_data, res_data, kind="rrh", hauteur_mat_m=rrh_mat_longueur_m),
        }))

    # 2. Check for RRU (Stage 2b)
    if is_rru_active:
        try:
            qp_val = float(context.get('qp_z', 0))
        except (ValueError, TypeError):
            qp_val = 0.0

        rru_ctx = extract_rru_ndc_context(res_data, input_data=input_data, qp_val=qp_val)
        items = rru_ctx['items']
        totals = rru_ctx['totals']
        wind_p = rru_ctx['wind']
        is_multi = rru_ctx['is_multi']
        qty_total = rru_ctx['qty_total']
        rru_sans_plot = rru_ctx['is_sans_plot']

        first_item = items[0] if items else {}
        eq_dims = first_item.get('dimensions_str', '[RRU_DIMS]')
        eq_weight = first_item.get('weight_kg', '[RRU_WEIGHT]')
        cx_front = first_item.get('cf_front', 1.38)
        cx_lat = first_item.get('cf_lat', 1.11)
        fw_front = (
            totals.get('fw_front')
            if totals.get('fw_front') is not None
            else (
                wind_p.get('fw_front')
                if wind_p.get('fw_front') is not None
                else (round(cx_front * qp_val, 2) if qp_val else '[Fw,Front]')
            )
        )
        fw_lat = (
            totals.get('fw_lat')
            if totals.get('fw_lat') is not None
            else (
                wind_p.get('fw_lat')
                if wind_p.get('fw_lat') is not None
                else (round(cx_lat * qp_val, 2) if qp_val else '[Fw,Lat]')
            )
        )

        worker_rru = res_data.get('rru', {}) if isinstance(res_data.get('rru'), dict) else {}
        extremes = rru_ctx.get('extremes') or worker_rru.get('extremes', {}) or res_data.get('extremes', {})
        struct_p = rru_ctx.get('structure') or get_support_structure_params(res_data, 'rru')
        is_standalone_rru = bool(input_data.get('is_rru') and not input_data.get('antenna_4g') and not input_data.get('antenna_5g'))

        rru_mat_section = (
            struct_p.get('mast_section')
            or (structure_data.get('mast_section') if is_standalone_rru else None)
            or 'TRON 88x2.5'
        )
        rru_mat_longueur_m = get_support_mast_height_m(
            res_data, 'rru',
            fallback_h=struct_p.get('hauteur_mat_m') or (structure_data.get('hauteur_mat_m') if is_standalone_rru else (input_data.get('rru_equipment') or {}).get('hauteur_mat_m', 1.50))
        )
        if rru_sans_plot:
            rru_plot_section = 'Sans plot'
            rru_plot_longueur_m = 0
        else:
            rru_plot_section = (
                struct_p.get('plot_section')
                or (structure_data.get('plot_section') if is_standalone_rru else None)
                or 'TCAR 150x5'
            )
            rru_plot_longueur_m = (
                struct_p.get('plot_h_m')
                if struct_p.get('plot_h_m') is not None
                else (structure_data.get('plot_h_m') if is_standalone_rru and structure_data.get('plot_h_m') is not None else 0.5)
            )

        rru_wind = _resolve_support_wind_params(
            wind_p,
            context,
            env,
            vb,
            rru_plot_longueur_m,
            rru_mat_longueur_m,
            sans_plot=rru_sans_plot,
        )
        rru_qp_z = rru_wind['qp_z']

        if (not wind_p.get('qp_dan')) and rru_qp_z and rru_qp_z != '[qp]':
            try:
                rru_qp_num = float(rru_qp_z)
                if rru_qp_num > 0 and rru_qp_num != qp_val:
                    rru_ctx = extract_rru_ndc_context(res_data, input_data=input_data, qp_val=rru_qp_num)
                    items = rru_ctx['items']
                    totals = rru_ctx['totals']
                    first_item = items[0] if items else {}
                    fw_front = totals.get('fw_front', fw_front)
                    fw_lat = totals.get('fw_lat', fw_lat)
            except (ValueError, TypeError):
                pass

        try:
            rru_mat_longueur = int(round(float(rru_mat_longueur_m) * 1000))
        except (ValueError, TypeError):
            rru_mat_longueur = 1500

        m_diam, m_ep = parse_dimensions(rru_mat_section)
        try:
            rru_mat_diam = m_diam or (int(float(struct_p.get('mast_d_m')) * 1000) if struct_p.get('mast_d_m') else '88')
        except (ValueError, TypeError):
            rru_mat_diam = '88'

        try:
            rru_mat_epaisseur = m_ep or (round(float(struct_p.get('mast_t_m')) * 1000, 1) if struct_p.get('mast_t_m') else '2.5')
        except (ValueError, TypeError):
            rru_mat_epaisseur = '2.5'

        rru_cf_mat = struct_p.get('cf_mast') or wind_p.get('cf_mast') or 1.0
        try:
            m_diam_m = float(
                struct_p.get('mast_d_m')
                or (float(rru_mat_diam) / 1000.0 if rru_mat_diam and str(rru_mat_diam).replace('.', '').isdigit() else 0.088)
            )
        except (ValueError, TypeError):
            m_diam_m = 0.088

        if wind_p.get('fw_mast') is not None:
            fw_mat = wind_p.get('fw_mast')
        else:
            try:
                fw_mat = round(1.0 * float(rru_cf_mat) * m_diam_m * float(rru_qp_z or context.get('qp_z', 0)), 2)
            except (ValueError, TypeError):
                fw_mat = '[Fw,Mat]'

        rru_files = res_data.get('rru_files') if isinstance(res_data.get('rru_files'), dict) else {}

        rru_screenshot_abs = _first_existing_file([
            rru_files.get('rru_screenshot'),
            rru_files.get('screenshot'),
            res_data.get('rru_screenshot_path'),
            worker_rru.get('screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'screenshots_rru', f'job_{job.id}_rru_3d_view.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'screenshots_rru', f'job_{job.id}_rru_3d_view.png') if job else None,
            f"{ws_dir}/job_{job.id}_rru_3d_view.jpg" if job else None,
            f"{ws_dir}/job_{job.id}_rru_3d_view.png" if job else None,
            os.path.join(settings.MEDIA_ROOT, 'screenshots_rrh', f'job_{job.id}_rru_3d_view.jpg') if job else None,
        ])

        rru_tableau_charges_abs = _first_existing_file([
            rru_files.get('rru_tableau_charges'),
            rru_files.get('tableau_charges'),
            res_data.get('rru_tableau_charges_path'),
            worker_rru.get('tableau_charges_path'),
            os.path.join(settings.MEDIA_ROOT, 'charges_rru', f'job_{job.id}_rru_tableau_charges.png') if job else None,
            f"{ws_dir}/job_{job.id}_rru_tableau_charges.png" if job else None,
            os.path.join(settings.MEDIA_ROOT, 'charges_rrh', f'job_{job.id}_rru_tableau_charges.png') if job else None,
        ])
        rru_tableau_charges_abs = _crop_tableau_charges_image(rru_tableau_charges_abs)

        rru_verification_screenshot_abs = _first_existing_file([
            rru_files.get('rru_verification_screenshot'),
            rru_files.get('verification_screenshot'),
            res_data.get('rru_verification_screenshot_path'),
            worker_rru.get('verification_screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'verif_rru', f'job_{job.id}_rru_verification.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'verif_rru', f'job_{job.id}_rru_verification.png') if job else None,
            f"{ws_dir}/job_{job.id}_rru_verification.jpg" if job else None,
            f"{ws_dir}/job_{job.id}_rru_verification.png" if job else None,
            os.path.join(settings.MEDIA_ROOT, 'verif_rrh', f'job_{job.id}_rru_verification.jpg') if job else None,
        ])

        rru_paths = find_job_rru_rtf_paths(job)
        rru_convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_rru')
        job_id_lbl = job.id if job else 'preview'
        rru_note_mat_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_rru_note_mat", rru_paths.get('note_mat'), rru_convert_dir)
        rru_note_plot_images = [] if rru_sans_plot else _get_or_convert_rtf_images(f"job_{job_id_lbl}_rru_note_plot", rru_paths.get('note_plot'), rru_convert_dir)
        rru_assemblage_images = [] if rru_sans_plot else _get_or_convert_rtf_images(f"job_{job_id_lbl}_rru_assemblage", rru_paths.get('assemblage_note'), rru_convert_dir, is_assemblage=True)

        generated_pdfs.append(_render_and_save('rru', {
            'region': rru_wind['region'],
            'terrain_type': rru_wind['terrain_type'],
            'building_height': rru_wind['building_height'],
            'vb_m_s': rru_wind['vb_m_s'],
            'cr_z': rru_wind['cr_z'],
            'vm_z': rru_wind['vm_z'],
            'iv_z': rru_wind['iv_z'],
            'kr_z': rru_wind['kr_z'],
            'qp_z': rru_qp_z,
            'eq_qty': qty_total,
            'rru_name': clean_equipment_designation(first_item.get('name', 'RRU')),
            'eq_dims': eq_dims,
            'eq_weight': eq_weight,
            'cx_front': cx_front,
            'cx_lat': cx_lat,
            'fw_front': fw_front,
            'fw_lat': fw_lat,
            'fw_mat': fw_mat,
            'extremes': extremes,
            'rru_sans_plot': rru_sans_plot,
            'rru_mat_section': rru_mat_section,
            'rru_mat_diam': rru_mat_diam,
            'rru_mat_epaisseur': rru_mat_epaisseur,
            'rru_mat_longueur': rru_mat_longueur,
            'rru_mat_longueur_m': rru_mat_longueur_m,
            'rru_plot_section': rru_plot_section,
            'rru_plot_longueur_m': rru_plot_longueur_m,
            'rru_mat_diam_m': f"{m_diam_m:.3f}" if isinstance(m_diam_m, (int, float)) else "0.088",
            'rru_cf_mat': rru_cf_mat,
            'rru_screenshot_abs': rru_screenshot_abs,
            'rru_tableau_charges_abs': rru_tableau_charges_abs,
            'rru_verification_screenshot_abs': rru_verification_screenshot_abs,
            'rru_note_mat_images': rru_note_mat_images,
            'rru_note_plot_images': rru_note_plot_images,
            'rru_assemblage_images': rru_assemblage_images,
            'rru_items': items,
            'rru_totals': totals,
            'rru_is_multi': is_multi,
            'rru_qty_total': qty_total,
            'rru_has_echelle': resolve_support_has_echelle(input_data, res_data, kind="rru", hauteur_mat_m=rru_mat_longueur_m),
        }))

    # 3. Check for FH (Stage 3: Faisceau Hertzien)
    if is_fh_active:
        try:
            qp_val = float(context.get('qp_z', 0))
        except (ValueError, TypeError):
            qp_val = 0.0

        fh_ctx = extract_fh_ndc_context(res_data, input_data=input_data, qp_val=qp_val)
        items = fh_ctx['items']
        totals = fh_ctx['totals']
        wind_p = fh_ctx['wind']
        is_multi = fh_ctx['is_multi']
        qty_total = fh_ctx['qty_total']
        is_fh_sans_plot = fh_ctx['is_sans_plot']

        first_item = items[0] if items else {}
        eq_dims = first_item.get('dimensions_str', 'Ø600')
        eq_weight = first_item.get('weight_unit_kg', '15')
        fw_fh = (
            totals.get('fw_fh')
            if totals.get('fw_fh') is not None
            else (
                wind_p.get('fw_fh')
                if wind_p.get('fw_fh') is not None
                else (wind_p.get('fw_front') if wind_p.get('fw_front') is not None else 0.0)
            )
        )

        worker_fh = res_data.get('fh', {}) if isinstance(res_data.get('fh'), dict) else {}
        extremes = fh_ctx.get('extremes') or worker_fh.get('extremes', {}) or res_data.get('extremes', {})
        struct_p = fh_ctx.get('structure') or get_support_structure_params(res_data, 'fh')
        is_standalone_fh = bool(input_data.get('is_fh') and not input_data.get('antenna_4g') and not input_data.get('antenna_5g') and not is_rrh_active and not is_rru_active)

        fh_mat_section = (
            struct_p.get('mast_section')
            or (input_data.get('structure_fh') or {}).get('mast_section')
            or (structure_data.get('mast_section') if is_standalone_fh else None)
            or FH_DEFAULT_MAST_SECTION
        )
        fh_mat_longueur_m = get_support_mast_height_m(
            res_data, 'fh',
            fallback_h=struct_p.get('hauteur_mat_m') or (structure_data.get('hauteur_mat_m') if is_standalone_fh else (input_data.get('fh_equipment') or {}).get('hauteur_mat_m', 1.70))
        )
        fh_has_echelle = resolve_support_has_echelle(input_data, res_data, kind="fh", hauteur_mat_m=fh_mat_longueur_m)

        if is_fh_sans_plot:
            fh_plot_section = None
            fh_plot_longueur_m = 0.0
        else:
            fh_plot_section = (
                struct_p.get('plot_section')
                or (structure_data.get('plot_section') if is_standalone_fh else None)
                or 'TCAR 150x5'
            )
            fh_plot_longueur_m = (
                struct_p.get('plot_h_m')
                if struct_p.get('plot_h_m') is not None
                else (structure_data.get('plot_h_m') if is_standalone_fh and structure_data.get('plot_h_m') is not None else 0.50)
            )

        fh_wind = _resolve_support_wind_params(
            wind_p,
            context,
            env,
            vb,
            fh_plot_longueur_m,
            fh_mat_longueur_m,
            sans_plot=is_fh_sans_plot,
        )
        fh_qp_z = fh_wind['qp_z']

        if (not wind_p.get('qp_dan')) and fh_qp_z and fh_qp_z != '[qp]':
            try:
                fh_qp_num = float(fh_qp_z)
                if fh_qp_num > 0 and fh_qp_num != qp_val:
                    fh_ctx = extract_fh_ndc_context(res_data, input_data=input_data, qp_val=fh_qp_num)
                    items = fh_ctx['items']
                    totals = fh_ctx['totals']
                    fw_fh = totals.get('fw_fh', fw_fh)
            except (ValueError, TypeError):
                pass

        try:
            fh_mat_longueur = int(round(float(fh_mat_longueur_m) * 1000))
        except (ValueError, TypeError):
            fh_mat_longueur = 1700

        fh_profile = resolve_fh_mast_profile(fh_mat_section)
        m_diam, m_ep = parse_dimensions(fh_mat_section)
        try:
            if struct_p.get('diam_mm') is not None:
                fh_mat_diam = f"{float(struct_p['diam_mm']):g}"
            elif struct_p.get('mast_d_m') is not None:
                fh_mat_diam = f"{float(struct_p['mast_d_m']) * 1000:g}"
            else:
                fh_mat_diam = m_diam or f"{fh_profile['diam_mm']:g}"
        except (ValueError, TypeError):
            fh_mat_diam = m_diam or f"{fh_profile['diam_mm']:g}"
        if str(fh_mat_diam).strip() == '114':
            fh_mat_diam = '114.3'
        elif str(fh_mat_diam).strip() == '88':
            fh_mat_diam = '88.9'

        try:
            if struct_p.get('thickness_mm') is not None:
                fh_mat_epaisseur = f"{float(struct_p['thickness_mm']):g}"
            elif struct_p.get('mast_t_m') is not None:
                fh_mat_epaisseur = round(float(struct_p['mast_t_m']) * 1000, 1)
            else:
                fh_mat_epaisseur = m_ep or f"{fh_profile['thickness_mm']:g}"
        except (ValueError, TypeError):
            fh_mat_epaisseur = m_ep or f"{fh_profile['thickness_mm']:g}"

        fh_cf_mat = struct_p.get('cf_mast') or wind_p.get('cf_mast') or 1.0
        try:
            if wind_p.get('mast_d_formula') is not None:
                m_diam_m = float(wind_p['mast_d_formula'])
            elif struct_p.get('mast_d_m') is not None:
                m_diam_m = float(struct_p['mast_d_m'])
            else:
                m_diam_m = float(
                    float(fh_mat_diam) / 1000.0
                    if fh_mat_diam and str(fh_mat_diam).replace('.', '').isdigit()
                    else fh_profile['mast_d_m']
                )
        except (ValueError, TypeError):
            m_diam_m = fh_profile['mast_d_m']

        if wind_p.get('fw_mast') is not None:
            fw_mat = wind_p.get('fw_mast')
        else:
            try:
                fw_mat = round(1.0 * float(fh_cf_mat) * m_diam_m * float(fh_qp_z or context.get('qp_z', 0)), 2)
            except (ValueError, TypeError):
                fw_mat = '[Fw,Mat]'

        fh_files = res_data.get('fh_files') if isinstance(res_data.get('fh_files'), dict) else {}

        fh_screenshot_abs = _first_existing_file([
            getattr(job.fh_screenshot, 'path', None) if getattr(job, 'fh_screenshot', None) else None,
            getattr(job.screenshot, 'path', None) if getattr(job, 'screenshot', None) and is_standalone_fh else None,
            fh_files.get('fh_screenshot'),
            fh_files.get('screenshot'),
            res_data.get('fh_screenshot_path'),
            worker_fh.get('screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'screenshots_fh', f'job_{job.id}_fh_3d_view.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'screenshots_fh', f'job_{job.id}_fh_3d_view.png') if job else None,
            f"{ws_dir}/job_{job.id}_fh_3d_view.jpg" if job else None,
        ])

        fh_tableau_charges_abs = _first_existing_file([
            getattr(job.fh_tableau_charges, 'path', None) if getattr(job, 'fh_tableau_charges', None) else None,
            fh_files.get('fh_tableau_charges'),
            fh_files.get('tableau_charges'),
            fh_files.get('fh_loads_table'),
            res_data.get('fh_tableau_charges_path'),
            worker_fh.get('tableau_charges_path'),
            os.path.join(settings.MEDIA_ROOT, 'charges_fh', f'job_{job.id}_fh_tableau_charges.png') if job else None,
            f"{ws_dir}/job_{job.id}_fh_tableau_charges.png" if job else None,
        ])
        fh_tableau_charges_abs = _crop_tableau_charges_image(fh_tableau_charges_abs)

        fh_verification_screenshot_abs = _first_existing_file([
            getattr(job.fh_verification_screenshot, 'path', None) if getattr(job, 'fh_verification_screenshot', None) else None,
            getattr(job.verification_screenshot, 'path', None) if getattr(job, 'verification_screenshot', None) and is_standalone_fh else None,
            fh_files.get('fh_verification_screenshot'),
            fh_files.get('verification_screenshot'),
            res_data.get('fh_verification_screenshot_path'),
            worker_fh.get('verification_screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'verif_fh', f'job_{job.id}_fh_verification.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'verif_fh', f'job_{job.id}_fh_verification.png') if job else None,
            f"{ws_dir}/job_{job.id}_fh_verification.jpg" if job else None,
        ])

        fh_paths = find_job_fh_rtf_paths(job)
        fh_convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_fh')
        job_id_lbl = job.id if job else 'preview'
        fh_note_mat_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_fh_note_mat", fh_paths.get('note_mat'), fh_convert_dir)
        fh_note_plot_images = [] if is_fh_sans_plot else _get_or_convert_rtf_images(f"job_{job_id_lbl}_fh_note_plot", fh_paths.get('note_plot'), fh_convert_dir)
        fh_assemblage_images = [] if is_fh_sans_plot else _get_or_convert_rtf_images(f"job_{job_id_lbl}_fh_assemblage", fh_paths.get('assemblage_note'), fh_convert_dir, is_assemblage=True)

        if job and job.id != 'preview' and job.id != 'fast' and getattr(job, 'status', None) == 'COMPLETED':
            missing_fh = []
            if not fh_screenshot_abs or not os.path.exists(fh_screenshot_abs):
                missing_fh.append("Capture 3D modélisation FH")
            if not fh_tableau_charges_abs or not os.path.exists(fh_tableau_charges_abs):
                missing_fh.append("Tableau des charges FH")
            if not fh_verification_screenshot_abs or not os.path.exists(fh_verification_screenshot_abs):
                missing_fh.append("Capture de vérification Robot FH")
            if not fh_note_mat_images:
                missing_fh.append("Note de calcul RTF du mât FH")
            if not is_fh_sans_plot and not fh_assemblage_images:
                missing_fh.append("Note d'assemblage Robot FH")

            if missing_fh:
                err_msg = f"Génération annexe FH bloquée pour le Job {job.id} : artéfacts obligatoires manquants ({', '.join(missing_fh)})."
                logger.error("[NDC HARDENING ERROR] %s", err_msg)
                raise ValueError(err_msg)

        generated_pdfs.append(_render_and_save('fh', {
            'region': fh_wind['region'],
            'terrain_type': fh_wind['terrain_type'],
            'building_height': fh_wind['building_height'],
            'vb_m_s': fh_wind['vb_m_s'],
            'cr_z': fh_wind['cr_z'],
            'vm_z': fh_wind['vm_z'],
            'iv_z': fh_wind['iv_z'],
            'kr_z': fh_wind['kr_z'],
            'qp_z': fh_qp_z,
            'eq_qty': qty_total,
            'fh_name': clean_fh_designation(first_item.get('name', 'FH')),
            'eq_dims': eq_dims,
            'eq_weight': eq_weight,
            'fw_fh': fw_fh,
            'fw_mat': fw_mat,
            'extremes': extremes,
            'fh_sans_plot': is_fh_sans_plot,
            'is_sans_plot': is_fh_sans_plot,
            'fh_has_echelle': fh_has_echelle,
            'fh_mat_section': fh_mat_section,
            'fh_mat_diam': fh_mat_diam,
            'fh_mat_epaisseur': fh_mat_epaisseur,
            'fh_mat_longueur': fh_mat_longueur,
            'fh_mat_longueur_m': fh_mat_longueur_m,
            'fh_plot_section': fh_plot_section,
            'fh_plot_longueur_m': fh_plot_longueur_m,
            'fh_mat_diam_m': f"{m_diam_m:g}" if isinstance(m_diam_m, (int, float)) else "0.1143",
            'fh_cf_mat': fh_cf_mat,
            'fh_screenshot_abs': fh_screenshot_abs,
            'fh_tableau_charges_abs': fh_tableau_charges_abs,
            'fh_verification_screenshot_abs': fh_verification_screenshot_abs,
            'fh_note_mat_images': fh_note_mat_images,
            'fh_note_plot_images': fh_note_plot_images,
            'fh_assemblage_images': fh_assemblage_images,
            'fh_items': items,
            'fh_totals': totals,
            'fh_is_multi': is_multi,
            'fh_qty_total': qty_total,
        }))

    # 4. Check for Boîtier de Lovage (Zone Technique)
    if is_lovage_active:
        try:
            qp_val = float(context.get('qp_z', 0))
        except (ValueError, TypeError):
            qp_val = 0.0

        lovage_ctx = extract_lovage_ndc_context(res_data, input_data=input_data, qp_val=qp_val)
        items = lovage_ctx['items']
        totals = lovage_ctx['totals']
        wind_p = lovage_ctx['wind']
        is_multi = lovage_ctx['is_multi']
        qty_total = lovage_ctx['qty_total']
        is_lovage_sans_plot = lovage_ctx['is_sans_plot']
        has_gps = lovage_ctx['has_gps']
        has_mdea = lovage_ctx['has_mdea']
        gps_item = lovage_ctx['gps_item']
        mdea_item = lovage_ctx['mdea_item']
        lovage_variant = lovage_ctx['lovage_variant']

        first_item = items[0] if items else {}
        eq_dims = first_item.get('dimensions_str', 'N/A')
        eq_weight = first_item.get('weight_unit_kg', 'N/A')
        cf_front = first_item.get('cf_front', LOVAGE_CF_FRONT)
        cf_lat = first_item.get('cf_lat', LOVAGE_CF_LAT)
        fw_front = totals.get('fw_front', 0.0)
        fw_lat = totals.get('fw_lat', 0.0)

        worker_lovage = res_data.get('lovage', {}) if isinstance(res_data.get('lovage'), dict) else {}
        extremes = lovage_ctx.get('extremes') or worker_lovage.get('extremes', {}) or res_data.get('extremes', {})
        struct_p = lovage_ctx.get('structure') or get_support_structure_params(res_data, 'lovage')
        is_standalone_lovage = bool(
            (input_data.get('is_lovage') or 'lovage' in calc_type.split('_'))
            and not input_data.get('antenna_4g')
            and not input_data.get('antenna_5g')
            and not is_rrh_active
            and not is_rru_active
            and not is_fh_active
        )

        lovage_mat_section = (
            struct_p.get('mast_section')
            or (structure_data.get('mast_section') if is_standalone_lovage else None)
            or LOVAGE_DEFAULT_MAST_SECTION
        )
        lovage_mat_longueur_m = get_support_mast_height_m(
            res_data,
            'lovage',
            fallback_h=(
                struct_p.get('hauteur_mat_m')
                if struct_p.get('hauteur_mat_m') is not None
                else (
                    structure_data.get('hauteur_mat_m')
                    if is_standalone_lovage and structure_data.get('hauteur_mat_m') is not None
                    else (
                        lovage_eq.get('hauteur_mat_m')
                        if isinstance(lovage_eq, dict) and lovage_eq.get('hauteur_mat_m') is not None
                        else LOVAGE_DEFAULT_MAST_HEIGHT_M
                    )
                )
            ),
        )

        if is_lovage_sans_plot:
            lovage_plot_section = None
            lovage_plot_longueur_m = 0.0
        else:
            lovage_plot_section = (
                struct_p.get('plot_section')
                or (structure_data.get('plot_section') if is_standalone_lovage else None)
                or LOVAGE_DEFAULT_PLOT_SECTION
            )
            lovage_plot_longueur_m = (
                struct_p.get('plot_h_m')
                if struct_p.get('plot_h_m') is not None
                else (
                    structure_data.get('plot_h_m')
                    if is_standalone_lovage and structure_data.get('plot_h_m') is not None
                    else LOVAGE_DEFAULT_PLOT_HEIGHT_M
                )
            )

        lovage_wind = _resolve_support_wind_params(
            wind_p,
            context,
            env,
            vb,
            lovage_plot_longueur_m,
            lovage_mat_longueur_m,
            sans_plot=is_lovage_sans_plot,
        )
        lovage_qp_z = lovage_wind['qp_z']

        if (not wind_p.get('qp_dan')) and lovage_qp_z and lovage_qp_z != '[qp]':
            try:
                lovage_qp_num = float(lovage_qp_z)
                if lovage_qp_num > 0 and lovage_qp_num != qp_val:
                    lovage_ctx = extract_lovage_ndc_context(res_data, input_data=input_data, qp_val=lovage_qp_num)
                    items = lovage_ctx['items']
                    totals = lovage_ctx['totals']
                    first_item = items[0] if items else {}
                    fw_front = totals.get('fw_front', fw_front)
                    fw_lat = totals.get('fw_lat', fw_lat)
                    has_gps = lovage_ctx['has_gps']
                    has_mdea = lovage_ctx['has_mdea']
                    gps_item = lovage_ctx['gps_item']
                    mdea_item = lovage_ctx['mdea_item']
                    lovage_variant = lovage_ctx['lovage_variant']
            except (ValueError, TypeError):
                pass

        try:
            lovage_mat_longueur = int(round(float(lovage_mat_longueur_m) * 1000))
        except (ValueError, TypeError):
            lovage_mat_longueur = 1500

        m_diam, m_ep = parse_dimensions(lovage_mat_section)
        try:
            lovage_mat_diam = m_diam or (f"{float(struct_p.get('mast_d_m')) * 1000:g}" if struct_p.get('mast_d_m') else '88.9')
        except (ValueError, TypeError):
            lovage_mat_diam = '88.9'
        if str(lovage_mat_diam).strip() == '88':
            lovage_mat_diam = '88.9'

        try:
            lovage_mat_epaisseur = m_ep or (round(float(struct_p.get('mast_t_m')) * 1000, 1) if struct_p.get('mast_t_m') else '3.2')
        except (ValueError, TypeError):
            lovage_mat_epaisseur = '3.2'

        lovage_cf_mat = struct_p.get('cf_mast') or wind_p.get('cf_mast') or 1.0
        try:
            m_diam_m = float(
                struct_p.get('mast_d_m')
                or (float(lovage_mat_diam) / 1000.0 if lovage_mat_diam and str(lovage_mat_diam).replace('.', '').isdigit() else 0.088)
            )
        except (ValueError, TypeError):
            m_diam_m = 0.088

        if wind_p.get('fw_mast') is not None:
            fw_mat = wind_p.get('fw_mast')
        else:
            try:
                fw_mat = round(1.0 * float(lovage_cf_mat) * m_diam_m * float(lovage_qp_z or context.get('qp_z', 0)), 2)
            except (ValueError, TypeError):
                fw_mat = '[Fw,Mat]'

        lovage_files = res_data.get('lovage_files') if isinstance(res_data.get('lovage_files'), dict) else {}

        lovage_screenshot_abs = _first_existing_file([
            getattr(job.screenshot, 'path', None) if getattr(job, 'screenshot', None) and is_standalone_lovage else None,
            lovage_files.get('lovage_screenshot'),
            lovage_files.get('screenshot'),
            res_data.get('lovage_screenshot_path'),
            worker_lovage.get('screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'screenshots_lovage', f'job_{job.id}_lovage_3d_view.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'screenshots_lovage', f'job_{job.id}_lovage_3d_view.png') if job else None,
            f"{ws_dir}/job_{job.id}_lovage_3d_view.jpg" if job else None,
            f"{ws_dir}/job_{job.id}_lovage_3d_view.png" if job else None,
        ])

        lovage_tableau_charges_abs = _first_existing_file([
            lovage_files.get('lovage_tableau_charges'),
            lovage_files.get('tableau_charges'),
            lovage_files.get('lovage_loads_table'),
            res_data.get('lovage_tableau_charges_path'),
            worker_lovage.get('tableau_charges_path'),
            os.path.join(settings.MEDIA_ROOT, 'charges_lovage', f'job_{job.id}_lovage_tableau_charges.png') if job else None,
            f"{ws_dir}/job_{job.id}_lovage_tableau_charges.png" if job else None,
        ])
        lovage_tableau_charges_abs = _crop_tableau_charges_image(lovage_tableau_charges_abs)

        lovage_verification_screenshot_abs = _first_existing_file([
            getattr(job.verification_screenshot, 'path', None) if getattr(job, 'verification_screenshot', None) and is_standalone_lovage else None,
            lovage_files.get('lovage_verification_screenshot'),
            lovage_files.get('verification_screenshot'),
            res_data.get('lovage_verification_screenshot_path'),
            worker_lovage.get('verification_screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'verif_lovage', f'job_{job.id}_lovage_verification.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'verif_lovage', f'job_{job.id}_lovage_verification.png') if job else None,
            f"{ws_dir}/job_{job.id}_lovage_verification.jpg" if job else None,
            f"{ws_dir}/job_{job.id}_lovage_verification.png" if job else None,
        ])

        lovage_paths = find_job_lovage_rtf_paths(job)
        lovage_convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_lovage')
        job_id_lbl = job.id if job else 'preview'
        lovage_note_mat_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_lovage_note_mat", lovage_paths.get('note_mat'), lovage_convert_dir)
        lovage_note_plot_images = [] if is_lovage_sans_plot else _get_or_convert_rtf_images(f"job_{job_id_lbl}_lovage_note_plot", lovage_paths.get('note_plot'), lovage_convert_dir)
        lovage_assemblage_images = [] if is_lovage_sans_plot else _get_or_convert_rtf_images(f"job_{job_id_lbl}_lovage_assemblage", lovage_paths.get('assemblage_note'), lovage_convert_dir, is_assemblage=True)

        if job and job.id != 'preview' and job.id != 'fast' and getattr(job, 'status', None) == 'COMPLETED':
            missing_lovage = []
            if not lovage_screenshot_abs or not os.path.exists(lovage_screenshot_abs):
                missing_lovage.append("Capture 3D modélisation Boîtiers de lovage")
            if not lovage_tableau_charges_abs or not os.path.exists(lovage_tableau_charges_abs):
                missing_lovage.append("Tableau des charges Boîtiers de lovage")
            if not lovage_verification_screenshot_abs or not os.path.exists(lovage_verification_screenshot_abs):
                missing_lovage.append("Capture de vérification Robot Boîtiers de lovage")
            if not lovage_note_mat_images:
                missing_lovage.append("Note de calcul RTF du mât Boîtiers de lovage")
            if not is_lovage_sans_plot and not lovage_assemblage_images:
                missing_lovage.append("Note d'assemblage Robot Boîtiers de lovage")

            if missing_lovage:
                err_msg = f"Génération annexe Boîtiers de lovage bloquée pour le Job {job.id} : artéfacts obligatoires manquants ({', '.join(missing_lovage)})."
                logger.error("[NDC HARDENING ERROR] %s", err_msg)
                raise ValueError(err_msg)

        generated_pdfs.append(_render_and_save('lovage', {
            'region': lovage_wind['region'],
            'terrain_type': lovage_wind['terrain_type'],
            'building_height': lovage_wind['building_height'],
            'vb_m_s': lovage_wind['vb_m_s'],
            'cr_z': lovage_wind['cr_z'],
            'vm_z': lovage_wind['vm_z'],
            'iv_z': lovage_wind['iv_z'],
            'kr_z': lovage_wind['kr_z'],
            'qp_z': lovage_qp_z,
            'eq_qty': qty_total,
            'lovage_name': first_item.get('name', 'Boitiers de lovage'),
            'eq_dims': eq_dims,
            'eq_weight': eq_weight,
            'cf_front': cf_front,
            'cf_lat': cf_lat,
            'fw_front': fw_front,
            'fw_lat': fw_lat,
            'fw_mat': fw_mat,
            'extremes': extremes,
            'lovage_sans_plot': is_lovage_sans_plot,
            'is_sans_plot': is_lovage_sans_plot,
            'lovage_has_echelle': resolve_support_has_echelle(input_data, res_data, kind="lovage", hauteur_mat_m=lovage_mat_longueur_m),
            'lovage_mat_section': lovage_mat_section,
            'lovage_mat_diam': lovage_mat_diam,
            'lovage_mat_epaisseur': lovage_mat_epaisseur,
            'lovage_mat_longueur': lovage_mat_longueur,
            'lovage_mat_longueur_m': lovage_mat_longueur_m,
            'lovage_plot_section': lovage_plot_section,
            'lovage_plot_longueur_m': lovage_plot_longueur_m,
            'lovage_mat_diam_m': f"{m_diam_m:.3f}" if isinstance(m_diam_m, (int, float)) else "0.088",
            'lovage_cf_mat': lovage_cf_mat,
            'lovage_screenshot_abs': lovage_screenshot_abs,
            'lovage_tableau_charges_abs': lovage_tableau_charges_abs,
            'lovage_verification_screenshot_abs': lovage_verification_screenshot_abs,
            'lovage_note_mat_images': lovage_note_mat_images,
            'lovage_note_plot_images': lovage_note_plot_images,
            'lovage_assemblage_images': lovage_assemblage_images,
            'lovage_items': items,
            'lovage_totals': totals,
            'lovage_is_multi': is_multi,
            'lovage_qty_total': qty_total,
            'lovage_has_gps': has_gps,
            'lovage_has_mdea': has_mdea,
            'lovage_gps_item': gps_item,
            'lovage_mdea_item': mdea_item,
            'lovage_variant': lovage_variant,
        }))

    return generated_pdfs

