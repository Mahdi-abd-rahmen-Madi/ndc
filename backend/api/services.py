import os
import shutil
import subprocess
import tempfile
from django.conf import settings
from django.core.files import File
from .models import CalculationJob
from utils.domain_constants import parse_json_dict, resolve_fh_mast_profile, resolve_sans_plot


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


def extract_lovage_docx_context(job) -> dict:
    """
    Extracts Boîtier de Lovage data, wind parameters, support geometry and reactions from job.result_data
    using the canonical geodata extractor (single source of truth).
    """
    from geodata.ndc_generator import extract_lovage_ndc_context
    res = parse_json_dict(getattr(job, 'result_data', None))
    inp = parse_json_dict(getattr(job, 'input_data', None))
    return extract_lovage_ndc_context(res, input_data=inp)


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
        "mast_section": "TRON 114x3.6",
        "mast_d_m": 0.1143,
        "plot_section": "TCAR 150x5",
        "terrain_type": "II",
        "vb0": 24.0,
        "qp_dan": 95.36,
        "template_rel": os.path.join("templates", "fh", "NDC FH.docx"),
        "template_ech_rel": os.path.join("templates", "fh", "NDC FH +ech.docx"),
    },
    "lovage": {
        "label": "Boitiers de lovages",
        "depth_key": "d_mm",
        "mast_section": "TRON 88x3.2",
        "plot_section": "TCAR 150x5",
        "terrain_type": "IIIa",
        "vb0": 24.0,
        "qp_dan": 45.0,
        "template_rel": os.path.join("templates", "lovage", "boitier_lovage_avec_plot.docx"),
        "template_sans_plot_rel": os.path.join("templates", "lovage", "boitier_lovage_sans_plot.docx"),
        "template_variants": {
            ("lovage", False): os.path.join("templates", "lovage", "boitier_lovage_avec_plot.docx"),
            ("lovage", True): os.path.join("templates", "lovage", "boitier_lovage_sans_plot.docx"),
            ("lovage_gps", False): os.path.join("templates", "lovage", "boitier_lovage+gps_avec_plot.docx"),
            ("lovage_gps", True): os.path.join("templates", "lovage", "boitier_lovage+gps_sans_plot.docx"),
            ("lovage_gps_mdea", False): os.path.join("templates", "lovage", "boitier_lovage+GPS+MDEA_avec_plot.docx"),
            ("lovage_gps_mdea", True): os.path.join("templates", "lovage", "boitiers_lovage+GPS+MDEA_sans_plot.docx"),
            ("lovage_mdea", False): os.path.join("templates", "lovage", "boitier_lovage+MDEA_avec_plot.docx"),
            ("lovage_mdea", True): os.path.join("templates", "lovage", "boitier_lovage+MDEA_sans_plot.docx"),
        },
    },
}


def select_equipment_docx_template(kind: str, ctx: dict) -> str:
    """Select the DOCX template relative path for the given equipment kind and context."""
    cfg = _DOCX_EQUIPMENT_DEFAULTS.get(kind, _DOCX_EQUIPMENT_DEFAULTS["rrh"])
    is_sans_plot = bool(ctx.get("is_sans_plot") or (ctx.get("structure") or {}).get("sans_plot"))
    if kind == "fh" and ctx.get("has_echelle") and cfg.get("template_ech_rel"):
        return cfg["template_ech_rel"]
    variants = cfg.get("template_variants")
    if variants:
        variant = ctx.get("lovage_variant") or ("lovage" if kind == "lovage" else kind)
        if (variant, is_sans_plot) in variants:
            return variants[(variant, is_sans_plot)]
    if is_sans_plot and cfg.get("template_sans_plot_rel"):
        return cfg["template_sans_plot_rel"]
    return cfg["template_rel"]


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
    fh_profile = resolve_fh_mast_profile(structure.get("mast_section") or ctx.get("mast_section")) if kind == "fh" else None
    is_sans_plot = bool(ctx.get("is_sans_plot") or structure.get("sans_plot"))

    # 1. Populate Table 0 ("Équipements considérés")
    if doc.tables:
        table0 = doc.tables[0]
        if kind == "lovage":
            while len(table0.rows) > 2:
                tr = table0.rows[-1]._tr
                tr.getparent().remove(tr)
            lovage_rows = []
            for item in items:
                depth_val = item.get(depth_key, item.get("t_mm", item.get("d_mm", 0)))
                dims = str(
                    item.get("dimensions_str")
                    or f"{item.get('h_mm', 0):g} x {item.get('w_mm', 0):g} x {depth_val:g}"
                )
                w_str = str(item.get("weight_unit_kg") or f"{float(item.get('weight_kg', 0)):.1f}")
                lovage_rows.append((
                    str(item.get("name", label)),
                    str(item.get("qty", 1)),
                    dims,
                    w_str,
                    "Projet",
                ))
            if ctx.get("has_gps") and ctx.get("gps_item"):
                g = ctx["gps_item"]
                g_name = f"Antenne GPS ({g['reference']})" if g.get("reference") else "Antenne GPS"
                lovage_rows.append((
                    g_name,
                    str(g.get("qty", 1)),
                    str(g.get("dimensions_str") or "N/A"),
                    str(g.get("weight_unit_kg") or "Négligeable"),
                    "Projet",
                ))
            if ctx.get("has_mdea") and ctx.get("mdea_item"):
                m = ctx["mdea_item"]
                lovage_rows.append((
                    "MDEA",
                    str(m.get("qty", 1)),
                    str(m.get("dimensions_str") or "338 x 295 x 140"),
                    str(m.get("weight_unit_kg") or "10"),
                    "Projet",
                ))

            for i, (desig, qty_s, dims_s, w_s, state_s) in enumerate(lovage_rows):
                if i == 0 and len(table0.rows) > 1:
                    row = table0.rows[1]
                else:
                    row = table0.add_row()
                row.cells[0].text = desig
                row.cells[1].text = qty_s
                row.cells[2].text = dims_s
                row.cells[3].text = w_s
                if len(row.cells) > 4:
                    row.cells[4].text = state_s
        else:
            if kind == "fh":
                while len(table0.rows) > 2:
                    tr = table0.rows[-1]._tr
                    tr.getparent().remove(tr)
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
            if kind == "fh" and ctx.get("has_echelle"):
                ech_row = table0.add_row()
                ech_row.cells[0].text = "Echelle"
                ech_row.cells[1].text = "1"
                ech_row.cells[2].text = "-"
                ech_row.cells[3].text = "15"

    # 2. Populate Table 1 ("Géométrie des pièces")
    if len(doc.tables) > 1:
        table1 = doc.tables[1]
        mast_sec = structure.get("mast_section") or (fh_profile["mast_section"] if fh_profile else cfg["mast_section"])
        mast_h = (
            ctx.get("hauteur_mat_m")
            if ctx.get("hauteur_mat_m") is not None
            else (structure.get("hauteur_mat_m") if structure.get("hauteur_mat_m") is not None else (1.7 if kind == "fh" else 1.5))
        )
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

    # 3. Wind variables (Worker wind_params as single source of truth)
    region = wind.get("region") if wind.get("region") is not None else 2
    terrain = wind.get("terrain_type") if wind.get("terrain_type") is not None else cfg["terrain_type"]
    building_h = float(wind.get("building_height_m") if wind.get("building_height_m") is not None else 0.0)
    vb0_raw = (
        wind.get("vb0_ms")
        if wind.get("vb0_ms") is not None
        else (wind.get("v_b0") if wind.get("v_b0") is not None else (wind.get("vb0") if wind.get("vb0") is not None else cfg["vb0"]))
    )
    vb0 = float(vb0_raw)
    kr_raw = wind.get("kr_z") if wind.get("kr_z") is not None else wind.get("kr")
    kr = float(kr_raw if kr_raw is not None else 0.19)
    cr_raw = wind.get("cr_z") if wind.get("cr_z") is not None else wind.get("cr")
    cr = float(cr_raw if cr_raw is not None else 1.25)
    vm_raw = wind.get("vm_z") if wind.get("vm_z") is not None else wind.get("vm")
    vm = float(vm_raw if vm_raw is not None else round(cr * vb0, 2))
    iv_raw = wind.get("iv_z") if wind.get("iv_z") is not None else wind.get("iv")
    iv = float(iv_raw if iv_raw is not None else 0.15)
    qp = float(wind.get("qp_dan") if wind.get("qp_dan") is not None else cfg["qp_dan"])

    cf_mast = float(wind.get("cf_mast") if wind.get("cf_mast") is not None else 1.0)
    default_mast_d = fh_profile["mast_d_m"] if fh_profile else cfg.get("mast_d_m", 0.088)
    raw_mast_d = (
        wind.get("mast_d_formula")
        if (kind == "fh" and wind.get("mast_d_formula") is not None)
        else (structure.get("mast_d_m") if structure.get("mast_d_m") is not None else default_mast_d)
    )
    mast_d_m = float(raw_mast_d)
    fw_mast = float(
        wind.get("fw_mast")
        if wind.get("fw_mast") is not None
        else round(1.0 * cf_mast * mast_d_m * qp, 2)
    )

    # 4. Paragraph replacements
    import re
    qty_total = ctx.get("qty_total") or sum(int(it.get("qty", 1)) for it in items) or 1
    has_gps = bool(ctx.get("has_gps"))
    has_mdea = bool(ctx.get("has_mdea"))
    mdea_item = ctx.get("mdea_item")
    lovage_variant = ctx.get("lovage_variant") or "lovage"
    mast_h_val = (
        ctx.get("hauteur_mat_m")
        if ctx.get("hauteur_mat_m") is not None
        else (structure.get("hauteur_mat_m") if structure.get("hauteur_mat_m") is not None else (1.7 if kind == "fh" else 1.5))
    )
    fh_diam_mm = (
        float(structure["diam_mm"])
        if structure.get("diam_mm") is not None
        else (fh_profile["diam_mm"] if fh_profile else None)
    )
    fh_thickness_mm = (
        float(structure["thickness_mm"])
        if structure.get("thickness_mm") is not None
        else (fh_profile["thickness_mm"] if fh_profile else None)
    )
    for p in doc.paragraphs:
        txt = p.text
        if kind == "fh" and ("tube Ø88.9 mm" in txt or "d’épaisseur 2.5 mm" in txt or "d'épaisseur 2.5 mm" in txt):
            updated = re.sub(
                r"Ø88\.9\s*mm,\s*d[’']épaisseur\s*2\.5\s*mm",
                f"Ø{fh_diam_mm:g} mm, d’épaisseur {fh_thickness_mm:g} mm",
                txt,
            )
            updated = re.sub(
                r"longueur\s+(?:\d+|XXX)\s*mm",
                f"longueur {int(round(float(mast_h_val) * 1000))} mm",
                updated,
            )
            p.text = updated
        elif kind == "fh" and "Vérification de mat principal" in txt and "88x2.5" in txt:
            p.text = txt.replace("88x2.5", f"{fh_diam_mm:g}x{fh_thickness_mm:g}")
        elif kind == "lovage" and lovage_variant == "lovage_mdea" and "Boitiers de lovage + GPS + MDEA" in txt:
            p.text = txt.replace("Boitiers de lovage + GPS + MDEA", "Boitiers de lovage + MDEA")
        elif "supportant XX boitiers de lovage" in txt:
            lovage_clause = f"supportant {qty_total} boitier{'s' if qty_total > 1 else ''} de lovage"
            mdea_qty = int((mdea_item or {}).get("qty") or 1)
            mdea_clause = (
                f"{mdea_qty} convertisseur{'s' if mdea_qty > 1 else ''} MDEA"
                if mdea_qty > 1
                else "un convertisseur MDEA"
            )
            if has_gps and has_mdea:
                full_clause = f"{lovage_clause}, une antenne GPS et {mdea_clause}."
            elif has_gps:
                full_clause = f"{lovage_clause} et une antenne GPS."
            elif has_mdea:
                full_clause = f"{lovage_clause} et {mdea_clause}."
            else:
                full_clause = f"{lovage_clause}."
            updated = re.sub(
                r"longueur\s+\d+\s*mm",
                f"longueur {int(round(float(mast_h_val) * 1000))} mm",
                txt,
            )
            updated = re.sub(r"supportant XX boitiers de lovage[^.]*\.", full_clause, updated)
            p.text = updated
        elif "Région XX" in txt:
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
    lovage_replaced = False
    for idx, p in enumerate(doc.paragraphs):
        norm_txt = " ".join(p.text.split())
        if kind == "lovage" and "MDEA" in norm_txt:
            if "Fw,Frontale" in norm_txt:
                p.text = f"MDEA : Fw,Frontale = {mdea_item.get('fw_front_formula', 'N/A')}" if (has_mdea and mdea_item) else ""
            elif "Fw,Latéral" in norm_txt:
                p.text = f"MDEA : Fw,Latéral = {mdea_item.get('fw_lat_formula', 'N/A')}" if (has_mdea and mdea_item) else ""
            continue
        if not lovage_replaced and (
            front_marker in norm_txt
            or (kind == "lovage" and "Fw,Frontale" in norm_txt and "MDEA" not in norm_txt)
        ):
            if len(items) == 1:
                p.text = f"{front_marker} = {items[0].get('fw_front_formula', 'N/A')}"
                if idx + 1 < len(doc.paragraphs):
                    next_norm = " ".join(doc.paragraphs[idx + 1].text.split())
                    if lat_marker in next_norm or (kind == "lovage" and "Fw,Latéral" in next_norm and "MDEA" not in next_norm):
                        doc.paragraphs[idx + 1].text = f"{lat_marker} = {items[0].get('fw_lat_formula', 'N/A')}"
            else:
                lines = []
                for it in items:
                    idx_label = f"{label} #{it.get('index', 1)} ({it.get('name', label)})"
                    lines.append(f"{idx_label} : Fw,Frontale = {it.get('fw_front_formula', 'N/A')}")
                    lines.append(f"{idx_label} : Fw,Latéral = {it.get('fw_lat_formula', 'N/A')}")
                p.text = "\n".join(lines)
                if idx + 1 < len(doc.paragraphs):
                    next_norm = " ".join(doc.paragraphs[idx + 1].text.split())
                    if lat_marker in next_norm or (kind == "lovage" and "Fw,Latéral" in next_norm and "MDEA" not in next_norm):
                        doc.paragraphs[idx + 1].text = ""
            lovage_replaced = True
            if kind != "lovage":
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

    calc_type = str(getattr(job, 'calculation_type', 'antenna') or 'antenna').lower().strip()
    input_data = job.input_data if isinstance(getattr(job, 'input_data', None), dict) else {}
    result_data = job.result_data if isinstance(getattr(job, 'result_data', None), dict) else {}
    active_eqs = result_data.get('active_equipments') if isinstance(result_data.get('active_equipments'), list) else []

    def _has_active_antenna_input(inp_dict: dict) -> bool:
        for key in ('antenna_4g', 'antenna_5g'):
            ant = inp_dict.get(key)
            if isinstance(ant, dict) and any(
                ant.get(f) for f in ('model', 'hauteur_mm', 'largeur_mm', 'epaisseur_mm', 'poids_kg', 'height_mm', 'width_mm')
            ):
                return True
        return False

    # 1. Base Antenna Verification (applicable to antenna and composite antenna+rrh/rru/fh/lovage/multi-equipment)
    is_standalone_equipment = (
        not calc_type.startswith('antenna')
        and not _has_active_antenna_input(input_data)
        and (
            calc_type in ('rrh', 'rrh_sans_plot', 'rru', 'rru_sans_plot', 'fh', 'fh_sans_plot', 'lovage', 'lovage_sans_plot')
            or '_and_' in calc_type
            or bool(input_data.get('is_rrh') or input_data.get('is_rru') or input_data.get('is_fh') or input_data.get('is_lovage'))
        )
    )
    is_pure_fh = calc_type in ('fh', 'fh_sans_plot') and not _has_active_antenna_input(input_data)

    if not is_standalone_equipment:
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

    # 2. RRH Verification (Independent check whenever RRH is enabled or active)
    has_rrh = (
        'rrh' in calc_type.split('_')
        or 'rrh' in active_eqs
        or bool((input_data.get('rrh_equipment') or {}).get('enabled'))
        or bool(result_data.get('has_rrh'))
        or bool(input_data.get('is_rrh'))
    )
    if has_rrh:
        from geodata.ndc_generator import find_job_rrh_rtf_paths
        rrh_paths = find_job_rrh_rtf_paths(job)
        rrh_files = result_data.get('rrh_files') if isinstance(result_data.get('rrh_files'), dict) else {}

        has_rrh_3d = bool(
            getattr(job, 'rrh_screenshot', None)
            or files.get('rrh_screenshot')
            or (rrh_files.get('rrh_screenshot') and os.path.exists(rrh_files['rrh_screenshot']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots_rrh', f'job_{job.id}_rrh_3d_view.jpg'))
        )
        if not has_rrh_3d:
            missing.append("Capture 3D modélisation RRH (page 14)")

        has_rrh_verif = bool(
            getattr(job, 'rrh_verification_screenshot', None)
            or files.get('rrh_verification_screenshot')
            or (rrh_files.get('rrh_verification_screenshot') and os.path.exists(rrh_files['rrh_verification_screenshot']))
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
            or files.get('rrh_loads_table')
            or files.get('loads_table')
            or (rrh_files.get('rrh_tableau_charges') and os.path.exists(rrh_files['rrh_tableau_charges']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'charges_rrh', f'job_{job.id}_rrh_tableau_charges.png'))
        )
        if not has_rrh_charges:
            missing.append("Tableau des charges RRH (page 15)")

        is_rrh_sans_plot = resolve_sans_plot(input_data, result_data, calc_type=calc_type, kind="rrh")
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

    # 3. RRU Verification (Independent check whenever RRU is enabled or active)
    has_rru = (
        'rru' in calc_type.split('_')
        or 'rru' in active_eqs
        or bool((input_data.get('rru_equipment') or {}).get('enabled'))
        or bool(result_data.get('has_rru'))
        or bool(input_data.get('is_rru'))
    )
    if has_rru:
        from geodata.ndc_generator import find_job_rru_rtf_paths
        rru_paths = find_job_rru_rtf_paths(job)
        rru_files = result_data.get('rru_files') if isinstance(result_data.get('rru_files'), dict) else {}

        has_rru_3d = bool(
            files.get('rru_screenshot')
            or (rru_files.get('rru_screenshot') and os.path.exists(rru_files['rru_screenshot']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots_rru', f'job_{job.id}_rru_3d_view.jpg'))
        )
        if not has_rru_3d:
            missing.append("Capture 3D modélisation RRU")

        has_rru_verif = bool(
            files.get('rru_verification_screenshot')
            or (rru_files.get('rru_verification_screenshot') and os.path.exists(rru_files['rru_verification_screenshot']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'verif_rru', f'job_{job.id}_rru_verification.jpg'))
        )
        if not has_rru_verif:
            missing.append("Capture de vérification Robot RRU")

        has_rru_mat = bool(
            rru_paths.get('note_mat')
            or rru_paths.get('note_de_calcul')
            or files.get('note_de_calcul_rru')
            or files.get('rru_note_de_calcul')
            or files.get('rru_note_mat')
        )
        if not has_rru_mat:
            missing.append("Note de calcul RTF du mât RRU")

        has_rru_charges = bool(
            files.get('rru_tableau_charges')
            or files.get('rru_loads_table')
            or (rru_files.get('rru_tableau_charges') and os.path.exists(rru_files['rru_tableau_charges']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'charges_rru', f'job_{job.id}_rru_tableau_charges.png'))
        )
        if not has_rru_charges:
            missing.append("Tableau des charges RRU")

        is_rru_sans_plot = resolve_sans_plot(input_data, result_data, calc_type=calc_type, kind="rru")
        if not is_rru_sans_plot:
            has_rru_ass = bool(
                rru_paths.get('assemblage_note')
                or files.get('rru_assemblage_note')
                or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'notes_rru', f'job_{job.id}_rru_assemblage_note.rtf'))
            )
            if not has_rru_ass:
                missing.append("Note d'assemblage Robot RRU")

    # 4. FH Verification (Independent check whenever FH is enabled or active)
    has_fh = (
        'fh' in calc_type.split('_')
        or 'fh' in active_eqs
        or bool((input_data.get('fh_equipment') or {}).get('enabled'))
        or bool(result_data.get('has_fh'))
        or bool(input_data.get('is_fh'))
    )
    if has_fh:
        from geodata.ndc_generator import find_job_fh_rtf_paths
        fh_paths = find_job_fh_rtf_paths(job)
        fh_files = result_data.get('fh_files') if isinstance(result_data.get('fh_files'), dict) else {}

        has_fh_3d = bool(
            getattr(job, 'fh_screenshot', None)
            or (is_pure_fh and getattr(job, 'screenshot', None))
            or files.get('fh_screenshot')
            or (is_pure_fh and files.get('screenshot'))
            or (fh_files.get('fh_screenshot') and os.path.exists(fh_files['fh_screenshot']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots_fh', f'job_{job.id}_fh_3d_view.jpg'))
        )
        if not has_fh_3d:
            missing.append("Capture 3D modélisation FH (page 2)")

        has_fh_verif = bool(
            getattr(job, 'fh_verification_screenshot', None)
            or (is_pure_fh and getattr(job, 'verification_screenshot', None))
            or files.get('fh_verification_screenshot')
            or (is_pure_fh and files.get('verification_screenshot'))
            or (fh_files.get('fh_verification_screenshot') and os.path.exists(fh_files['fh_verification_screenshot']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'verif_fh', f'job_{job.id}_fh_verification.jpg'))
        )
        if not has_fh_verif:
            missing.append("Capture de vérification Robot FH (page 4)")

        has_fh_mat = bool(
            fh_paths.get('note_mat')
            or fh_paths.get('note_de_calcul')
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
            or (fh_files.get('fh_tableau_charges') and os.path.exists(fh_files['fh_tableau_charges']))
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

    # 5. Boîtier de Lovage Verification (Zone Technique)
    lovage_in = input_data.get('boitier_lovage') or input_data.get('lovage_equipment') or {}
    has_lovage = (
        'lovage' in calc_type.split('_')
        or 'lovage' in active_eqs
        or (isinstance(lovage_in, dict) and bool(lovage_in.get('enabled')))
        or bool(result_data.get('has_lovage'))
        or bool(input_data.get('is_lovage'))
    )
    if has_lovage:
        from geodata.ndc_generator import find_job_lovage_rtf_paths
        lovage_paths = find_job_lovage_rtf_paths(job)
        lovage_files = result_data.get('lovage_files') if isinstance(result_data.get('lovage_files'), dict) else {}

        has_lovage_3d = bool(
            files.get('lovage_screenshot')
            or (lovage_files.get('lovage_screenshot') and os.path.exists(lovage_files['lovage_screenshot']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'screenshots_lovage', f'job_{job.id}_lovage_3d_view.jpg'))
        )
        if not has_lovage_3d:
            missing.append("Capture 3D modélisation Boîtiers de lovage")

        has_lovage_verif = bool(
            files.get('lovage_verification_screenshot')
            or (lovage_files.get('lovage_verification_screenshot') and os.path.exists(lovage_files['lovage_verification_screenshot']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'verif_lovage', f'job_{job.id}_lovage_verification.jpg'))
        )
        if not has_lovage_verif:
            missing.append("Capture de vérification Robot Boîtiers de lovage")

        has_lovage_mat = bool(
            lovage_paths.get('note_mat')
            or lovage_paths.get('note_de_calcul')
            or files.get('note_de_calcul_lovage')
            or files.get('lovage_note_de_calcul')
            or files.get('lovage_note_mat')
        )
        if not has_lovage_mat:
            missing.append("Note de calcul RTF du mât Boîtiers de lovage")

        has_lovage_charges = bool(
            files.get('lovage_tableau_charges')
            or files.get('lovage_loads_table')
            or (lovage_files.get('lovage_tableau_charges') and os.path.exists(lovage_files['lovage_tableau_charges']))
            or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'charges_lovage', f'job_{job.id}_lovage_tableau_charges.png'))
        )
        if not has_lovage_charges:
            missing.append("Tableau des charges Boîtiers de lovage")

        is_lovage_sans_plot = resolve_sans_plot(input_data, result_data, calc_type=calc_type, kind="lovage")
        if not is_lovage_sans_plot:
            has_lovage_ass = bool(
                lovage_paths.get('assemblage_note')
                or files.get('lovage_assemblage_note')
                or os.path.exists(os.path.join(settings.MEDIA_ROOT, 'notes_lovage', f'job_{job.id}_lovage_assemblage_note.rtf'))
            )
            if not has_lovage_ass:
                missing.append("Note d'assemblage Robot Boîtiers de lovage")

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

    calc_type_low = str(job.calculation_type or "").lower().strip()
    inp_d = job.input_data if isinstance(getattr(job, 'input_data', None), dict) else {}
    has_ant = calc_type_low.startswith("antenna") or any(
        isinstance(inp_d.get(k), dict) and any(inp_d[k].get(f) for f in ("model", "hauteur_mm", "largeur_mm", "poids_kg"))
        for k in ("antenna_4g", "antenna_5g")
    )
    if not has_ant and any(k in calc_type_low for k in ("rrh", "rru", "fh", "lovage")):
        primary_kind = (
            "rrh" if "rrh" in calc_type_low
            else ("rru" if "rru" in calc_type_low else ("fh" if "fh" in calc_type_low else "lovage"))
        )
        _assemble_equipment_doc(job, kind=primary_kind)
    else:
        _assemble_antenna(job)


def _assemble_equipment_doc(job, kind: str = "rrh"):
    """
    Unified Note de Calcul document assembler for standalone (single or multi-equipment) jobs.
    1) Attempts native WeasyPrint compilation via geodata.ndc_generator.generate_auxiliary_pdfs
       (merges all generated auxiliary sections when multiple equipments are active).
    2) Populates the DOCX template and saves it cleanly without leaving duplicate temp files.
    3) Falls back to isolated LibreOffice DOCX->PDF conversion if WeasyPrint failed.
    """
    cfg = _DOCX_EQUIPMENT_DEFAULTS.get(kind, _DOCX_EQUIPMENT_DEFAULTS["rrh"])
    label = cfg["label"]
    prefix = f"ndc_{kind}_{job.id}"

    weasyprint_success = False
    try:
        from geodata.ndc_generator import generate_auxiliary_pdfs
        generated = [p for p in generate_auxiliary_pdfs(job) if p and os.path.exists(p)]
        if len(generated) == 1:
            with open(generated[0], "rb") as f:
                job.compiled_pdf.save(f"{prefix}.pdf", File(f), save=False)
            job.save()
            weasyprint_success = True
            print(f"assemble_ndc_document: Successfully compiled {label} NDC via WeasyPrint for Job {job.id}.")
        elif len(generated) > 1:
            from pypdf import PdfWriter
            merger = PdfWriter()
            merged_tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
            merged_tmp.close()
            try:
                for p in generated:
                    merger.append(p)
                merger.write(merged_tmp.name)
                merger.close()
                with open(merged_tmp.name, "rb") as f:
                    job.compiled_pdf.save(f"{prefix}.pdf", File(f), save=False)
                job.save()
                weasyprint_success = True
                print(f"assemble_ndc_document: Successfully compiled multi-equipment NDC via WeasyPrint for Job {job.id}.")
            finally:
                try:
                    os.remove(merged_tmp.name)
                except OSError:
                    pass
    except Exception as html_err:
        print(f"WeasyPrint {label} compilation note: {html_err}")

    if kind == "rru":
        ctx = extract_rru_docx_context(job)
    elif kind == "fh":
        ctx = extract_fh_docx_context(job)
    elif kind == "lovage":
        ctx = extract_lovage_docx_context(job)
    else:
        ctx = extract_ndc_context(job)

    template_rel = select_equipment_docx_template(kind, ctx)
    template_path = os.path.join(settings.BASE_DIR, template_rel)
    if not os.path.exists(template_path):
        print(f"assemble_ndc_document: Template not found at {template_path}")
        return

    work_dir = tempfile.mkdtemp(prefix=f"ndc_{kind}_{job.id}_")
    try:
        from docx import Document
        doc = Document(template_path)
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


def execute_site_ndc_generation(payload: dict, user_id=None) -> str:
    """
    Assemble a combined Site Note de Calcul PDF (both fast-track catalogue merge
    and full multi-sector Robot NDC merge) and return the final MEDIA_URL path.
    Runs cleanly either inline or inside a Django-Q2 qcluster worker.
    """
    import json
    import uuid
    from django.contrib.auth.models import User
    from pypdf import PdfReader, PdfWriter
    from geodata.ndc_generator import (
        _batch_convert_rtf_files,
        collect_site_ndc_rtf_specs,
        generate_auxiliary_pdfs,
        generate_ndc_pdf,
    )
    from utils.domain_constants import OPERATORS_WITHOUT_TD, normalize_operator
    from utils.path_security import safe_media_path
    from .models import GeneratedSiteNdc

    user = User.objects.filter(id=user_id).first() if user_id else None
    fast_track = bool(payload.get('fast_track', False))
    photo_url = payload.get('photo_url', '') or ''

    if fast_track:
        catalogue_pdf_urls = payload.get('catalogue_pdf_urls', [])
        if isinstance(catalogue_pdf_urls, str):
            catalogue_pdf_urls = [catalogue_pdf_urls]

        preview_data = dict(payload)
        for key in [
            'site', 'environment', 'structure', 'antenna_4g', 'antenna_5g',
            'fh_equipment', 'rrh_equipment', 'rru_equipment', 'td_equipment',
            'gps', 'boitier_lovage', 'convertisseur_mdea', 'coffrets_fibre', 'baie', 'cab', 'atelier_energie',
        ]:
            val = preview_data.get(key)
            if isinstance(val, str):
                try:
                    preview_data[key] = json.loads(val)
                except json.JSONDecodeError:
                    pass

        operator_name = normalize_operator(
            payload.get('operator') or payload.get('operateur'),
            fallback_site=preview_data.get('site'),
        )
        if operator_name in OPERATORS_WITHOUT_TD and isinstance(preview_data.get('td_equipment'), dict):
            preview_data['td_equipment']['enabled'] = False

        code_val = payload.get('code_site') or payload.get('ref_site') or ''
        if not isinstance(preview_data.get('site'), dict):
            preview_data['site'] = {
                'name': payload.get('site_name', ''),
                'code_site': code_val,
                'ref_site': code_val,
                'client': payload.get('client_name', ''),
                'address': payload.get('address', ''),
            }
        else:
            if not preview_data['site'].get('code_site') and code_val:
                preview_data['site']['code_site'] = code_val
                preview_data['site']['ref_site'] = code_val

        if not isinstance(preview_data.get('environment'), dict):
            preview_data['environment'] = {
                'etancheite': payload.get('etancheite'),
                'dalle_thickness_m': payload.get('dalle_thickness_m'),
            }

        cover_pdf_url = generate_ndc_pdf(None, photo_url, preview_data=preview_data, is_cover_only=True)
        merger = PdfWriter()
        try:
            if cover_pdf_url.startswith(settings.MEDIA_URL):
                cover_rel_path = cover_pdf_url[len(settings.MEDIA_URL):]
                cover_abs_path = os.path.join(settings.MEDIA_ROOT, cover_rel_path)
                if os.path.exists(cover_abs_path):
                    merger.append(cover_abs_path)

            for cat_url in catalogue_pdf_urls:
                cat_abs_path = safe_media_path(cat_url)
                if not cat_abs_path:
                    continue
                cat_rel_path = os.path.relpath(cat_abs_path, settings.MEDIA_ROOT)
                if not cat_rel_path.lower().endswith('.pdf'):
                    from geodata.utils_preview import get_pdf_preview_path
                    pdf_rel_path = get_pdf_preview_path(cat_rel_path)
                    if pdf_rel_path:
                        cat_abs_path = safe_media_path(pdf_rel_path)
                if cat_abs_path and os.path.isfile(cat_abs_path):
                    reader = PdfReader(cat_abs_path)
                    for i, page in enumerate(reader.pages):
                        if i in (0, 1):
                            continue
                        merger.add_page(page)

            has_any_eq = False
            for eq_key in ['fh_equipment', 'rrh_equipment', 'rru_equipment', 'td_equipment', 'gps', 'boitier_lovage', 'coffrets_fibre']:
                eq = preview_data.get(eq_key, {})
                if isinstance(eq, dict) and eq.get('enabled'):
                    if eq_key == 'td_equipment' and operator_name in OPERATORS_WITHOUT_TD:
                        continue
                    has_any_eq = True
                    break

            if has_any_eq:
                class DummyJob:
                    input_data = preview_data
                    id = 'fast'

                aux_paths = generate_auxiliary_pdfs(DummyJob(), start_page=len(merger.pages) + 1)
                for aux in aux_paths:
                    if os.path.exists(aux):
                        merger.append(aux)

            output_filename = f"SITE_NDC_FAST_{uuid.uuid4().hex[:8]}.pdf"
            outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
            os.makedirs(outdir, exist_ok=True)
            merged_pdf_path = os.path.join(outdir, output_filename)
            merger.write(merged_pdf_path)
        finally:
            merger.close()

        final_pdf_url = settings.MEDIA_URL + f"uploads/{output_filename}"
        if user is not None:
            GeneratedSiteNdc.objects.create(
                user=user,
                site_name=payload.get('site_name', '') or preview_data.get('site', {}).get('name', ''),
                code_site=payload.get('code_site', '') or payload.get('ref_site', '') or preview_data.get('site', {}).get('code_site', ''),
                client_name=payload.get('client_name', '') or preview_data.get('site', {}).get('client', ''),
                address=payload.get('address', '') or preview_data.get('site', {}).get('address', ''),
                operator=payload.get('operator', '') or preview_data.get('site', {}).get('operator', ''),
                pdf_url=final_pdf_url,
            )
        return final_pdf_url

    job_ids = payload.get('job_ids', [])
    jobs_by_id = CalculationJob.objects.select_related('user').in_bulk(job_ids)
    jobs = [jobs_by_id[jid] for jid in job_ids if jid in jobs_by_id]

    rtf_specs = collect_site_ndc_rtf_specs(jobs)
    preconverted_images = _batch_convert_rtf_files(rtf_specs) if rtf_specs else {}

    temp_pdfs = []
    merger = PdfWriter()
    total_pages = 0

    for i, job in enumerate(jobs):
        is_subsequent = (i > 0)
        job_photo_url = photo_url
        if not job_photo_url and job.input_data and job.input_data.get('site_image_url'):
            job_photo_url = job.input_data.get('site_image_url')

        if isinstance(job.input_data, dict):
            if 'site' not in job.input_data or not isinstance(job.input_data['site'], dict):
                job.input_data['site'] = {}
            if not job.input_data['site'].get('code_site') and (payload.get('code_site') or payload.get('ref_site')):
                c_val = payload.get('code_site') or payload.get('ref_site')
                job.input_data['site']['code_site'] = c_val
                job.input_data['site']['ref_site'] = c_val
            if not job.input_data['site'].get('name') and payload.get('site_name'):
                job.input_data['site']['name'] = payload.get('site_name')

        pdf_url = generate_ndc_pdf(
            job,
            job_photo_url,
            is_subsequent_sector=is_subsequent,
            start_page=total_pages + 1,
            preconverted_images=preconverted_images,
        )
        if pdf_url.startswith(settings.MEDIA_URL):
            rel_path = pdf_url[len(settings.MEDIA_URL):]
            abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
            if os.path.exists(abs_path):
                temp_pdfs.append(abs_path)
                merger.append(abs_path)
                reader = PdfReader(abs_path)
                total_pages += len(reader.pages)

    if jobs:
        aux_pdf_paths = generate_auxiliary_pdfs(
            jobs[0],
            start_page=total_pages + 1,
            preconverted_images=preconverted_images,
        )
        for aux_path in aux_pdf_paths:
            if os.path.exists(aux_path):
                temp_pdfs.append(aux_path)
                merger.append(aux_path)

    output_filename = f"SITE_NDC_{uuid.uuid4().hex[:8]}.pdf"
    outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
    os.makedirs(outdir, exist_ok=True)
    merged_pdf_path = os.path.join(outdir, output_filename)
    try:
        merger.write(merged_pdf_path)
    finally:
        merger.close()
        for tmp_pdf in temp_pdfs:
            if tmp_pdf and tmp_pdf != merged_pdf_path and os.path.isfile(tmp_pdf):
                try:
                    os.remove(tmp_pdf)
                except OSError:
                    pass

    final_pdf_url = settings.MEDIA_URL + f"uploads/{output_filename}"
    if user is not None:
        GeneratedSiteNdc.objects.create(
            user=user,
            site_name=payload.get('site_name', ''),
            code_site=payload.get('code_site', '') or payload.get('ref_site', ''),
            client_name=payload.get('client_name', ''),
            address=payload.get('address', ''),
            operator=payload.get('operator', ''),
            pdf_url=final_pdf_url,
        )
    return final_pdf_url



