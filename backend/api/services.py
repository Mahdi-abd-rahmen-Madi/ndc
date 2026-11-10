import os
import subprocess
from django.conf import settings
from django.core.files import File
from .models import CalculationJob


def extract_ndc_context(job) -> dict:
    """
    Extracts multi-RRH data, wind parameters, support geometry and reactions
    strictly from job.result_data, adhering to the Golden Rule:
    Never re-calculate aerodynamic forces or wind pressure.
    """
    res = job.result_data if job else {}
    if isinstance(res, str):
        import json
        try:
            res = json.loads(res) if res.strip() else {}
        except Exception:
            res = {}
    elif not isinstance(res, dict):
        res = {}

    rrh_sub = res.get("rrh") if isinstance(res.get("rrh"), dict) else {}

    # 1. Extract RRH items
    items = (
        res.get("rrh_items")
        or rrh_sub.get("rrh_items")
        or []
    )

    # 2. Extract Totals
    totals = (
        res.get("rrh_totals")
        or rrh_sub.get("rrh_totals")
        or {}
    )

    # 3. Extract Wind Parameters
    wind = (
        res.get("rrh_wind_params")
        or rrh_sub.get("wind_params")
        or res.get("wind_params")
        or {}
    )

    # 4. Extract Structure Parameters
    structure = (
        res.get("structure_params")
        or rrh_sub.get("structure_params")
        or {}
    )

    # 5. Extract Extremes
    extremes = (
        res.get("extremes")
        or rrh_sub.get("extremes")
        or {}
    )

    # 6. Fallback for legacy single-item runs (only if rrh_items is absent)
    if not items:
        ep = rrh_sub.get("equipment_params") or res.get("equipment_params") or {}
        qty = ep.get("qty", 1)
        qp = wind.get("qp_dan", 0.0)
        items = [{
            "index": 1,
            "name": ep.get("name", "RRH"),
            "qty": qty,
            "dimensions_str": f"{ep.get('h_mm', 0):g} x {ep.get('w_mm', 0):g} x {ep.get('t_mm', 0):g}",
            "weight_kg": ep.get("weight_kg", 0.0),
            "weight_total_kg": wind.get("pe_dan", round(qty * ep.get("weight_kg", 0.0), 2)),
            "cf_front": ep.get("cf_front", 1.36),
            "cf_lat": ep.get("cf_lat", 1.10),
            "a_front": ep.get("a_front", 0.10),
            "a_lat": ep.get("a_lat", 0.05),
            "fw_front": wind.get("fw_front", 0.0),
            "fw_lat": wind.get("fw_lat", 0.0),
            "pe_dan": wind.get("pe_dan", 0.0),
            "fw_front_formula": f"{qty} * {ep.get('cf_front', 1.36):.2f} * {ep.get('a_front', 0.10):.2f} * {qp:.2f} = {wind.get('fw_front', 0.0):.2f} daN",
            "fw_lat_formula": f"{qty} * {ep.get('cf_lat', 1.10):.2f} * {ep.get('a_lat', 0.05):.2f} * {qp:.2f} = {wind.get('fw_lat', 0.0):.2f} daN",
        }]
        totals = {
            "count": 1,
            "qty_total": qty,
            "fw_front": wind.get("fw_front", 0.0),
            "fw_lat": wind.get("fw_lat", 0.0),
            "pe_dan": wind.get("pe_dan", 0.0),
            "weight_total_kg": wind.get("pe_dan", 0.0),
            "fw_front_formula": f"{wind.get('fw_front', 0.0):.2f} daN",
            "fw_lat_formula": f"{wind.get('fw_lat', 0.0):.2f} daN",
        }

    return {
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "extremes": extremes,
        "is_multi": len(items) > 1 or totals.get("qty_total", 1) > 1,
    }


def _populate_rrh_docx(doc, ctx):
    """
    Populates NDC RRH-1.docx tables and paragraphs with pre-computed values from context.
    Omits TOTAL RRH lines per user directive.
    """
    items = ctx.get("items", [])
    wind = ctx.get("wind", {})
    structure = ctx.get("structure", {})

    # 1. Populate Table 0 ("Équipements considérés")
    if doc.tables:
        table0 = doc.tables[0]
        for i, item in enumerate(items):
            if i == 0 and len(table0.rows) > 1:
                row = table0.rows[1]
            else:
                row = table0.add_row()
            row.cells[0].text = str(item.get("name", "RRH"))
            row.cells[1].text = str(item.get("qty", 1))
            row.cells[2].text = str(item.get("dimensions_str") or f"{item.get('h_mm', 0):g} x {item.get('w_mm', 0):g} x {item.get('t_mm', 0):g}")
            row.cells[3].text = f"{float(item.get('weight_kg', 0)):.1f}"
            row.cells[4].text = "Projet"
        # Note: Do not add a Total row (intentionally removed)

    # 2. Populate Table 1 ("Géométrie des pièces")
    if len(doc.tables) > 1:
        table1 = doc.tables[1]
        mast_sec = structure.get("mast_section") or "TRON 88x3.2"
        mast_h = structure.get("hauteur_mat_m", 1.5)
        plot_sec = structure.get("plot_section") or "TCAR 200x5"
        plot_h = structure.get("plot_h_m", 0.5)
        if len(table1.rows) > 1:
            table1.rows[1].cells[0].text = str(mast_sec)
            table1.rows[1].cells[1].text = f"{float(mast_h):g}"
            table1.rows[1].cells[2].text = "Mat principal"
        if len(table1.rows) > 2:
            table1.rows[2].cells[0].text = str(plot_sec)
            table1.rows[2].cells[1].text = f"{float(plot_h):g}"
            table1.rows[2].cells[2].text = "Plot"

    # 3. Wind variables
    region = wind.get("region", 2)
    terrain = wind.get("terrain_type", "IIIa")
    building_h = float(wind.get("building_height_m", 0.0) or 0.0)
    vb0 = float(wind.get("v_b0", 26.0) or 26.0)
    kr = float(wind.get("kr", 0.19) or 0.19)
    cr = float(wind.get("cr", 1.25) or 1.25)
    vm = float(wind.get("vm", round(cr * vb0, 2)) or round(cr * vb0, 2))
    iv = float(wind.get("iv", 0.15) or 0.15)
    qp = float(wind.get("qp_dan", 123.57) or 123.57)

    cf_mast = float(wind.get("cf_mast", 1.0) or 1.0)
    mast_d_m = float(structure.get("mast_d_m", 0.088) or 0.088)
    fw_mast = float(wind.get("fw_mast", round(1.0 * cf_mast * mast_d_m * qp, 2)) or 10.87)

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
        elif "Mat" in txt and "Fw =" in txt and "XX" in txt:
            p.text = f"Mât : Fw = 1 * {cf_mast:g} * {mast_d_m:g} * {qp:.2f} = {fw_mast:.2f} daN/ml"

    # Replace RRH force paragraphs
    for idx, p in enumerate(doc.paragraphs):
        if "RRH : Fw,Frontale" in p.text:
            if len(items) == 1:
                p.text = f"RRH : Fw,Frontale = {items[0].get('fw_front_formula', 'N/A')}"
                if idx + 1 < len(doc.paragraphs) and "RRH : Fw,Latéral" in doc.paragraphs[idx + 1].text:
                    doc.paragraphs[idx + 1].text = f"RRH : Fw,Latéral = {items[0].get('fw_lat_formula', 'N/A')}"
            else:
                lines = []
                for it in items:
                    idx_label = f"RRH #{it.get('index', 1)} ({it.get('name', 'RRH')})"
                    lines.append(f"{idx_label} : Fw,Frontale = {it.get('fw_front_formula', 'N/A')}")
                    lines.append(f"{idx_label} : Fw,Latéral = {it.get('fw_lat_formula', 'N/A')}")
                p.text = "\n".join(lines)
                if idx + 1 < len(doc.paragraphs) and "RRH : Fw,Latéral" in doc.paragraphs[idx + 1].text:
                    doc.paragraphs[idx + 1].text = ""
            break


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

    if job.calculation_type == "rrh":
        _assemble_rrh(job)
    else:
        _assemble_antenna(job)


def _assemble_rrh(job):
    """
    Assembles the RRH Note de Calcul document.
    Uses HTML WeasyPrint template (templates/ndc/rrh.html) and DOCX template (templates/rrh/NDC RRH-1.docx).
    """
    output_dir = os.path.join(settings.MEDIA_ROOT, "ndc")
    os.makedirs(output_dir, exist_ok=True)

    # 1. Compile using WeasyPrint auxiliary generator (native HTML, embeds genuine screenshots)
    weasyprint_success = False
    try:
        from geodata.ndc_generator import generate_auxiliary_pdfs
        generated = generate_auxiliary_pdfs(job)
        if generated and os.path.exists(generated[0]):
            with open(generated[0], "rb") as f:
                job.compiled_pdf.save(f"ndc_rrh_{job.id}.pdf", File(f), save=False)
            job.save()
            weasyprint_success = True
            print(f"assemble_ndc_document: Successfully compiled RRH NDC via WeasyPrint for Job {job.id}.")
    except Exception as html_err:
        print(f"WeasyPrint RRH compilation note: {html_err}")

    # 2. Populate and assemble DOCX template
    template_path = os.path.join(settings.BASE_DIR, "templates", "rrh", "NDC RRH-1.docx")
    if not os.path.exists(template_path):
        print(f"assemble_ndc_document: Template not found at {template_path}")
        return

    try:
        from docx import Document
        doc = Document(template_path)

        # Extract context strictly from result_data
        ctx = extract_ndc_context(job)
        _populate_rrh_docx(doc, ctx)

        output_docx = os.path.join(output_dir, f"ndc_rrh_{job.id}.docx")
        doc.save(output_docx)

        with open(output_docx, "rb") as f:
            job.compiled_docx.save(f"ndc_rrh_{job.id}.docx", File(f), save=False)

        # If WeasyPrint didn't compile PDF, convert DOCX to PDF via LibreOffice headless
        if not weasyprint_success:
            try:
                cmd = ["libreoffice", "--headless", "--convert-to", "pdf", output_docx, "--outdir", output_dir]
                subprocess.run(cmd, check=True, timeout=30, capture_output=True)
                output_pdf = os.path.join(output_dir, f"ndc_rrh_{job.id}.pdf")
                if os.path.exists(output_pdf):
                    with open(output_pdf, "rb") as f:
                        job.compiled_pdf.save(f"ndc_rrh_{job.id}.pdf", File(f), save=False)
            except Exception as conv_err:
                print(f"LibreOffice PDF conversion note: {conv_err}")

        job.save()
        print(f"assemble_ndc_document: Compiled RRH DOCX for Job {job.id}.")

    except Exception as e:
        print(f"assemble_ndc_document error for RRH Job {job.id}: {e}")


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


