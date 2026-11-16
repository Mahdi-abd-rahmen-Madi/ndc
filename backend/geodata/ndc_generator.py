import os
import re
import glob
import math
import uuid
import urllib.parse
from datetime import datetime
from PIL import Image
import numpy as np
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
        'kr':     round(kr, 2),
        'cr_z':   round(cr_z, 2),
        'vm':     round(vm, 2),
        'iv_z':   round(iv_z, 2),
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


def _extract_images_from_pdf(pdf_path, convert_dir, prefix, unique_run_id):
    """
    Renders pages of a PDF to cropped PNG images.
    """
    import pymupdf as fitz
    from PIL import Image, ImageChops

    images = []
    if not pdf_path or not os.path.exists(pdf_path):
        return images

    os.makedirs(convert_dir, exist_ok=True)
    try:
        doc = fitz.open(pdf_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            zoom = 2.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
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
            
            img_path = os.path.join(convert_dir, f"{prefix}_{unique_run_id}_page_{page_num+1}.png")
            img.save(img_path)
            images.append(img_path)
        doc.close()
    except Exception as img_err:
        print(f"Error rendering PDF pages to images: {img_err}")

    return images


def _batch_convert_rtf_files(specs):
    """
    Batches multiple RTF-to-image conversions in a SINGLE LibreOffice invocation.
    Guarantees zero cross-job leakage by using an isolated LibreOffice profile,
    fresh unique run IDs, and no persistent caches between runs.
    """
    import subprocess
    import tempfile
    import shutil
    import uuid

    results = {}
    valid_specs = []
    for s in specs:
        key = s.get('key', s['prefix'])
        results[key] = []
        if s.get('rtf_path') and os.path.exists(s['rtf_path']):
            valid_specs.append({**s, 'key': key})

    if not valid_specs:
        return results

    unique_run_id = uuid.uuid4().hex[:8]
    needs_conversion = []

    for s in valid_specs:
        if s['rtf_path'].lower().endswith('.pdf'):
            results[s['key']] = _extract_images_from_pdf(s['rtf_path'], s['convert_dir'], s['prefix'], unique_run_id)
        else:
            needs_conversion.append(s)

    if not needs_conversion:
        return results

    profile_dir = tempfile.mkdtemp(prefix=f"lo_prof_batch_{unique_run_id}_")
    pdf_out_dir = tempfile.mkdtemp(prefix=f"lo_out_batch_{unique_run_id}_")
    work_dir = tempfile.mkdtemp(prefix=f"lo_work_batch_{unique_run_id}_")

    prepared_files = []
    for idx, s in enumerate(needs_conversion):
        unique_base = f"{s['prefix']}_{idx}_{unique_run_id}"
        dest_rtf = os.path.join(work_dir, f"{unique_base}.rtf")
        if s.get('is_assemblage'):
            try:
                with open(s['rtf_path'], 'r', encoding='latin1') as rf:
                    raw_rtf = rf.read()
                cleaned_rtf = sanitize_assemblage_rtf(raw_rtf)
                with open(dest_rtf, 'w', encoding='latin1') as wf:
                    wf.write(cleaned_rtf)
            except Exception as e:
                print(f"Warning: sanitize_assemblage_rtf failed in batch for {s['rtf_path']}: {e}")
                shutil.copy2(s['rtf_path'], dest_rtf)
        else:
            shutil.copy2(s['rtf_path'], dest_rtf)

        prepared_files.append((s, dest_rtf, unique_base))

    try:
        input_file_paths = [p[1] for p in prepared_files]
        cmd = [
            'soffice', f'-env:UserInstallation=file://{profile_dir}',
            '--headless', '--invisible', '--nocrashreport', '--nodefault',
            '--nofirststartwizard', '--nologo', '--norestore',
            '--convert-to', 'pdf',
            '--outdir', pdf_out_dir
        ] + input_file_paths

        subprocess.run(cmd, timeout=90, check=True, capture_output=True)

        for s, _, unique_base in prepared_files:
            expected_pdf = os.path.join(pdf_out_dir, f"{unique_base}.pdf")
            if os.path.exists(expected_pdf):
                os.makedirs(s['convert_dir'], exist_ok=True)
                final_pdf = os.path.join(s['convert_dir'], f"{s['prefix']}_{unique_run_id}.pdf")
                shutil.copy2(expected_pdf, final_pdf)
                results[s['key']] = _extract_images_from_pdf(final_pdf, s['convert_dir'], s['prefix'], unique_run_id)
            else:
                print(f"Warning: LibreOffice batch did not output expected PDF: {expected_pdf}")
    except Exception as batch_err:
        print(f"Warning: LibreOffice batch conversion failed: {batch_err}. Falling back to individual conversions.")
        for s, _, _ in prepared_files:
            if not results[s['key']]:
                results[s['key']] = _convert_rtf_file_to_images(
                    s['rtf_path'], s['convert_dir'], s['prefix'], is_assemblage=s.get('is_assemblage', False)
                )
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)
        shutil.rmtree(pdf_out_dir, ignore_errors=True)
        shutil.rmtree(work_dir, ignore_errors=True)

    return results


def _convert_rtf_file_to_images(rtf_path, convert_dir, prefix, is_assemblage=False):
    """
    Converts a single RTF file to cropped images.
    Uses _batch_convert_rtf_files internally to ensure strict profile isolation
    and zero cache reuse across calls.
    """
    specs = [{
        'rtf_path': rtf_path,
        'convert_dir': convert_dir,
        'prefix': prefix,
        'is_assemblage': is_assemblage,
        'key': prefix
    }]
    res = _batch_convert_rtf_files(specs)
    return res.get(prefix, [])


def find_job_note_de_calcul_path(job):
    """Strictly find the note de calcul RTF belonging to this job."""
    if not job:
        return None
    if hasattr(job, 'note_de_calcul') and job.note_de_calcul:
        try:
            if os.path.exists(job.note_de_calcul.path):
                return job.note_de_calcul.path
        except Exception:
            pass
    fallback_media = os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_note_de_calcul.rtf')
    if os.path.exists(fallback_media):
        return fallback_media
    worker_ndc = f"/home/mahdi/worker_share/screenshots/job_{job.id}_note_de_calcul.rtf"
    if os.path.exists(worker_ndc):
        return worker_ndc
    return None


def find_job_assemblage_note_path(job):
    """Strictly find the assemblage note RTF belonging to this job."""
    if not job:
        return None
    if hasattr(job, 'assemblage_note') and job.assemblage_note:
        try:
            if os.path.exists(job.assemblage_note.path):
                return job.assemblage_note.path
        except Exception:
            pass
    fallback_media = os.path.join(settings.MEDIA_ROOT, 'assemblages', f'job_{job.id}_assemblage_note.rtf')
    if os.path.exists(fallback_media):
        return fallback_media
    worker_assemblage = f"/home/mahdi/worker_share/screenshots/job_{job.id}_assemblage_note.rtf"
    if os.path.exists(worker_assemblage):
        return worker_assemblage
    return None


def find_job_rrh_rtf_paths(job):
    """Strictly find the RRH RTF files belonging to this job."""
    if not job:
        return {}
    res = {'note_mat': None, 'note_plot': None, 'assemblage_note': None}

    res_data = getattr(job, 'result_data', None)
    if isinstance(res_data, dict) and res_data.get('has_rrh') is False:
        return res

    # note_mat
    if getattr(job, 'note_mat', None) and job.note_mat:
        try:
            mat_name = getattr(job.note_mat, 'name', '') or ''
            if '_rru_' not in mat_name.lower() and os.path.exists(job.note_mat.path) and '_rru_' not in job.note_mat.path.lower():
                res['note_mat'] = job.note_mat.path
        except Exception:
            pass
    if not res['note_mat']:
        for cp in [
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rrh_note_mat.rtf",
            os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_rrh_note_mat.rtf'),
            os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_rrh_note_mat.rtf')
        ]:
            if os.path.exists(cp):
                res['note_mat'] = cp
                break

    # note_plot
    if getattr(job, 'note_plot', None) and job.note_plot:
        try:
            plot_name = getattr(job.note_plot, 'name', '') or ''
            if '_rru_' not in plot_name.lower() and os.path.exists(job.note_plot.path) and '_rru_' not in job.note_plot.path.lower():
                res['note_plot'] = job.note_plot.path
        except Exception:
            pass
    if not res['note_plot']:
        for cp in [
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rrh_note_plot.rtf",
            os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_rrh_note_plot.rtf'),
            os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_rrh_note_plot.rtf')
        ]:
            if os.path.exists(cp):
                res['note_plot'] = cp
                break

    # assemblage
    if getattr(job, 'rrh_assemblage_note', None) and job.rrh_assemblage_note:
        try:
            ass_name = getattr(job.rrh_assemblage_note, 'name', '') or ''
            if '_rru_' not in ass_name.lower() and os.path.exists(job.rrh_assemblage_note.path) and '_rru_' not in job.rrh_assemblage_note.path.lower():
                res['assemblage_note'] = job.rrh_assemblage_note.path
        except Exception:
            pass
    if not res['assemblage_note']:
        for cp in [
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rrh_assemblage_note.rtf",
            os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_rrh_assemblage_note.rtf'),
            os.path.join(settings.MEDIA_ROOT, 'assemblages', f'job_{job.id}_rrh_assemblage_note.rtf')
        ]:
            if os.path.exists(cp):
                res['assemblage_note'] = cp
                break
    return res


def find_job_rru_rtf_paths(job):
    """Strictly find the RRU RTF/PDF files belonging to this job."""
    res = {'note_mat': None, 'note_plot': None, 'assemblage_note': None, 'note_de_calcul': None}
    if not job:
        return res

    res_data = getattr(job, 'result_data', None)
    if not isinstance(res_data, dict):
        res_data = {}
    rru_sub = res_data.get('rru') if isinstance(res_data.get('rru'), dict) else {}
    rru_files = res_data.get('rru_files') if isinstance(res_data.get('rru_files'), dict) else {}

    def _first_existing(candidates):
        for cp in candidates:
            if cp and isinstance(cp, str) and os.path.exists(cp):
                return cp
        return None

    # note_mat
    mat_cands = [
        rru_files.get('note_mat'),
        rru_files.get('rru_note_mat'),
        res_data.get('rru_note_mat_path'),
        rru_sub.get('note_mat_path'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_rru_note_mat.rtf'),
        f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_note_mat.rtf",
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_rru_note_mat.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_rru_note_mat.rtf'),
    ]
    if getattr(job, 'note_mat', None) and job.note_mat:
        try:
            if '_rru_' in (getattr(job.note_mat, 'name', '') or '').lower():
                mat_cands.append(job.note_mat.path)
        except Exception:
            pass
    res['note_mat'] = _first_existing(mat_cands)

    # note_plot
    plot_cands = [
        rru_files.get('note_plot'),
        rru_files.get('rru_note_plot'),
        res_data.get('rru_note_plot_path'),
        rru_sub.get('note_plot_path'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_rru_note_plot.rtf'),
        f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_note_plot.rtf",
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_rru_note_plot.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_rru_note_plot.rtf'),
    ]
    if getattr(job, 'note_plot', None) and job.note_plot:
        try:
            if '_rru_' in (getattr(job.note_plot, 'name', '') or '').lower():
                plot_cands.append(job.note_plot.path)
        except Exception:
            pass
    res['note_plot'] = _first_existing(plot_cands)

    # assemblage_note
    ass_cands = [
        rru_files.get('assemblage_note'),
        rru_files.get('rru_assemblage_note'),
        res_data.get('rru_assemblage_note_path'),
        rru_sub.get('assemblage_note_path'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_rru_assemblage_note.rtf'),
        f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_assemblage_note.rtf",
        os.path.join(settings.MEDIA_ROOT, 'assemblages', f'job_{job.id}_rru_assemblage_note.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_rru_assemblage_note.rtf'),
    ]
    if getattr(job, 'rrh_assemblage_note', None) and job.rrh_assemblage_note:
        try:
            if '_rru_' in (getattr(job.rrh_assemblage_note, 'name', '') or '').lower():
                ass_cands.append(job.rrh_assemblage_note.path)
        except Exception:
            pass
    res['assemblage_note'] = _first_existing(ass_cands)

    # note_de_calcul
    ndc_cands = [
        rru_files.get('note_de_calcul'),
        rru_files.get('note_de_calcul_rru'),
        rru_files.get('rru_note_de_calcul'),
        res_data.get('rru_note_de_calcul_path'),
        res_data.get('note_de_calcul_rru_path'),
        rru_sub.get('note_de_calcul_path'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_rru_note_de_calcul.pdf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_rru_note_de_calcul.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_note_de_calcul_rru.pdf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_note_de_calcul_rru.rtf'),
        f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_note_de_calcul.rtf",
        f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_note_de_calcul.pdf",
    ]
    res['note_de_calcul'] = _first_existing(ndc_cands)

    return res


def collect_site_ndc_rtf_specs(jobs):
    """
    Collects all RTF conversion specifications needed for generating a complete
    site Note de Calcul PDF across all sector jobs and auxiliary equipment.
    """
    specs = []
    if not jobs:
        return specs

    for job in jobs:
        if not job:
            continue
        ndc_path = find_job_note_de_calcul_path(job)
        if ndc_path:
            prefix = f"job_{job.id}_note_de_calcul"
            specs.append({
                'rtf_path': ndc_path,
                'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul'),
                'prefix': prefix,
                'is_assemblage': False,
                'key': prefix,
            })

        assemblage_path = find_job_assemblage_note_path(job)
        if assemblage_path:
            prefix = f"job_{job.id}_assemblage"
            specs.append({
                'rtf_path': assemblage_path,
                'convert_dir': os.path.join(settings.MEDIA_ROOT, 'assemblages'),
                'prefix': prefix,
                'is_assemblage': True,
                'key': prefix,
            })

    # Auxiliary notes for the first job (RRH, RRU, etc.)
    first_job = jobs[0] if jobs else None
    if first_job:
        input_data = first_job.input_data if isinstance(getattr(first_job, 'input_data', None), dict) else {}
        res_data = first_job.result_data if isinstance(getattr(first_job, 'result_data', None), dict) else {}
        calc_type = getattr(first_job, 'calculation_type', '')

        rrh_data = input_data.get('rrh_equipment', {})
        rrh_enabled = isinstance(rrh_data, dict) and rrh_data.get('enabled', False)
        rru_data = input_data.get('rru_equipment', {})
        rru_enabled = isinstance(rru_data, dict) and rru_data.get('enabled', False)

        is_rrh_eligible = (
            res_data.get('has_rrh') is not False
            and (
                rrh_enabled
                or res_data.get('has_rrh') is True
                or calc_type == 'rrh'
            )
        )
        if is_rrh_eligible:
            rrh_paths = find_job_rrh_rtf_paths(first_job)
            if rrh_paths.get('note_mat'):
                prefix = f"job_{first_job.id}_rrh_note_mat"
                specs.append({
                    'rtf_path': rrh_paths['note_mat'],
                    'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rrh'),
                    'prefix': prefix,
                    'is_assemblage': False,
                    'key': prefix,
                })
            if rrh_paths.get('note_plot'):
                prefix = f"job_{first_job.id}_rrh_note_plot"
                specs.append({
                    'rtf_path': rrh_paths['note_plot'],
                    'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rrh'),
                    'prefix': prefix,
                    'is_assemblage': False,
                    'key': prefix,
                })
            if rrh_paths.get('assemblage_note'):
                prefix = f"job_{first_job.id}_rrh_assemblage"
                specs.append({
                    'rtf_path': rrh_paths['assemblage_note'],
                    'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rrh'),
                    'prefix': prefix,
                    'is_assemblage': True,
                    'key': prefix,
                })

        is_rru_eligible = (
            rru_enabled
            or res_data.get('has_rru') is True
            or bool(res_data.get('rru_items'))
            or bool(input_data.get('is_rru'))
            or calc_type == 'rru'
        )
        if is_rru_eligible:
            rru_paths = find_job_rru_rtf_paths(first_job)
            if rru_paths.get('note_mat'):
                prefix = f"job_{first_job.id}_rru_note_mat"
                specs.append({
                    'rtf_path': rru_paths['note_mat'],
                    'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rru'),
                    'prefix': prefix,
                    'is_assemblage': False,
                    'key': prefix,
                })
            if rru_paths.get('note_plot'):
                prefix = f"job_{first_job.id}_rru_note_plot"
                specs.append({
                    'rtf_path': rru_paths['note_plot'],
                    'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rru'),
                    'prefix': prefix,
                    'is_assemblage': False,
                    'key': prefix,
                })
            if rru_paths.get('assemblage_note'):
                prefix = f"job_{first_job.id}_rru_assemblage"
                specs.append({
                    'rtf_path': rru_paths['assemblage_note'],
                    'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rru'),
                    'prefix': prefix,
                    'is_assemblage': True,
                    'key': prefix,
                })

    return specs





def generate_ndc_pdf(job, photo_url_or_path, preview_data=None, is_subsequent_sector=False, is_cover_only=False, start_page=1, preconverted_images=None):
    """
    Generates a PDF from HTML templates using WeasyPrint based on job calculation results.
    Accepts preconverted_images mapping to reuse images generated in batch, avoiding
    redundant LibreOffice startup overhead.
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
        
    # Robot Screenshot Path (treat each job as unique)
    screenshot_found = False
    
    if job:
        # 1. Primary: Django uploaded screenshot for this specific job
        if hasattr(job, 'screenshot') and job.screenshot:
            try:
                screenshot_path = job.screenshot.path
                if os.path.exists(screenshot_path):
                    context['robot_screenshot_abs'] = screenshot_path
                    screenshot_found = True
            except Exception:
                pass
        # 2. Worker share folder strictly for this job ID
        if not screenshot_found:
            worker_screenshot_path = f"/home/mahdi/worker_share/screenshots/job_{job.id}_3d_view.jpg"
            if os.path.exists(worker_screenshot_path):
                context['robot_screenshot_abs'] = worker_screenshot_path
                screenshot_found = True
        # 3. Direct media folder strictly for this job ID
        if not screenshot_found:
            media_screenshot_path = os.path.join(settings.MEDIA_ROOT, 'screenshots', f'job_{job.id}_3d_view.jpg')
            if os.path.exists(media_screenshot_path):
                context['robot_screenshot_abs'] = media_screenshot_path
                screenshot_found = True
                
    if not screenshot_found:
        context['robot_screenshot_abs'] = None

    # Verification Screenshot Path (treat each job as unique)
    verification_screenshot_found = False
    
    if job:
        # 1. Primary: Django uploaded verification screenshot for this specific job
        if hasattr(job, 'verification_screenshot') and job.verification_screenshot:
            try:
                verification_screenshot_path = job.verification_screenshot.path
                if os.path.exists(verification_screenshot_path):
                    context['verification_screenshot_abs'] = verification_screenshot_path
                    verification_screenshot_found = True
            except Exception:
                pass
        # 2. Worker share folder strictly for this job ID
        if not verification_screenshot_found:
            for wsp in [
                f"/home/mahdi/worker_share/screenshots/job_{job.id}_verification_view.jpg",
                f"/home/mahdi/worker_share/screenshots/job_{job.id}_verification.jpg",
                os.path.join(settings.MEDIA_ROOT, 'screenshots', 'verification', f'job_{job.id}_verification.jpg'),
                os.path.join(settings.MEDIA_ROOT, 'screenshots', f'job_{job.id}_verification.jpg')
            ]:
                if os.path.exists(wsp):
                    context['verification_screenshot_abs'] = wsp
                    verification_screenshot_found = True
                    break
                
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

        
    # Note de Calcul (RTF) Path (strictly scoped to this job)
    context['note_de_calcul_abs'] = find_job_note_de_calcul_path(job)

    # Convert RTF to Images (for embedding directly in the HTML template)
    context['note_de_calcul_images'] = []
    job_prefix = f"job_{job.id if job else 'preview'}_note_de_calcul"
    if preconverted_images and job_prefix in preconverted_images and preconverted_images[job_prefix]:
        context['note_de_calcul_images'] = preconverted_images[job_prefix]
    elif context.get('note_de_calcul_abs') and os.path.exists(context['note_de_calcul_abs']):
        convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul')
        try:
            context['note_de_calcul_images'] = _convert_rtf_file_to_images(context['note_de_calcul_abs'], convert_dir, job_prefix)
        except Exception as e:
            print(f"Warning: Failed to convert RTF note de calcul to Images: {e}")

    # Assemblage Note (RTF) Path (strictly scoped to this job)
    context['assemblage_note_abs'] = find_job_assemblage_note_path(job)

    # Convert Assemblage RTF to Images (for embedding directly in the HTML template)
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


def extract_rrh_ndc_context(result_data: dict, input_data: dict = None, qp_val: float = 0.0) -> dict:
    """
    Extracts multi-RRH data from result_data with fallback to legacy single-RRH format
    or input_data (catalogue lookup) for preview/pre-worker states.
    """
    result_data = result_data if isinstance(result_data, dict) else {}
    input_data = input_data if isinstance(input_data, dict) else {}
    rrh_sub = result_data.get("rrh") if isinstance(result_data.get("rrh"), dict) else {}

    # 1. Extract items list from worker results
    items = (
        result_data.get("rrh_items")
        or rrh_sub.get("rrh_items")
        or []
    )

    # 2. Extract totals from worker results
    totals = (
        result_data.get("rrh_totals")
        or rrh_sub.get("rrh_totals")
        or {}
    )

    # 3. Extract wind parameters
    wind = (
        result_data.get("rrh_wind_params")
        or rrh_sub.get("wind_params")
        or result_data.get("wind_params")
        or {}
    )

    # 4. Extract structure parameters
    structure = (
        result_data.get("structure_params")
        or rrh_sub.get("structure_params")
        or {}
    )

    # 5. Extract extremes
    extremes = (
        result_data.get("extremes")
        or rrh_sub.get("extremes")
        or {}
    )

    try:
        qp = float(wind.get("qp_dan") or qp_val or 0.0)
    except (ValueError, TypeError):
        qp = 0.0

    # 6. Fallback 1: Legacy jobs / cached entries where equipment_params was present
    if not items:
        ep = rrh_sub.get("equipment_params") or result_data.get("equipment_params") or {}
        if ep:
            qty = ep.get("qty", 1)
            cf_f = ep.get("cf_front", 1.36)
            cf_l = ep.get("cf_lat", 1.10)
            af = ep.get("a_front", 0.10)
            al = ep.get("a_lat", 0.05)
            fw_f = wind.get("fw_front", round(qty * cf_f * af * qp, 2))
            fw_l = wind.get("fw_lat", round(qty * cf_l * al * qp, 2))
            pe = wind.get("pe_dan", round(qty * ep.get("weight_kg", 0.0), 2))
            h_mm = ep.get("h_mm", 0)
            w_mm = ep.get("w_mm", 0)
            t_mm = ep.get("t_mm", 0)
            dims_str = f"{h_mm:g} x {w_mm:g} x {t_mm:g}" if (h_mm or w_mm) else "N/A"

            items = [{
                "index": 1,
                "name": ep.get("name", "RRH"),
                "catalog_reference": ep.get("catalog_reference", ep.get("name", "RRH")),
                "qty": qty,
                "h_mm": h_mm,
                "w_mm": w_mm,
                "t_mm": t_mm,
                "dimensions_str": dims_str,
                "weight_kg": ep.get("weight_kg", 0.0),
                "weight_total_kg": pe,
                "cf_front": cf_f,
                "cf_lat": cf_l,
                "a_front": af,
                "a_lat": al,
                "fw_front": fw_f,
                "fw_lat": fw_l,
                "pe_dan": pe,
                "fw_front_formula": f"{qty} * {cf_f:.2f} * {af:.2f} * {qp:.2f} = {fw_f:.2f} daN",
                "fw_lat_formula": f"{qty} * {cf_l:.2f} * {al:.2f} * {qp:.2f} = {fw_l:.2f} daN",
            }]
            totals = {
                "count": 1,
                "qty_total": qty,
                "fw_front": fw_f,
                "fw_lat": fw_l,
                "pe_dan": pe,
                "weight_total_kg": pe,
                "fw_front_formula": f"{fw_f:.2f} daN",
                "fw_lat_formula": f"{fw_l:.2f} daN",
            }

    # 5. Fallback 2: Preview mode / before worker run -> extract from input_data rrh_equipment
    if not items:
        from .catalogue_loader import find_rrh_reference
        raw_items = input_data.get("rrh_equipment", {}).get("items", [])
        op = input_data.get("site", {}).get("operator")
        if raw_items:
            built_items = []
            tot_qty = 0
            tot_fw_front = 0.0
            tot_fw_lat = 0.0
            tot_weight = 0.0
            f_front_parts = []
            f_lat_parts = []

            for idx, it in enumerate(raw_items, start=1):
                ref = it.get("reference") or it.get("name") or ""
                spec = find_rrh_reference(ref, op) if ref else None
                qty = it.get("quantity") or it.get("qty") or 1
                name = (spec.get("name") if spec else None) or ref or f"RRH #{idx}"
                h_mm = float(spec.get("height") or 0.0) if spec else 0.0
                w_mm = float(spec.get("width") or 0.0) if spec else 0.0
                t_mm = float(spec.get("thickness") or 0.0) if spec else 0.0
                dims_str = f"{h_mm:g} x {w_mm:g} x {t_mm:g}" if (h_mm or w_mm) else (spec.get("dimensions", "N/A") if spec else "N/A")
                weight_kg = float(spec.get("weight") or 0.0) if spec else 0.0
                weight_total = round(qty * weight_kg, 2)
                cf_front = float(spec.get("cf_front", 1.36)) if spec else 1.36
                cf_lat = float(spec.get("cf_lat", 1.10)) if spec else 1.10
                a_front = float(spec.get("surf_front") or spec.get("cx_front", 0.10)) if spec else 0.10
                a_lat = float(spec.get("surf_lat") or spec.get("cx_lat", 0.05)) if spec else 0.05
                fw_front_i = round(qty * cf_front * a_front * qp, 2) if qp else 0.0
                fw_lat_i = round(qty * cf_lat * a_lat * qp, 2) if qp else 0.0

                built_items.append({
                    "index": idx,
                    "name": name,
                    "catalog_reference": ref,
                    "qty": qty,
                    "h_mm": h_mm,
                    "w_mm": w_mm,
                    "t_mm": t_mm,
                    "dimensions_str": dims_str,
                    "weight_kg": weight_kg,
                    "weight_total_kg": weight_total,
                    "cf_front": cf_front,
                    "cf_lat": cf_lat,
                    "a_front": a_front,
                    "a_lat": a_lat,
                    "fw_front": fw_front_i,
                    "fw_lat": fw_lat_i,
                    "pe_dan": weight_total,
                    "fw_front_formula": f"{qty} * {cf_front:.2f} * {a_front:.2f} * {qp:.2f} = {fw_front_i:.2f} daN" if qp else f"{fw_front_i:.2f} daN",
                    "fw_lat_formula": f"{qty} * {cf_lat:.2f} * {a_lat:.2f} * {qp:.2f} = {fw_lat_i:.2f} daN" if qp else f"{fw_lat_i:.2f} daN",
                })
                tot_qty += qty
                tot_weight += weight_total
                tot_fw_front += fw_front_i
                tot_fw_lat += fw_lat_i
                f_front_parts.append(f"{fw_front_i:.2f}")
                f_lat_parts.append(f"{fw_lat_i:.2f}")

            items = built_items
            totals = {
                "count": len(built_items),
                "qty_total": tot_qty,
                "fw_front": round(tot_fw_front, 2),
                "fw_lat": round(tot_fw_lat, 2),
                "pe_dan": round(tot_weight, 2),
                "weight_total_kg": round(tot_weight, 2),
                "fw_front_formula": " + ".join(f_front_parts) + f" = {round(tot_fw_front, 2):.2f} daN" if len(f_front_parts) > 1 else (f"{round(tot_fw_front, 2):.2f} daN" if f_front_parts else "0.00 daN"),
                "fw_lat_formula": " + ".join(f_lat_parts) + f" = {round(tot_fw_lat, 2):.2f} daN" if len(f_lat_parts) > 1 else (f"{round(tot_fw_lat, 2):.2f} daN" if f_lat_parts else "0.00 daN"),
            }

    # 6. Fallback 3: Generic default single RRH if everything else is empty
    if not items:
        items = [{
            "index": 1,
            "name": "RRH",
            "catalog_reference": "RRH",
            "qty": 1,
            "dimensions_str": "N/A",
            "weight_kg": 0.0,
            "weight_total_kg": 0.0,
            "cf_front": 1.36,
            "cf_lat": 1.10,
            "a_front": 0.10,
            "a_lat": 0.05,
            "fw_front": 0.0,
            "fw_lat": 0.0,
            "pe_dan": 0.0,
            "fw_front_formula": "N/A",
            "fw_lat_formula": "N/A",
        }]
        totals = {
            "count": 1,
            "qty_total": 1,
            "fw_front": 0.0,
            "fw_lat": 0.0,
            "pe_dan": 0.0,
            "weight_total_kg": 0.0,
            "fw_front_formula": "N/A",
            "fw_lat_formula": "N/A",
        }

    is_multi = len(items) > 1 or (totals.get("qty_total", 0) > 1)

    return {
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "extremes": extremes,
        "is_multi": is_multi,
        "qty_total": totals.get("qty_total", sum(it.get("qty", 1) for it in items)),
    }


def _parse_envelope_dims_m(env_str: str):
    """Parse '600*500*200' or '600*500*200mm' into (h_m, w_m, d_m)."""
    if not env_str:
        return None
    m = re.search(r'(\d+(?:\.\d+)?)\s*[*xX]\s*(\d+(?:\.\d+)?)\s*[*xX]\s*(\d+(?:\.\d+)?)', str(env_str))
    if not m:
        return None
    return float(m.group(1)) / 1000.0, float(m.group(2)) / 1000.0, float(m.group(3)) / 1000.0


def extract_rru_ndc_context(result_data: dict, input_data: dict = None, qp_val: float = 0.0) -> dict:
    """
    Extracts multi-RRU data from result_data with fallback to input_data
    (catalogue lookup) for preview/pre-worker states.
    Table 0 always uses REAL equipment dimensions & weights; wind forces use
    modeling values (Bouygues envelope or Free/Orange real dimensions).
    """
    result_data = result_data if isinstance(result_data, dict) else {}
    input_data = input_data if isinstance(input_data, dict) else {}
    rru_sub = result_data.get("rru") if isinstance(result_data.get("rru"), dict) else {}

    # 1. Extract items list from worker results
    raw_items = (
        result_data.get("rru_items")
        or rru_sub.get("rru_items")
        or []
    )
    # Backward compatibility with legacy Job #565 only when has_rru is absent
    legacy_rru_compat = (
        not raw_items
        and result_data.get("has_rru") is None
        and isinstance(input_data.get("rru_equipment"), dict)
        and input_data["rru_equipment"].get("enabled")
    )
    if legacy_rru_compat:
        rrh_sub_legacy = result_data.get("rrh") if isinstance(result_data.get("rrh"), dict) else {}
        raw_items = result_data.get("rrh_items") or rrh_sub_legacy.get("rrh_items") or []

    # 2. Extract totals from worker results
    totals = (
        result_data.get("rru_totals")
        or rru_sub.get("rru_totals")
        or {}
    )
    if not totals and legacy_rru_compat:
        rrh_sub_legacy = result_data.get("rrh") if isinstance(result_data.get("rrh"), dict) else {}
        totals = result_data.get("rrh_totals") or rrh_sub_legacy.get("rrh_totals") or {}

    # 3. Extract wind parameters
    wind = (
        result_data.get("rru_wind_params")
        or rru_sub.get("wind_params")
        or result_data.get("wind_params")
        or {}
    )

    # 4. Extract structure parameters
    structure = (
        rru_sub.get("structure_params")
        or result_data.get("structure_params")
        or {}
    )

    # 5. Extract extremes, operator, and sans_plot flag
    extremes = (
        result_data.get("extremes")
        or rru_sub.get("extremes")
        or {}
    )
    operateur = (
        result_data.get("operateur")
        or rru_sub.get("operateur")
        or input_data.get("operateur")
        or input_data.get("site", {}).get("operator")
        or "bouygues"
    )
    is_sans_plot = bool(
        result_data.get("rru_sans_plot")
        or rru_sub.get("sans_plot")
        or structure.get("sans_plot")
        or input_data.get("sans_plot")
        or (input_data.get("rru_equipment") or {}).get("sans_plot", False)
    )

    try:
        qp = float(wind.get("qp_dan") or qp_val or 0.0)
    except (ValueError, TypeError):
        qp = 0.0

    items = []
    if raw_items:
        tot_qty = 0
        tot_weight = 0.0
        tot_fw_front = 0.0
        tot_fw_lat = 0.0

        for idx, it in enumerate(raw_items, start=1):
            qty = int(it.get("qty") or it.get("quantity") or 1)
            h_mm = float(it.get("h_mm") or 0.0)
            w_mm = float(it.get("w_mm") or 0.0)
            d_mm = float(it.get("d_mm") if it.get("d_mm") is not None else (it.get("t_mm") or 0.0))
            dims_str = it.get("dimensions_str")
            if not dims_str:
                dims_str = f"{h_mm:g} x {w_mm:g} x {d_mm:g}" if (h_mm or w_mm or d_mm) else "N/A"

            weight_kg = float(it.get("weight_kg") or 0.0)
            weight_total = float(it.get("weight_total_kg") if it.get("weight_total_kg") is not None else round(qty * weight_kg, 2))
            cf_front = float(it.get("cf_front") or 1.38)
            cf_lat = float(it.get("cf_lat") or 1.11)

            a_front = float(it.get("area_front_m2") if it.get("area_front_m2") is not None else (it.get("a_front") or 0.12))
            a_lat = float(it.get("area_lat_m2") if it.get("area_lat_m2") is not None else (it.get("a_lat") or 0.06))

            mod_h = it.get("modeling_h_m")
            mod_w = it.get("modeling_w_m")
            mod_d = it.get("modeling_d_m")
            a_front_calc = round(float(mod_h) * float(mod_w), 4) if (mod_h and mod_w) else a_front
            a_lat_calc = round(float(mod_h) * float(mod_d), 4) if (mod_h and mod_d) else a_lat

            fw_f_raw = it.get("fw_front") if it.get("fw_front") is not None else it.get("fw_front_dan")
            fw_l_raw = it.get("fw_lat") if it.get("fw_lat") is not None else it.get("fw_lat_dan")
            fw_front_i = float(fw_f_raw) if fw_f_raw is not None else (round(qty * cf_front * a_front_calc * qp, 2) if qp else 0.0)
            fw_lat_i = float(fw_l_raw) if fw_l_raw is not None else (round(qty * cf_lat * a_lat_calc * qp, 2) if qp else 0.0)

            fw_front_formula = it.get("fw_front_formula") or (
                f"{qty} * {cf_front:.2f} * {a_front_calc:.2f} * {qp:.2f} = {fw_front_i:.2f} daN" if qp else f"{fw_front_i:.2f} daN"
            )
            fw_lat_formula = it.get("fw_lat_formula") or (
                f"{qty} * {cf_lat:.2f} * {a_lat_calc:.2f} * {qp:.2f} = {fw_lat_i:.2f} daN" if qp else f"{fw_lat_i:.2f} daN"
            )

            items.append({
                "index": it.get("index", idx),
                "name": it.get("name") or it.get("reference") or f"RRU #{idx}",
                "vendor": it.get("vendor", ""),
                "catalog_reference": it.get("catalog_reference") or it.get("name") or f"RRU #{idx}",
                "qty": qty,
                "h_mm": h_mm,
                "w_mm": w_mm,
                "d_mm": d_mm,
                "dimensions_str": dims_str,
                "weight_kg": weight_kg,
                "weight_total_kg": weight_total,
                "cf_front": cf_front,
                "cf_lat": cf_lat,
                "a_front": a_front,
                "a_lat": a_lat,
                "fw_front": fw_front_i,
                "fw_lat": fw_lat_i,
                "pe_dan": weight_total,
                "fw_front_formula": fw_front_formula,
                "fw_lat_formula": fw_lat_formula,
            })
            tot_qty += qty
            tot_weight += weight_total
            tot_fw_front += fw_front_i
            tot_fw_lat += fw_lat_i

        totals = dict(totals) if isinstance(totals, dict) else {}
        totals.setdefault("count", len(items))
        totals.setdefault("qty_total", tot_qty)
        totals.setdefault("weight_total_kg", round(tot_weight, 2))
        totals.setdefault("pe_dan", totals.get("weight_total_kg", round(tot_weight, 2)))
        if totals.get("fw_front") is None:
            totals["fw_front"] = wind.get("fw_front_total_dan") if wind.get("fw_front_total_dan") is not None else round(tot_fw_front, 2)
        if totals.get("fw_lat") is None:
            totals["fw_lat"] = wind.get("fw_lat_total_dan") if wind.get("fw_lat_total_dan") is not None else round(tot_fw_lat, 2)

    # 6. Fallback 1: Preview mode / before worker run -> extract from input_data rru_equipment or standalone equipment
    if not items:
        from .catalogue_loader import find_rru_reference
        raw_in_items = (input_data.get("rru_equipment") or {}).get("items", [])
        if not raw_in_items and isinstance(input_data.get("equipment"), dict):
            eq = input_data["equipment"]
            eq_ref = eq.get("reference") or eq.get("model")
            if eq_ref:
                raw_in_items = [{"reference": eq_ref, "quantity": eq.get("qty") or eq.get("quantity") or eq.get("quantite") or 1}]

        op_norm = str(operateur or "").strip().lower()
        if op_norm == "bytel":
            op_norm = "bouygues"

        if raw_in_items:
            built_items = []
            tot_qty = 0
            tot_fw_front = 0.0
            tot_fw_lat = 0.0
            tot_weight = 0.0
            f_front_parts = []
            f_lat_parts = []

            for idx, it in enumerate(raw_in_items, start=1):
                ref = it.get("reference") or it.get("name") or ""
                spec = (find_rru_reference(ref, op_norm) or find_rru_reference(ref)) if ref else None
                qty = int(it.get("quantity") or it.get("qty") or 1)
                name = (spec.get("reference") if spec else None) or ref or f"RRU #{idx}"
                h_mm = float(spec.get("height") or 0.0) if spec else 0.0
                w_mm = float(spec.get("width") or 0.0) if spec else 0.0
                d_mm = float(spec.get("thickness") or 0.0) if spec else 0.0
                dims_str = f"{h_mm:g} x {w_mm:g} x {d_mm:g}" if (h_mm or w_mm or d_mm) else (spec.get("dimensions", "N/A") if spec else "N/A")
                weight_kg = float(spec.get("weight") or 0.0) if spec else 0.0
                weight_total = round(qty * weight_kg, 2)
                cf_front = float(spec.get("cf_front", 1.38)) if spec else 1.38
                cf_lat = float(spec.get("cf_lat", 1.11)) if spec else 1.11
                a_front_real = float(spec.get("surf_front") or (round((h_mm * w_mm) / 1e6, 4) if (h_mm and w_mm) else 0.12)) if spec else 0.12
                a_lat_real = float(spec.get("surf_lat") or (round((h_mm * d_mm) / 1e6, 4) if (h_mm and d_mm) else 0.06)) if spec else 0.06

                a_front_calc, a_lat_calc = a_front_real, a_lat_real
                if op_norm == "bouygues" and spec:
                    env_dims = _parse_envelope_dims_m(spec.get("envelope_dimensions") or spec.get("envelope"))
                    if env_dims:
                        eh, ew, ed = env_dims
                        a_front_calc = round(eh * ew, 4)
                        a_lat_calc = round(eh * ed, 4)

                fw_front_i = round(qty * cf_front * a_front_calc * qp, 2) if qp else 0.0
                fw_lat_i = round(qty * cf_lat * a_lat_calc * qp, 2) if qp else 0.0

                built_items.append({
                    "index": idx,
                    "name": name,
                    "vendor": spec.get("vendor", "") if spec else "",
                    "catalog_reference": ref,
                    "qty": qty,
                    "h_mm": h_mm,
                    "w_mm": w_mm,
                    "d_mm": d_mm,
                    "dimensions_str": dims_str,
                    "weight_kg": weight_kg,
                    "weight_total_kg": weight_total,
                    "cf_front": cf_front,
                    "cf_lat": cf_lat,
                    "a_front": a_front_real,
                    "a_lat": a_lat_real,
                    "fw_front": fw_front_i,
                    "fw_lat": fw_lat_i,
                    "pe_dan": weight_total,
                    "fw_front_formula": f"{qty} * {cf_front:.2f} * {a_front_calc:.2f} * {qp:.2f} = {fw_front_i:.2f} daN" if qp else f"{fw_front_i:.2f} daN",
                    "fw_lat_formula": f"{qty} * {cf_lat:.2f} * {a_lat_calc:.2f} * {qp:.2f} = {fw_lat_i:.2f} daN" if qp else f"{fw_lat_i:.2f} daN",
                })
                tot_qty += qty
                tot_weight += weight_total
                tot_fw_front += fw_front_i
                tot_fw_lat += fw_lat_i
                f_front_parts.append(f"{fw_front_i:.2f}")
                f_lat_parts.append(f"{fw_lat_i:.2f}")

            items = built_items
            totals = {
                "count": len(built_items),
                "qty_total": tot_qty,
                "fw_front": round(tot_fw_front, 2),
                "fw_lat": round(tot_fw_lat, 2),
                "pe_dan": round(tot_weight, 2),
                "weight_total_kg": round(tot_weight, 2),
                "fw_front_formula": " + ".join(f_front_parts) + f" = {round(tot_fw_front, 2):.2f} daN" if len(f_front_parts) > 1 else (f"{round(tot_fw_front, 2):.2f} daN" if f_front_parts else "0.00 daN"),
                "fw_lat_formula": " + ".join(f_lat_parts) + f" = {round(tot_fw_lat, 2):.2f} daN" if len(f_lat_parts) > 1 else (f"{round(tot_fw_lat, 2):.2f} daN" if f_lat_parts else "0.00 daN"),
            }

    # 7. Fallback 2: Generic default single RRU if everything else is empty
    if not items:
        items = [{
            "index": 1,
            "name": "RRU",
            "vendor": "",
            "catalog_reference": "RRU",
            "qty": 1,
            "dimensions_str": "N/A",
            "weight_kg": 0.0,
            "weight_total_kg": 0.0,
            "cf_front": 1.38,
            "cf_lat": 1.11,
            "a_front": 0.12,
            "a_lat": 0.06,
            "fw_front": 0.0,
            "fw_lat": 0.0,
            "pe_dan": 0.0,
            "fw_front_formula": "N/A",
            "fw_lat_formula": "N/A",
        }]
        totals = {
            "count": 1,
            "qty_total": 1,
            "fw_front": 0.0,
            "fw_lat": 0.0,
            "pe_dan": 0.0,
            "weight_total_kg": 0.0,
            "fw_front_formula": "N/A",
            "fw_lat_formula": "N/A",
        }

    is_multi = len(items) > 1 or (totals.get("qty_total", 0) > 1)

    return {
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "extremes": extremes,
        "operateur": operateur,
        "is_sans_plot": is_sans_plot,
        "is_multi": is_multi,
        "qty_total": totals.get("qty_total", sum(it.get("qty", 1) for it in items)),
    }


def _resolve_support_wind_params(wind_p: dict, context: dict, env: dict, vb, h_plot_m, h_mat_m) -> dict:
    """Resolve EC1 wind chain for an auxiliary support (RRH or RRU) consistently."""
    qp_z = wind_p.get('qp_dan') or context.get('qp_z')
    cr_z = wind_p.get('cr_z') or wind_p.get('cr')
    vm_z = wind_p.get('vm_z') or wind_p.get('vm')
    iv_z = wind_p.get('iv_z') or wind_p.get('iv')
    kr_z = wind_p.get('kr_z') or wind_p.get('kr')

    raw_region = wind_p.get('region')
    if raw_region is not None:
        if isinstance(raw_region, (int, float)) or (isinstance(raw_region, str) and str(raw_region).isdigit()):
            region_str = f"Region {raw_region}"
        else:
            region_str = str(raw_region)
    else:
        region_str = context.get('region')

    terrain_type = str(wind_p.get('terrain_type') or context.get('terrain_type') or env.get('terrain_type') or 'IIIa')
    building_height = wind_p.get('building_height_m') if wind_p.get('building_height_m') is not None else context.get('building_height')
    vb_m_s = (
        wind_p.get('vb0_ms')
        if wind_p.get('vb0_ms') is not None
        else (wind_p.get('v_b0') if wind_p.get('v_b0') is not None else context.get('vb_m_s'))
    )

    try:
        vb_num = float(vb_m_s) if vb_m_s is not None and str(vb_m_s) != '[Vb]' else (float(vb) if vb is not None else None)
    except (ValueError, TypeError):
        vb_num = float(vb) if vb is not None else None

    if not cr_z:
        try:
            target_qp_dan = float(wind_p.get('qp_dan') or 0.0)
        except (ValueError, TypeError):
            target_qp_dan = 0.0

        if target_qp_dan > 0 and vb_num is not None and vb_num > 0:
            z0_val, _ = TERRAIN_Z0.get(terrain_type, TERRAIN_Z0['IIIa'])
            kr_val = 0.19 * (z0_val / Z0_II) ** 0.07
            a_coeff = 0.5 * RHO_AIR * (vb_num ** 2) * (kr_val ** 2)
            qp_pa_target = target_qp_dan * 10.0
            disc = 49.0 + 4.0 * (qp_pa_target / a_coeff)
            if disc > 0:
                x_val = (-7.0 + math.sqrt(disc)) / 2.0
                cr_calc = kr_val * x_val
                vm_calc = cr_calc * 1.0 * vb_num
                iv_calc = 1.0 / x_val if x_val > 0 else 0.12
                cr_z = round(cr_calc, 2)
                vm_z = round(vm_calc, 2)
                iv_z = round(iv_calc, 2)
                kr_z = round(kr_val, 2)

    if not cr_z:
        try:
            h_bat = float(env.get('building_height_m') or 0)
            h_plot = float(h_plot_m or 0)
            h_mat = float(h_mat_m or 0)
            z_tot = h_bat + h_plot + h_mat
            if z_tot <= 0:
                z_tot = h_bat
        except (ValueError, TypeError):
            z_tot = 0

        if vb_num is not None and vb_num > 0 and z_tot > 0:
            wind_calc = calculate_wind_params(terrain_type, z_tot, vb_num)
            cr_z = wind_calc['cr_z']
            vm_z = wind_calc['vm']
            iv_z = wind_calc['iv_z']
            kr_z = wind_calc['kr']
            if not qp_z:
                qp_z = wind_calc['qp_dan']
        else:
            cr_z = context.get('cr_z')
            vm_z = context.get('vm_z')
            iv_z = context.get('iv_z')
            kr_z = context.get('kr_z')

    return {
        'region': region_str,
        'terrain_type': terrain_type,
        'building_height': building_height,
        'vb_m_s': vb_m_s,
        'cr_z': cr_z,
        'vm_z': vm_z,
        'iv_z': iv_z,
        'kr_z': kr_z,
        'qp_z': qp_z,
    }


def _crop_tableau_charges_image(img_path: str) -> str:
    """Crop trailing empty columns from a Robot tableau des charges screenshot."""
    if not img_path or not os.path.exists(img_path):
        return img_path
    try:
        with Image.open(img_path) as src_img:
            gray = src_img.convert('L')
            arr = np.array(gray)
            h, w = arr.shape
            col_line_span = np.sum(arr[10:h-10, :] < 180, axis=0)
            true_lines = np.where(col_line_span > (h - 20) * 0.85)[0]
            groups = []
            for c in true_lines:
                if not groups or c > groups[-1][-1] + 2:
                    groups.append([c])
                else:
                    groups[-1].append(c)
            centers = [int(np.mean(g)) for g in groups]
            if len(centers) >= 4:
                last_content_col = None
                for i in range(len(centers) - 2, -1, -1):
                    c1, c2 = centers[i], centers[i + 1]
                    col_width = c2 - c1 - 4
                    if col_width <= 0:
                        continue
                    cell_area = arr[25:h-5, c1+2:c2-2]
                    row_dark_count = np.sum(cell_area < 180, axis=1)
                    grid_rows = row_dark_count > (col_width * 0.5)
                    text_rows = (~grid_rows)
                    text_dark_pixels = np.sum(cell_area[text_rows] < 180)
                    if text_dark_pixels > 20:
                        last_content_col = i
                        break

                if last_content_col is not None and last_content_col < len(centers) - 2:
                    crop_x = min(w, centers[last_content_col + 1] + 1)
                    cropped_img = src_img.crop((0, 0, crop_x, h))
                    dir_name = os.path.dirname(img_path)
                    base_name = os.path.basename(img_path)
                    cropped_path = os.path.join(dir_name, f"cropped_{base_name}")
                    cropped_img.save(cropped_path)
                    return cropped_path
    except Exception as e:
        print(f"Warning: could not crop tableau_charges ({img_path}): {e}")
    return img_path


def generate_auxiliary_pdfs(job, start_page=1, preconverted_images=None):
    """
    Generate auxiliary PDFs (TD, FH, RRH, RRU) based on job.input_data.
    Returns a list of absolute paths to the generated PDFs.
    Accepts preconverted_images mapping to reuse images generated in batch.
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
            match = re.search(r'(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)', section_str)
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

    # Check for TD (disabled completely for Bouygues)
    td_eq = input_data.get('td_equipment', {})
    operator = (input_data.get('site', {}).get('operator') or '').lower().strip()
    if td_eq.get('enabled') and operator != 'bouygues':
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

    # Check for RRH vs RRU (strictly segregated)
    rru_eq = input_data.get('rru_equipment', {})
    rrh_eq = input_data.get('rrh_equipment', {})
    res_data = getattr(job, 'result_data', {}) if job else {}
    if not isinstance(res_data, dict):
        res_data = {}
    calc_type = getattr(job, 'calculation_type', '') if job else ''

    is_rru_only_job = (
        res_data.get('has_rrh') is False
        or (
            isinstance(rru_eq, dict) and rru_eq.get('enabled')
            and not (isinstance(rrh_eq, dict) and rrh_eq.get('enabled'))
            and res_data.get('has_rrh') is not True
        )
    )

    has_rrh_result = (
        not is_rru_only_job
        and (
            res_data.get('has_rrh') is True
            or ('rrh' in res_data and isinstance(res_data['rrh'], dict))
            or bool(res_data.get('rrh_items'))
            or bool(res_data.get('rrh_totals'))
        )
    )
    is_rrh_calc = (
        not is_rru_only_job
        and bool(input_data.get('is_rrh') or calc_type in ['rrh', 'antenna_with_rrh'] or getattr(job, 'note_de_calcul_rrh', None))
    )

    def _get_or_convert_rtf_images(key_prefix, rtf_abs, convert_dir, is_assemblage=False):
        if preconverted_images and key_prefix in preconverted_images and preconverted_images[key_prefix]:
            return preconverted_images[key_prefix]
        if rtf_abs and os.path.exists(rtf_abs):
            try:
                return _convert_rtf_file_to_images(rtf_abs, convert_dir, key_prefix, is_assemblage=is_assemblage)
            except Exception as e:
                print(f"Warning: Failed to convert {key_prefix} RTF to images: {e}")
        return []

    def _first_existing_path(candidates):
        for cp in candidates:
            if cp and isinstance(cp, str) and os.path.exists(cp):
                return cp
        return None

    if (not is_rru_only_job) and ((isinstance(rrh_eq, dict) and rrh_eq.get('enabled')) or has_rrh_result or is_rrh_calc):
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
        fw_front = totals.get('fw_front', round(cx_front * qp_val, 2) if qp_val else '[Fw,Front]')
        fw_lat = totals.get('fw_lat', round(cx_lat * qp_val, 2) if qp_val else '[Fw,Lat]')

        worker_rrh = res_data.get('rrh', {}) if isinstance(res_data.get('rrh'), dict) else {}
        extremes = rrh_ctx.get('extremes') or worker_rrh.get('extremes', {}) or res_data.get('extremes', {})
        struct_p = rrh_ctx.get('structure') or worker_rrh.get('structure_params', {}) or res_data.get('structure_params', {})

        rrh_mat_section = struct_p.get('mast_section') or context.get('mat_section')
        rrh_plot_section = struct_p.get('plot_section') or context.get('plot_section')
        rrh_plot_longueur_m = struct_p.get('plot_h_m') or context.get('plot_longueur_m')
        rrh_mat_longueur_m = struct_p.get('hauteur_mat_m') or context.get('mat_longueur_m')

        rrh_wind = _resolve_support_wind_params(wind_p, context, env, vb, rrh_plot_longueur_m, rrh_mat_longueur_m)
        rrh_qp_z = rrh_wind['qp_z']

        try:
            rrh_mat_longueur = int(float(rrh_mat_longueur_m) * 1000) if rrh_mat_longueur_m else context.get('mat_longueur')
        except (ValueError, TypeError):
            rrh_mat_longueur = context.get('mat_longueur')

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
            m_diam_m = float(struct_p.get('mast_d_m') or (float(rrh_mat_diam) / 1000.0 if rrh_mat_diam and str(rrh_mat_diam).replace('.', '').isdigit() else 0.088))
        except (ValueError, TypeError):
            m_diam_m = 0.088

        if wind_p.get('fw_mast') is not None:
            fw_mat = wind_p.get('fw_mast')
        else:
            try:
                fw_mat = round(1.0 * float(rrh_cf_mat) * m_diam_m * float(rrh_qp_z or context.get('qp_z', 0)), 2)
            except (ValueError, TypeError):
                fw_mat = '[Fw,Mat]'

        rrh_screenshot_abs = None
        if job and getattr(job, 'rrh_screenshot', None) and job.rrh_screenshot:
            try:
                if os.path.exists(job.rrh_screenshot.path):
                    rrh_screenshot_abs = job.rrh_screenshot.path
            except Exception:
                pass
        if not rrh_screenshot_abs and job:
            rrh_screenshot_abs = _first_existing_path([
                f"/home/mahdi/worker_share/screenshots/job_{job.id}_rrh_3d_view.jpg",
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
            rrh_tableau_charges_abs = _first_existing_path([
                f"/home/mahdi/worker_share/screenshots/job_{job.id}_rrh_tableau_charges.png",
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
            rrh_verification_screenshot_abs = _first_existing_path([
                f"/home/mahdi/worker_share/screenshots/job_{job.id}_rrh_verification.jpg",
                os.path.join(settings.MEDIA_ROOT, 'verif_rrh', f'job_{job.id}_rrh_verification.jpg'),
            ])

        rrh_paths = find_job_rrh_rtf_paths(job)
        rrh_convert_dir = os.path.join(settings.MEDIA_ROOT, 'notes_rrh')
        job_id_lbl = job.id if job else 'preview'
        rrh_note_mat_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_rrh_note_mat", rrh_paths.get('note_mat'), rrh_convert_dir)
        rrh_note_plot_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_rrh_note_plot", rrh_paths.get('note_plot'), rrh_convert_dir)
        rrh_assemblage_images = _get_or_convert_rtf_images(f"job_{job_id_lbl}_rrh_assemblage", rrh_paths.get('assemblage_note'), rrh_convert_dir, is_assemblage=True)

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
            'rrh_name': first_item.get('name', 'RRH'),
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
        }))

    # Check for RRU (Enabled via toggle, standalone RRU job, or composite Antenna+RRU)
    has_rru_result = (
        res_data.get('has_rru') is True
        or ('rru' in res_data and isinstance(res_data['rru'], dict))
        or bool(res_data.get('rru_items'))
        or bool(res_data.get('rru_totals'))
    )
    is_rru_calc = bool(input_data.get('is_rru') or calc_type in ['rru', 'antenna_with_rru'])

    if (isinstance(rru_eq, dict) and rru_eq.get('enabled')) or has_rru_result or is_rru_calc:
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
        fw_front = totals.get('fw_front', round(cx_front * qp_val, 2) if qp_val else '[Fw,Front]')
        fw_lat = totals.get('fw_lat', round(cx_lat * qp_val, 2) if qp_val else '[Fw,Lat]')

        worker_rru = res_data.get('rru', {}) if isinstance(res_data.get('rru'), dict) else {}
        extremes = rru_ctx.get('extremes') or worker_rru.get('extremes', {}) or res_data.get('extremes', {})
        struct_p = rru_ctx.get('structure') or worker_rru.get('structure_params', {}) or res_data.get('structure_params', {})
        is_standalone_rru = bool(input_data.get('is_rru') and not input_data.get('antenna_4g') and not input_data.get('antenna_5g'))

        # Strict RRU structure defaults (never inherit 4G/5G antenna mast/plot)
        rru_mat_section = (
            struct_p.get('mast_section')
            or (structure_data.get('mast_section') if is_standalone_rru else None)
            or 'TRON 88x2.5'
        )
        rru_mat_longueur_m = (
            struct_p.get('hauteur_mat_m')
            if struct_p.get('hauteur_mat_m') is not None
            else (structure_data.get('hauteur_mat_m') if is_standalone_rru and structure_data.get('hauteur_mat_m') is not None else 1.5)
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

        rru_wind = _resolve_support_wind_params(wind_p, context, env, vb, rru_plot_longueur_m, rru_mat_longueur_m)
        rru_qp_z = rru_wind['qp_z']

        # Re-extract items if worker wind_p didn't provide qp_dan but rru_wind calculated one
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
            rru_mat_longueur = int(float(rru_mat_longueur_m) * 1000)
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
            m_diam_m = float(struct_p.get('mast_d_m') or (float(rru_mat_diam) / 1000.0 if rru_mat_diam and str(rru_mat_diam).replace('.', '').isdigit() else 0.088))
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

        rru_screenshot_abs = _first_existing_path([
            rru_files.get('rru_screenshot'),
            rru_files.get('screenshot'),
            res_data.get('rru_screenshot_path'),
            worker_rru.get('screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'screenshots_rru', f'job_{job.id}_rru_3d_view.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'screenshots_rru', f'job_{job.id}_rru_3d_view.png') if job else None,
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_3d_view.jpg" if job else None,
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_3d_view.png" if job else None,
            os.path.join(settings.MEDIA_ROOT, 'screenshots_rrh', f'job_{job.id}_rru_3d_view.jpg') if job else None,
        ])

        rru_tableau_charges_abs = _first_existing_path([
            rru_files.get('rru_tableau_charges'),
            rru_files.get('tableau_charges'),
            res_data.get('rru_tableau_charges_path'),
            worker_rru.get('tableau_charges_path'),
            os.path.join(settings.MEDIA_ROOT, 'charges_rru', f'job_{job.id}_rru_tableau_charges.png') if job else None,
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_tableau_charges.png" if job else None,
            os.path.join(settings.MEDIA_ROOT, 'charges_rrh', f'job_{job.id}_rru_tableau_charges.png') if job else None,
        ])
        rru_tableau_charges_abs = _crop_tableau_charges_image(rru_tableau_charges_abs)

        rru_verification_screenshot_abs = _first_existing_path([
            rru_files.get('rru_verification_screenshot'),
            rru_files.get('verification_screenshot'),
            res_data.get('rru_verification_screenshot_path'),
            worker_rru.get('verification_screenshot_path'),
            os.path.join(settings.MEDIA_ROOT, 'verif_rru', f'job_{job.id}_rru_verification.jpg') if job else None,
            os.path.join(settings.MEDIA_ROOT, 'verif_rru', f'job_{job.id}_rru_verification.png') if job else None,
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_verification.jpg" if job else None,
            f"/home/mahdi/worker_share/screenshots/job_{job.id}_rru_verification.png" if job else None,
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
            'rru_name': first_item.get('name', 'RRU'),
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
        }))

    return generated_pdfs
