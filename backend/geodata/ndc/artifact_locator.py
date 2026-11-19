"""Job-scoped filesystem artifact locators for Robot notes, assemblages, and screenshots."""
import os
from django.conf import settings


def _worker_screenshots_dir() -> str:
    base = getattr(settings, 'WORKER_SHARE_DIR', '/home/mahdi/worker_share')
    return os.path.join(base, 'screenshots')


def _first_existing_file(candidates):
    for cp in candidates:
        if cp and isinstance(cp, str) and os.path.exists(cp):
            return cp
    return None


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

    ws_dir = _worker_screenshots_dir()
    for cand in [
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_note_de_calcul.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_antenna_note_de_calcul.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_antenna_note_mat.rtf'),
        f"{ws_dir}/job_{job.id}_note_de_calcul.rtf",
        f"{ws_dir}/job_{job.id}_antenna_note_de_calcul.rtf",
    ]:
        if os.path.exists(cand):
            return cand

    if isinstance(getattr(job, 'result_data', None), dict):
        for k in ['note_de_calcul_path', 'antenna_note_de_calcul_path', 'antenna_note_mat_path']:
            raw_path = job.result_data.get(k)
            if raw_path and isinstance(raw_path, str):
                base = os.path.basename(raw_path.replace('\\', '/'))
                for p in [
                    os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', base),
                    f"{ws_dir}/{base}",
                ]:
                    if os.path.exists(p):
                        return p

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
    worker_assemblage = f"{_worker_screenshots_dir()}/job_{job.id}_assemblage_note.rtf"
    if os.path.exists(worker_assemblage):
        return worker_assemblage
    return None


def find_job_equipment_rtf_paths(job, kind: str = 'rrh'):
    """
    Unified RTF/PDF artifact locator for RRH and RRU jobs.
    Strictly segregates `_rru_` vs RRH files so cross-equipment leakage cannot occur.
    """
    kind = kind.lower().strip()
    is_rru = (kind == 'rru')
    res = {'note_mat': None, 'note_plot': None, 'assemblage_note': None}
    if is_rru:
        res['note_de_calcul'] = None
    if not job:
        return res

    res_data = getattr(job, 'result_data', None)
    if not isinstance(res_data, dict):
        res_data = {}
    if not is_rru and res_data.get('has_rrh') is False:
        return res

    sub = res_data.get(kind) if isinstance(res_data.get(kind), dict) else {}
    eq_files = res_data.get(f'{kind}_files') if isinstance(res_data.get(f'{kind}_files'), dict) else {}
    ws_dir = _worker_screenshots_dir()
    primary_media_dir = os.path.join(settings.MEDIA_ROOT, f'notes_{kind}')

    def _job_field_path(field_name: str):
        f_obj = getattr(job, field_name, None)
        if not f_obj:
            return None
        try:
            name_low = (getattr(f_obj, 'name', '') or '').lower()
            path_val = f_obj.path
            path_low = path_val.lower()
            if is_rru:
                if '_rru_' in name_low and os.path.exists(path_val):
                    return path_val
            else:
                if '_rru_' not in name_low and '_rru_' not in path_low and os.path.exists(path_val):
                    return path_val
        except Exception:
            pass
        return None

    mat_cands = []
    if not is_rru:
        mat_cands.append(_job_field_path('note_mat'))
    mat_cands.extend([
        eq_files.get('note_mat'),
        eq_files.get(f'{kind}_note_mat'),
        res_data.get(f'{kind}_note_mat_path'),
        sub.get('note_mat_path'),
        os.path.join(primary_media_dir, f'job_{job.id}_{kind}_note_mat.rtf'),
        f"{ws_dir}/job_{job.id}_{kind}_note_mat.rtf",
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_{kind}_note_mat.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_{kind}_note_mat.rtf'),
    ])
    if is_rru:
        mat_cands.append(_job_field_path('note_mat'))
    res['note_mat'] = _first_existing_file(mat_cands)

    plot_cands = []
    if not is_rru:
        plot_cands.append(_job_field_path('note_plot'))
    plot_cands.extend([
        eq_files.get('note_plot'),
        eq_files.get(f'{kind}_note_plot'),
        res_data.get(f'{kind}_note_plot_path'),
        sub.get('note_plot_path'),
        os.path.join(primary_media_dir, f'job_{job.id}_{kind}_note_plot.rtf'),
        f"{ws_dir}/job_{job.id}_{kind}_note_plot.rtf",
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_{kind}_note_plot.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_{kind}_note_plot.rtf'),
    ])
    if is_rru:
        plot_cands.append(_job_field_path('note_plot'))
    res['note_plot'] = _first_existing_file(plot_cands)

    ass_cands = []
    if not is_rru:
        ass_cands.append(_job_field_path('rrh_assemblage_note'))
    ass_cands.extend([
        eq_files.get('assemblage_note'),
        eq_files.get(f'{kind}_assemblage_note'),
        res_data.get(f'{kind}_assemblage_note_path'),
        sub.get('assemblage_note_path'),
        os.path.join(primary_media_dir, f'job_{job.id}_{kind}_assemblage_note.rtf'),
        f"{ws_dir}/job_{job.id}_{kind}_assemblage_note.rtf",
        os.path.join(settings.MEDIA_ROOT, 'assemblages', f'job_{job.id}_{kind}_assemblage_note.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_{kind}_assemblage_note.rtf'),
    ])
    if is_rru:
        ass_cands.append(_job_field_path('rrh_assemblage_note'))
    res['assemblage_note'] = _first_existing_file(ass_cands)

    if is_rru:
        res['note_de_calcul'] = _first_existing_file([
            eq_files.get('note_de_calcul'),
            eq_files.get('note_de_calcul_rru'),
            eq_files.get('rru_note_de_calcul'),
            res_data.get('rru_note_de_calcul_path'),
            res_data.get('note_de_calcul_rru_path'),
            sub.get('note_de_calcul_path'),
            os.path.join(primary_media_dir, f'job_{job.id}_rru_note_de_calcul.pdf'),
            os.path.join(primary_media_dir, f'job_{job.id}_rru_note_de_calcul.rtf'),
            os.path.join(primary_media_dir, f'job_{job.id}_note_de_calcul_rru.pdf'),
            os.path.join(primary_media_dir, f'job_{job.id}_note_de_calcul_rru.rtf'),
            f"{ws_dir}/job_{job.id}_rru_note_de_calcul.rtf",
            f"{ws_dir}/job_{job.id}_rru_note_de_calcul.pdf",
        ])

    return res


def find_job_rrh_rtf_paths(job):
    """Strictly find the RRH RTF files belonging to this job."""
    return find_job_equipment_rtf_paths(job, kind='rrh')


def find_job_rru_rtf_paths(job):
    """Strictly find the RRU RTF/PDF files belonging to this job."""
    return find_job_equipment_rtf_paths(job, kind='rru')


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
            for key_suffix, field, is_ass in [
                ('rrh_note_mat', 'note_mat', False),
                ('rrh_note_plot', 'note_plot', False),
                ('rrh_assemblage', 'assemblage_note', True),
            ]:
                if rrh_paths.get(field):
                    prefix = f"job_{first_job.id}_{key_suffix}"
                    specs.append({
                        'rtf_path': rrh_paths[field],
                        'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rrh'),
                        'prefix': prefix,
                        'is_assemblage': is_ass,
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
            for key_suffix, field, is_ass in [
                ('rru_note_mat', 'note_mat', False),
                ('rru_note_plot', 'note_plot', False),
                ('rru_assemblage', 'assemblage_note', True),
            ]:
                if rru_paths.get(field):
                    prefix = f"job_{first_job.id}_{key_suffix}"
                    specs.append({
                        'rtf_path': rru_paths[field],
                        'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_rru'),
                        'prefix': prefix,
                        'is_assemblage': is_ass,
                        'key': prefix,
                    })

    return specs

