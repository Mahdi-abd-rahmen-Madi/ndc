import os
import shutil
import subprocess
import tempfile
from django.conf import settings
from django.core.files import File
from .models import CalculationJob
from utils.domain_constants import parse_json_dict, resolve_sans_plot


def extract_ndc_context(job) -> dict:
    """
    Extracts RRH data, wind parameters, support geometry and reactions from job.result_data
    using the canonical geodata extractor (single source of truth).
    """
    from geodata.ndc_generator import extract_rrh_ndc_context
    res = parse_json_dict(getattr(job, 'result_data', None))
    inp = parse_json_dict(getattr(job, 'input_data', None))
    return extract_rrh_ndc_context(res, input_data=inp)


def extract_rru_docx_context(job) -> dict:
    """
    Extracts RRU data, wind parameters, support geometry and reactions from job.result_data
    using the canonical geodata extractor (single source of truth).
    """
    from geodata.ndc_generator import extract_rru_ndc_context
    res = parse_json_dict(getattr(job, 'result_data', None))
    inp = parse_json_dict(getattr(job, 'input_data', None))
    return extract_rru_ndc_context(res, input_data=inp)


def extract_fh_docx_context(job) -> dict:
    """
    Extracts FH data, wind parameters, support geometry and reactions from job.result_data
    using the canonical geodata extractor (single source of truth).
    """
    from geodata.ndc_generator import extract_fh_ndc_context
    res = parse_json_dict(getattr(job, 'result_data', None))
    inp = parse_json_dict(getattr(job, 'input_data', None))
    return extract_fh_ndc_context(res, input_data=inp)


_DOCX_EQUIPMENT_DEFAULTS = {
    "rrh": {
        "label": "RRH",
        "depth_key": "t_mm",
        "mast_section": "TRON 88x3.2",
        "plot_section": "TCAR 200x5",
        "terrain_type": "IIIa",
        "vb0": 26.0,
        "qp_dan": 123.57,
        "template_rel": os.path.join("templates", "rrh", "NDC RRH-1.docx"),
    },
    "rru": {
        "label": "RRU",
        "depth_key": "d_mm",
        "mast_section": "TRON 88x2.5",
        "plot_section": "TCAR 150x5",
        "terrain_type": "II",
        "vb0": 24.0,
        "qp_dan": 45.0,
        "template_rel": os.path.join("templates", "rru", "NDC RRU.docx"),
    },
    "fh": {
        "label": "FH",
        "depth_key": "diameter_mm",
        "mast_section": "TRON 88x2.5",
        "plot_section": "TCAR 150x5",
        "terrain_type": "II",
        "vb0": 24.0,
        "qp_dan": 95.36,
        "template_rel": os.path.join("templates", "fh", "NDC FH.docx"),
    },
}


def _populate_equipment_docx(doc, ctx, kind: str = "rrh"):
    """
    Unified DOCX populator for RRH and RRU Note de Calcul templates.
    Populates Table 0 (equipments), Table 1 (support geometry), wind hypotheses,
    and aerodynamic force paragraphs without re-calculating forces.
    """
    from geodata.ndc_generator import clean_equipment_designation

    cfg = _DOCX_EQUIPMENT_DEFAULTS.get(kind, _DOCX_EQUIPMENT_DEFAULTS["rrh"])
    label = cfg["label"]
    depth_key = cfg["depth_key"]

    items = ctx.get("items", [])
    wind = ctx.get("wind", {})
    structure = ctx.get("structure", {})
    is_sans_plot = bool(ctx.get("is_sans_plot") or structure.get("sans_plot"))

    # 1. Populate Table 0 ("Équipements considérés")
    if doc.tables:
        table0 = doc.tables[0]
        for i, item in enumerate(items):
            if i == 0 and len(table0.rows) > 1:
                row = table0.rows[1]
            else:
                row = table0.add_row()
            row.cells[0].text = clean_equipment_designation(str(item.get("name", label)))
            row.cells[1].text = str(item.get("qty", 1))
            if kind == "fh":
                row.cells[2].text = str(item.get("dimensions_str") or f"Ø{item.get('diameter_mm', 600):g}")
                row.cells[3].text = str(item.get("weight_unit_kg") or f"{float(item.get('weight_kg', 0)):g}")
            else:
                depth_val = item.get(depth_key, item.get("t_mm", item.get("d_mm", 0)))
                row.cells[2].text = str(
                    item.get("dimensions_str")
                    or f"{item.get('h_mm', 0):g} x {item.get('w_mm', 0):g} x {depth_val:g}"
                )
                row.cells[3].text = f"{float(item.get('weight_kg', 0)):.1f}"
                if len(row.cells) > 4:
                    row.cells[4].text = "Projet"

    # 2. Populate Table 1 ("Géométrie des pièces")
    if len(doc.tables) > 1:
        table1 = doc.tables[1]
        mast_sec = structure.get("mast_section") or cfg["mast_section"]
        mast_h = structure.get("hauteur_mat_m") if structure.get("hauteur_mat_m") is not None else (1.7 if kind == "fh" else 1.5)
        plot_sec = structure.get("plot_section") or cfg["plot_section"]
        plot_h = structure.get("plot_h_m") if structure.get("plot_h_m") is not None else 0.5
        if len(table1.rows) > 1:
            table1.rows[1].cells[0].text = str(mast_sec)
            table1.rows[1].cells[1].text = f"{float(mast_h):g}"
            table1.rows[1].cells[2].text = "Mat principal"
        if is_sans_plot:
            if len(table1.rows) > 2:
                tr = table1.rows[2]._tr
                tr.getparent().remove(tr)
        else:
            if len(table1.rows) > 2:
                table1.rows[2].cells[0].text = str(plot_sec)
                table1.rows[2].cells[1].text = f"{float(plot_h):g}"
                table1.rows[2].cells[2].text = "Plot"

    # 3. Wind variables
    region = wind.get("region", 2)
    terrain = wind.get("terrain_type", cfg["terrain_type"])
    building_h = float(wind.get("building_height_m", 0.0) or 0.0)
    vb0 = float(wind.get("vb0_ms") or wind.get("v_b0") or cfg["vb0"])
    kr = float(wind.get("kr_z") or wind.get("kr") or 0.19)
    cr = float(wind.get("cr_z") or wind.get("cr") or 1.25)
    vm = float(wind.get("vm_z") or wind.get("vm") or round(cr * vb0, 2))
    iv = float(wind.get("iv_z") or wind.get("iv") or 0.15)
    qp = float(wind.get("qp_dan", cfg["qp_dan"]) or cfg["qp_dan"])

    cf_mast = float(wind.get("cf_mast", 1.0) or 1.0)
    mast_d_m = float(structure.get("mast_d_m", 0.088) or 0.088)
    fw_mast = float(wind.get("fw_mast", round(1.0 * cf_mast * mast_d_m * qp, 2)) or 0.0)

    # 4. Paragraph replacements
    for p in doc.paragraphs:
        txt = p.text
        if "Région XX" in txt:
            p.text = f"Région {region}"
        elif "Catégorie de terrain" in txt and "XX" in txt:
            p.text = f"Catégorie de terrain : {terrain}"
        elif "Hauteur" in txt and "XXm" in txt:
            p.text = f"Hauteur : {building_h:g}m"
        elif "Vb= XXm/s" in txt:
            p.text = f"Vb= {vb0:g}m/s"
        elif "kr=" in txt and "0.19" in txt and "XX" in txt:
            p.text = f"kr= 0.19.(z0/z0,II)0.07 = {kr:.2f}"
        elif "cr" in txt and "ln(z" in txt and "XX" in txt:
            p.text = f"cr(z) = kr⋅ln(z/z0) = {cr:.2f}"
        elif "Vm = XXxXX" in txt:
            p.text = f"Vm = {cr:.2f} x {vb0:g} = {vm:.2f} m/s"
        elif "Iv(z) =" in txt and "XX" in txt:
            p.text = f"Iv(z) = 1/ln(z/z0) = {iv:.2f}"
        elif "qp =" in txt and "XX" in txt:
            p.text = f"qp = {qp:.2f} daN/m²"
        elif "Mat" in txt and "Fw" in txt and ("XX" in txt or "daN/ml" in txt):
            p.text = f"Mât : Fw = 1 * {cf_mast:g} * {mast_d_m:g} * {qp:.2f} = {fw_mast:.2f} daN/ml"
        elif "Antenne FH" in txt and "FwFH" in txt:
            if len(items) == 1:
                p.text = f"Antenne FH : FwFH = {items[0].get('fw_fh_formula', 'N/A')}"
            else:
                lines = [f"{it.get('name', 'Antenne FH')} : FwFH = {it.get('fw_fh_formula', 'N/A')}" for it in items]
                totals = ctx.get("totals", {})
                lines.append(f"TOTAL Antenne FH : FwFH = {totals.get('fw_fh_formula', 'N/A')}")
                p.text = "\n".join(lines)

    # 5. Replace equipment aerodynamic force paragraphs
    front_marker = f"{label} : Fw,Frontale"
    lat_marker = f"{label} : Fw,Latéral"
    for idx, p in enumerate(doc.paragraphs):
        if front_marker in p.text:
            if len(items) == 1:
                p.text = f"{front_marker} = {items[0].get('fw_front_formula', 'N/A')}"
                if idx + 1 < len(doc.paragraphs) and lat_marker in doc.paragraphs[idx + 1].text:
                    doc.paragraphs[idx + 1].text = f"{lat_marker} = {items[0].get('fw_lat_formula', 'N/A')}"
            else:
                lines = []
                for it in items:
                    idx_label = f"{label} #{it.get('index', 1)} ({it.get('name', label)})"
                    lines.append(f"{idx_label} : Fw,Frontale = {it.get('fw_front_formula', 'N/A')}")
                    lines.append(f"{idx_label} : Fw,Latéral = {it.get('fw_lat_formula', 'N/A')}")
                p.text = "\n".join(lines)
                if idx + 1 < len(doc.paragraphs) and lat_marker in doc.paragraphs[idx + 1].text:
                    doc.paragraphs[idx + 1].text = ""
            break


def _populate_rrh_docx(doc, ctx):
    return _populate_equipment_docx(doc, ctx, kind="rrh")


def _populate_rru_docx(doc, ctx):
    return _populate_equipment_docx(doc, ctx, kind="rru")


def _populate_fh_docx(doc, ctx):
    return _populate_equipment_docx(doc, ctx, kind="fh")


def validate_calculation_artifacts(job, files=None) -> list:
    """
    Hardened validator ensuring all strictly required artifacts exist for a calculation job.
    Returns a list of missing artifact descriptions.
    If the returned list is empty, the calculation artifacts are 100% complete.
    """
    if not job:
        return ["Données du job introuvables"]

    files = files or {}
    missing = []

    calc_type = getattr(job, 'calculation_type', 'antenna') or 'antenna'
    input_data = job.input_data if isinstance(getattr(job, 'input_data', None), dict) else {}
    result_data = job.result_data if isinstance(getattr(job, 'result_data', None), dict) else {}

    # 1. Base Antenna Verification (applicable to antenna and composite antenna+rrh/rru/fh)
    is_pure_rrh = (calc_type == 'rrh')
    is_pure_rru = (calc_type == 'rru')
    is_pure_fh = (calc_type in ('fh', 'fh_sans_plot'))

    if not is_pure_rrh and not is_pure_rru and not is_pure_fh:
        # 3D view
        has_3d = bool(
            getattr(job, 'screenshot', None)
            or files.get('screenshot')
            or files.get('antenna_screenshot')
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots', f'job_{job.id}_3d_view.jpg'))
        )
        if not has_3d:
            missing.append("Capture 3D antenne (page 4)")

        # Member Verification table (Robot steel verification ELU/ELS)
        has_verif = bool(
            getattr(job, 'verification_screenshot', None)
            or files.get('verification_screenshot')
            or files.get('antenna_verification_screenshot')
            or files.get('verification_view')
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots', 'verification', f'job_{job.id}_verification.jpg'))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots', f'job_{job.id}_verification.jpg'))
        )
        if not has_verif:
            missing.append("Capture de vérification Robot ELU/ELS (page 7)")

        # Member Calculation Note (RTF)
        from geodata.ndc_generator import find_job_note_de_calcul_path
        ndc_path = find_job_note_de_calcul_path(job)
        has_ndc = bool(
            ndc_path
            or getattr(job, 'note_de_calcul', None)
            or files.get('note_de_calcul')
            or files.get('antenna_note_de_calcul')
            or files.get('antenna_note_mat')
        )
        if not has_ndc:
            missing.append("Note de calcul RTF du mât principal (page 8)")

        # Assemblage Note (RTF)
        from geodata.ndc_generator import find_job_assemblage_note_path
        ass_path = find_job_assemblage_note_path(job)
        has_assemblage = bool(
            ass_path
            or getattr(job, 'assemblage_note', None)
            or files.get('assemblage_note')
            or files.get('antenna_assemblage_note')
        )
        if not has_assemblage:
            missing.append("Note de calcul d'assemblage Robot (page 9+)")

    # 2. RRH Verification (if RRH is enabled or calculation_type is rrh / antenna_with_rrh)
    has_rrh = (
        calc_type in ['rrh', 'antenna_with_rrh', 'antenna_with_rrh_sans_plot']
        or bool(input_data.get('rrh_equipment', {}).get('enabled'))
        or bool(result_data.get('has_rrh'))
    )
    if has_rrh:
        from geodata.ndc_generator import find_job_rrh_rtf_paths
        rrh_paths = find_job_rrh_rtf_paths(job)

        has_rrh_3d = bool(
            getattr(job, 'rrh_screenshot', None)
            or files.get('rrh_screenshot')
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots_rrh', f'job_{job.id}_rrh_3d_view.jpg'))
        )
        if not has_rrh_3d:
            missing.append("Capture 3D modélisation RRH (page 14)")

        has_rrh_verif = bool(
            getattr(job, 'rrh_verification_screenshot', None)
            or files.get('rrh_verification_screenshot')
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'verif_rrh', f'job_{job.id}_rrh_verification.jpg'))
        )
        if not has_rrh_verif:
            missing.append("Capture de vérification Robot RRH (page 16)")

        has_rrh_mat = bool(
            rrh_paths.get('note_mat')
            or getattr(job, 'note_de_calcul_rrh', None)
            or getattr(job, 'note_mat', None)
            or files.get('note_de_calcul_rrh')
            or files.get('rrh_note_de_calcul')
            or files.get('rrh_note_mat')
        )
        if not has_rrh_mat:
            missing.append("Note de calcul RTF du mât RRH (page 17)")

        has_rrh_charges = bool(
            getattr(job, 'rrh_tableau_charges', None)
            or files.get('rrh_tableau_charges')
            or files.get('loads_table')
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'charges_rrh', f'job_{job.id}_rrh_tableau_charges.png'))
        )
        if not has_rrh_charges:
            missing.append("Tableau des charges RRH (page 15)")

        # Determine if RRH is sans_plot (canonical helper shared across hash/views/ndc)
        is_rrh_sans_plot = resolve_sans_plot(input_data, result_data, calc_type=calc_type, kind="rrh")

        # Only require rrh_assemblage_note (page 21+) when WITH plot:
        if not is_rrh_sans_plot:
            has_rrh_ass = bool(
                rrh_paths.get('assemblage_note')
                or getattr(job, 'rrh_assemblage_note', None)
                or files.get('rrh_assemblage_note')
                or files.get('note_assemblage_rrh')
                or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'notes_rrh', f'job_{job.id}_rrh_assemblage_note.rtf'))
                or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'assemblages', f'job_{job.id}_rrh_assemblage_note.rtf'))
            )
            if not has_rrh_ass:
                missing.append("Note d'assemblage Robot RRH (page 21+)")

    # 3. FH Verification (if FH is enabled or calculation_type is fh / antenna_with_fh)
    has_fh = (
        calc_type in ['fh', 'fh_sans_plot', 'antenna_with_fh', 'antenna_with_fh_sans_plot']
        or bool(input_data.get('fh_equipment', {}).get('enabled'))
        or bool(result_data.get('has_fh'))
        or bool(input_data.get('is_fh'))
    )
    if has_fh:
        from geodata.ndc_generator import find_job_fh_rtf_paths
        fh_paths = find_job_fh_rtf_paths(job)

        has_fh_3d = bool(
            getattr(job, 'fh_screenshot', None)
            or (is_pure_fh and getattr(job, 'screenshot', None))
            or files.get('fh_screenshot')
            or (is_pure_fh and files.get('screenshot'))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots_fh', f'job_{job.id}_fh_3d_view.jpg'))
        )
        if not has_fh_3d:
            missing.append("Capture 3D modélisation FH (page 2)")

        has_fh_verif = bool(
            getattr(job, 'fh_verification_screenshot', None)
            or (is_pure_fh and getattr(job, 'verification_screenshot', None))
            or files.get('fh_verification_screenshot')
            or (is_pure_fh and files.get('verification_screenshot'))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'verif_fh', f'job_{job.id}_fh_verification.jpg'))
        )
        if not has_fh_verif:
            missing.append("Capture de vérification Robot FH (page 4)")

        has_fh_mat = bool(
            fh_paths.get('note_mat')
            or getattr(job, 'note_de_calcul_fh', None)
            or (is_pure_fh and getattr(job, 'note_de_calcul', None))
            or (is_pure_fh and getattr(job, 'note_mat', None))
            or files.get('note_de_calcul_fh')
            or files.get('fh_note_de_calcul')
            or files.get('fh_note_mat')
            or (is_pure_fh and files.get('note_de_calcul'))
            or (is_pure_fh and files.get('note_mat'))
        )
        if not has_fh_mat:
            missing.append("Note de calcul RTF du mât FH")

        has_fh_charges = bool(
            getattr(job, 'fh_tableau_charges', None)
            or files.get('fh_tableau_charges')
            or files.get('fh_loads_table')
            or (is_pure_fh and files.get('loads_table'))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'charges_fh', f'job_{job.id}_fh_tableau_charges.png'))
        )
        if not has_fh_charges:
            missing.append("Tableau des charges FH (page 3)")

        is_fh_sans_plot = resolve_sans_plot(input_data, result_data, calc_type=calc_type, kind="fh")
        if not is_fh_sans_plot:
            has_fh_ass = bool(
                fh_paths.get('assemblage_note')
                or getattr(job, 'fh_assemblage_note', None)
                or (is_pure_fh and getattr(job, 'assemblage_note', None))
                or files.get('fh_assemblage_note')
                or (is_pure_fh and files.get('assemblage_note'))
                or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'notes_fh', f'job_{job.id}_fh_assemblage_note.rtf'))
            )
            if not has_fh_ass:
                missing.append("Note d'assemblage Robot FH")

    return missing


def assemble_ndc_document(calculation_id):
    """
    Assembles the final Note de Calcul document locally on the Django backend
    based on raw artifacts (RTF notes, reactions, screenshots) from the Unified Robot Worker.
    """
    try:
        job = CalculationJob.objects.get(id=calculation_id)
    except CalculationJob.DoesNotExist:
        print(f"assemble_ndc_document: Job {calculation_id} not found.")
        return

    # Hardening: Validate artifacts before assembling
    missing = validate_calculation_artifacts(job)
    if missing:
        print(f"[NDC HARDENING] Job {calculation_id} has missing artifacts ({', '.join(missing)}). Aborting compilation.")
        if job.status == 'COMPLETED':
            job.status = 'FAILED'
            job.error_message = f"Calcul incomplet rejeté : artéfacts obligatoires manquants ({', '.join(missing)})."
            job.save(update_fields=['status', 'error_message'])
        return

    if job.calculation_type in ("rrh", "rru", "fh", "fh_sans_plot"):
        _assemble_equipment_doc(job, kind="fh" if "fh" in job.calculation_type else job.calculation_type)
    else:
        _assemble_antenna(job)


def _assemble_equipment_doc(job, kind: str = "rrh"):
    """
    Unified Note de Calcul document assembler for RRH and RRU jobs.
    1) Attempts native WeasyPrint compilation via geodata.ndc_generator.generate_auxiliary_pdfs.
    2) Populates the DOCX template and saves it cleanly without leaving duplicate temp files.
    3) Falls back to isolated LibreOffice DOCX->PDF conversion if WeasyPrint failed.
    """
    cfg = _DOCX_EQUIPMENT_DEFAULTS.get(kind, _DOCX_EQUIPMENT_DEFAULTS["rrh"])
    label = cfg["label"]
    prefix = f"ndc_{kind}_{job.id}"

    weasyprint_success = False
    try:
        from geodata.ndc_generator import generate_auxiliary_pdfs
        generated = generate_auxiliary_pdfs(job)
        if generated and os.path.exists(generated[0]):
            with open(generated[0], "rb") as f:
                job.compiled_pdf.save(f"{prefix}.pdf", File(f), save=False)
            job.save()
            weasyprint_success = True
            print(f"assemble_ndc_document: Successfully compiled {label} NDC via WeasyPrint for Job {job.id}.")
    except Exception as html_err:
        print(f"WeasyPrint {label} compilation note: {html_err}")

    template_path = os.path.join(settings.BASE_DIR, cfg["template_rel"])
    if not os.path.exists(template_path):
        print(f"assemble_ndc_document: Template not found at {template_path}")
        return

    work_dir = tempfile.mkdtemp(prefix=f"ndc_{kind}_{job.id}_")
    try:
        from docx import Document
        doc = Document(template_path)

        if kind == "rru":
            ctx = extract_rru_docx_context(job)
        elif kind == "fh":
            ctx = extract_fh_docx_context(job)
        else:
            ctx = extract_ndc_context(job)
        _populate_equipment_docx(doc, ctx, kind=kind)

        temp_docx = os.path.join(work_dir, f"{prefix}.docx")
        doc.save(temp_docx)

        with open(temp_docx, "rb") as f:
            job.compiled_docx.save(f"{prefix}.docx", File(f), save=False)

        if not weasyprint_success:
            try:
                from utils.libreoffice import convert_to_pdf
                produced = convert_to_pdf(temp_docx, work_dir, timeout=60)
                if produced and os.path.exists(produced[0]):
                    with open(produced[0], "rb") as f:
                        job.compiled_pdf.save(f"{prefix}.pdf", File(f), save=False)
            except Exception as conv_err:
                print(f"LibreOffice PDF conversion note: {conv_err}")

        job.save()
        print(f"assemble_ndc_document: Compiled {label} DOCX for Job {job.id}.")
    except Exception as e:
        print(f"assemble_ndc_document error for {label} Job {job.id}: {e}")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _assemble_rru(job):
    return _assemble_equipment_doc(job, kind="rru")


def _assemble_rrh(job):
    return _assemble_equipment_doc(job, kind="rrh")


def _assemble_fh(job):
    return _assemble_equipment_doc(job, kind="fh")


def _assemble_antenna(job):
    """
    Triggers the existing antenna NDC generation pipeline via geodata.ndc_generator.
    """
    try:
        from geodata.ndc_generator import generate_ndc_pdf_task
        photo_url = (job.input_data or {}).get("site_image_url", "")
        pdf_url = generate_ndc_pdf_task(job.id, photo_url)
        print(f"assemble_ndc_document: Successfully compiled Antenna NDC for Job {job.id}: {pdf_url}")
    except Exception as e:
        print(f"assemble_ndc_document error for Antenna Job {job.id}: {e}")


