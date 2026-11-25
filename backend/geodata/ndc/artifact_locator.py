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
    Unified RTF/PDF artifact locator for RRH, RRU, FH, and Lovage jobs.
    Strictly segregates `_rru_`, `_rrh_`, `_fh_`, and `_lovage_` files so cross-equipment leakage cannot occur.
    """
    kind = kind.lower().strip()
    is_rru = (kind == 'rru')
    is_fh = (kind == 'fh')
    is_lovage = (kind == 'lovage')
    res = {'note_mat': None, 'note_plot': None, 'assemblage_note': None}
    if is_rru or is_fh or is_lovage:
        res['note_de_calcul'] = None
    if not job:
        return res

    res_data = getattr(job, 'result_data', None)
    if not isinstance(res_data, dict):
        res_data = {}
    if not is_rru and not is_fh and not is_lovage and res_data.get('has_rrh') is False:
        return res
    if is_fh and res_data.get('has_fh') is False:
        return res
    if is_lovage and res_data.get('has_lovage') is False:
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
            elif is_fh:
                if ('_fh_' in name_low or 'notes_fh' in path_low or 'fh' in name_low) and os.path.exists(path_val):
                    return path_val
            elif is_lovage:
                if ('_lovage_' in name_low or 'notes_lovage' in path_low) and os.path.exists(path_val):
                    return path_val
            else:
                if '_rru_' not in name_low and '_rru_' not in path_low and '_fh_' not in name_low and '_lovage_' not in name_low and os.path.exists(path_val):
                    return path_val
        except Exception:
            pass
        return None

    mat_cands = []
    if is_fh:
        mat_cands.append(_job_field_path('fh_note_mat'))
        mat_cands.append(_job_field_path('note_de_calcul_fh'))
    elif not is_rru and not is_lovage:
        mat_cands.append(_job_field_path('note_mat'))
        mat_cands.append(_job_field_path('note_de_calcul_rrh'))
    mat_cands.extend([
        eq_files.get('note_mat'),
        eq_files.get(f'{kind}_note_mat'),
        eq_files.get('note_de_calcul'),
        eq_files.get(f'note_de_calcul_{kind}'),
        eq_files.get(f'{kind}_note_de_calcul'),
        res_data.get(f'{kind}_note_mat_path'),
        res_data.get(f'{kind}_note_de_calcul_path'),
        res_data.get(f'note_de_calcul_{kind}_path'),
        sub.get('note_mat_path'),
        sub.get('note_de_calcul_path'),
        os.path.join(primary_media_dir, f'job_{job.id}_{kind}_note_mat.rtf'),
        os.path.join(primary_media_dir, f'job_{job.id}_{kind}_note_de_calcul.rtf'),
        os.path.join(primary_media_dir, f'job_{job.id}_note_de_calcul_{kind}.rtf'),
        f"{ws_dir}/job_{job.id}_{kind}_note_mat.rtf",
        f"{ws_dir}/job_{job.id}_{kind}_note_de_calcul.rtf",
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_{kind}_note_mat.rtf'),
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_{kind}_note_de_calcul.rtf'),
    ])
    if not is_fh and not is_lovage:
        mat_cands.append(os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_{kind}_note_mat.rtf'))
    if is_rru or is_lovage:
        mat_cands.append(_job_field_path('note_mat'))
    res['note_mat'] = _first_existing_file(mat_cands)

    plot_cands = []
    if is_fh:
        plot_cands.append(_job_field_path('fh_note_plot'))
    elif not is_rru and not is_lovage:
        plot_cands.append(_job_field_path('note_plot'))
    plot_cands.extend([
        eq_files.get('note_plot'),
        eq_files.get(f'{kind}_note_plot'),
        res_data.get(f'{kind}_note_plot_path'),
        sub.get('note_plot_path'),
        os.path.join(primary_media_dir, f'job_{job.id}_{kind}_note_plot.rtf'),
        f"{ws_dir}/job_{job.id}_{kind}_note_plot.rtf",
        os.path.join(settings.MEDIA_ROOT, 'notes_de_calcul', f'job_{job.id}_{kind}_note_plot.rtf'),
    ])
    if not is_fh and not is_lovage:
        plot_cands.append(os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_{kind}_note_plot.rtf'))
    if is_rru or is_lovage:
        plot_cands.append(_job_field_path('note_plot'))
    res['note_plot'] = _first_existing_file(plot_cands)

    ass_cands = []
    if is_fh:
        ass_cands.append(_job_field_path('fh_assemblage_note'))
    elif not is_rru and not is_lovage:
        ass_cands.append(_job_field_path('rrh_assemblage_note'))
    ass_cands.extend([
        eq_files.get('assemblage_note'),
        eq_files.get(f'{kind}_assemblage_note'),
        res_data.get(f'{kind}_assemblage_note_path'),
        sub.get('assemblage_note_path'),
        os.path.join(primary_media_dir, f'job_{job.id}_{kind}_assemblage_note.rtf'),
        f"{ws_dir}/job_{job.id}_{kind}_assemblage_note.rtf",
        os.path.join(settings.MEDIA_ROOT, 'assemblages', f'job_{job.id}_{kind}_assemblage_note.rtf'),
    ])
    if not is_fh and not is_lovage:
        ass_cands.append(os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_{kind}_assemblage_note.rtf'))
    if is_rru or is_lovage:
        ass_cands.append(_job_field_path('rrh_assemblage_note'))
    res['assemblage_note'] = _first_existing_file(ass_cands)

    if is_rru or is_fh or is_lovage:
        ndc_field = 'note_de_calcul_fh' if is_fh else 'note_de_calcul'
        res['note_de_calcul'] = _first_existing_file([
            _job_field_path(ndc_field) if is_fh else None,
            eq_files.get('note_de_calcul'),
            eq_files.get(f'note_de_calcul_{kind}'),
            eq_files.get(f'{kind}_note_de_calcul'),
            res_data.get(f'{kind}_note_de_calcul_path'),
            res_data.get(f'note_de_calcul_{kind}_path'),
            sub.get('note_de_calcul_path'),
            os.path.join(primary_media_dir, f'job_{job.id}_{kind}_note_de_calcul.pdf'),
            os.path.join(primary_media_dir, f'job_{job.id}_{kind}_note_de_calcul.rtf'),
            os.path.join(primary_media_dir, f'job_{job.id}_note_de_calcul_{kind}.pdf'),
            os.path.join(primary_media_dir, f'job_{job.id}_note_de_calcul_{kind}.rtf'),
            f"{ws_dir}/job_{job.id}_{kind}_note_de_calcul.rtf",
            f"{ws_dir}/job_{job.id}_{kind}_note_de_calcul.pdf",
        ])

    return res


def find_job_rrh_rtf_paths(job):
    """Strictly find the RRH RTF files belonging to this job."""
    return find_job_equipment_rtf_paths(job, kind='rrh')


def find_job_rru_rtf_paths(job):
    """Strictly find the RRU RTF/PDF files belonging to this job."""
    return find_job_equipment_rtf_paths(job, kind='rru')


def find_job_fh_rtf_paths(job):
    """Strictly find the FH RTF/PDF files belonging to this job."""
    return find_job_equipment_rtf_paths(job, kind='fh')


def find_job_lovage_rtf_paths(job):
    """Strictly find the Boîtier de lovage RTF/PDF files belonging to this job."""
    return find_job_equipment_rtf_paths(job, kind='lovage')


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
        calc_type = str(getattr(first_job, 'calculation_type', '') or '').lower()
        active_eqs = res_data.get('active_equipments') if isinstance(res_data.get('active_equipments'), list) else []

        rrh_data = input_data.get('rrh_equipment', {})
        rrh_enabled = isinstance(rrh_data, dict) and rrh_data.get('enabled', False)
        rru_data = input_data.get('rru_equipment', {})
        rru_enabled = isinstance(rru_data, dict) and rru_data.get('enabled', False)

        is_rrh_eligible = (
            res_data.get('has_rrh') is not False
            and (
                rrh_enabled
                or res_data.get('has_rrh') is True
                or 'rrh' in active_eqs
                or 'rrh' in calc_type.split('_')
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
            res_data.get('has_rru') is not False
            and (
                rru_enabled
                or res_data.get('has_rru') is True
                or 'rru' in active_eqs
                or bool(res_data.get('rru_items'))
                or bool(input_data.get('is_rru'))
                or 'rru' in calc_type.split('_')
            )
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

        fh_data = input_data.get('fh_equipment', {})
        fh_enabled = isinstance(fh_data, dict) and fh_data.get('enabled', False)
        is_fh_eligible = (
            res_data.get('has_fh') is not False
            and (
                fh_enabled
                or res_data.get('has_fh') is True
                or 'fh' in active_eqs
                or bool(res_data.get('fh_items'))
                or bool(input_data.get('is_fh'))
                or 'fh' in calc_type.split('_')
            )
        )
        if is_fh_eligible:
            fh_paths = find_job_fh_rtf_paths(first_job)
            for key_suffix, field, is_ass in [
                ('fh_note_mat', 'note_mat', False),
                ('fh_note_plot', 'note_plot', False),
                ('fh_assemblage', 'assemblage_note', True),
            ]:
                if fh_paths.get(field):
                    prefix = f"job_{first_job.id}_{key_suffix}"
                    specs.append({
                        'rtf_path': fh_paths[field],
                        'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_fh'),
                        'prefix': prefix,
                        'is_assemblage': is_ass,
                        'key': prefix,
                    })

        lovage_data = input_data.get('boitier_lovage') or input_data.get('lovage_equipment') or {}
        lovage_enabled = isinstance(lovage_data, dict) and lovage_data.get('enabled', False)
        is_lovage_eligible = (
            res_data.get('has_lovage') is not False
            and (
                lovage_enabled
                or res_data.get('has_lovage') is True
                or 'lovage' in active_eqs
                or bool(res_data.get('lovage_items'))
                or bool(input_data.get('is_lovage'))
                or 'lovage' in calc_type.split('_')
            )
        )
        if is_lovage_eligible:
            lovage_paths = find_job_lovage_rtf_paths(first_job)
            for key_suffix, field, is_ass in [
                ('lovage_note_mat', 'note_mat', False),
                ('lovage_note_plot', 'note_plot', False),
                ('lovage_assemblage', 'assemblage_note', True),
            ]:
                if lovage_paths.get(field):
                    prefix = f"job_{first_job.id}_{key_suffix}"
                    specs.append({
                        'rtf_path': lovage_paths[field],
                        'convert_dir': os.path.join(settings.MEDIA_ROOT, 'notes_lovage'),
                        'prefix': prefix,
                        'is_assemblage': is_ass,
                        'key': prefix,
                    })

    return specs

