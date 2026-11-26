"""Equipment context extraction (RRH & RRU) for NDC report rendering."""
import re
from .wind_ec1 import _parse_envelope_dims_m


def clean_equipment_designation(name: str) -> str:
    """
    Strips brand/marque prefixes (e.g., NOKIA, HUAWEI, ERICSSON, ZTE, SAMSUNG)
    and equipment type prefixes (RRH, RRU) to return the direct reference (e.g. AHHB 2600).
    """
    if not name:
        return ""
    cleaned = str(name).strip()
    cleaned = re.sub(r'^(?:NOKIA|HUAWEI|ERICSSON|ZTE|SAMSUNG|COMMSCOPE)\s+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^(?:RRH|RRU)\s+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^(?:NOKIA|HUAWEI|ERICSSON|ZTE|SAMSUNG|COMMSCOPE)\s+', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or str(name)


def clean_fh_designation(name: str) -> str:
    """
    Formats an FH designation for the NDC report:
    - Strips brand prefixes and trailing diameter/dimension annotations (e.g. "Ø 1200 mm", "600mm").
    - If a proper reference remains (e.g. "BFZ 622 34/3S03H"), returns just that reference.
    - If the name only contained dimensions (e.g. "30cm Ø 300 mm", "60cm") or is empty, returns "FH".
    """
    if not name or not str(name).strip():
        return "FH"
    cleaned = clean_equipment_designation(str(name))
    # Remove diameter annotations like "Ø 1200 mm", "Ø300", "(Ø 600 mm)"
    cleaned = re.sub(r'[\s\-–(]*[Øø]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?\s*\)?', '', cleaned, flags=re.IGNORECASE)
    # Remove standalone or trailing dimension tokens like "30cm", "60 cm", "1200 mm"
    cleaned = re.sub(r'(?:^|[\s\-–(]+)\d+(?:[.,]\d+)?\s*(?:mm|cm)\b\s*\)?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(" -–/()")
    if not cleaned or re.fullmatch(r'\d+(?:[.,]\d+)?\s*(?:mm|cm|m)?', cleaned, flags=re.IGNORECASE):
        return "FH"
    return cleaned


def extract_rrh_ndc_context(result_data: dict, input_data: dict = None, qp_val: float = 0.0) -> dict:
    """
    Extracts multi-RRH data from result_data with fallback to legacy single-RRH format
    or input_data (catalogue lookup) for preview/pre-worker states.
    """
    result_data = result_data if isinstance(result_data, dict) else {}
    input_data = input_data if isinstance(input_data, dict) else {}
    rrh_sub = result_data.get("rrh") if isinstance(result_data.get("rrh"), dict) else {}

    items = result_data.get("rrh_items") or rrh_sub.get("rrh_items") or []
    totals = result_data.get("rrh_totals") or rrh_sub.get("rrh_totals") or {}
    wind = (
        result_data.get("rrh_wind_params")
        or rrh_sub.get("wind_params")
        or result_data.get("wind_params")
        or {}
    )
    structure = rrh_sub.get("structure_params") or result_data.get("structure_params") or {}
    extremes = result_data.get("extremes") or rrh_sub.get("extremes") or {}

    try:
        qp = float(wind.get("qp_dan") or qp_val or 0.0)
    except (ValueError, TypeError):
        qp = 0.0

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

    if not items:
        from geodata.catalogue_loader import find_rrh_reference
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
                dims_str = (
                    f"{h_mm:g} x {w_mm:g} x {t_mm:g}"
                    if (h_mm or w_mm)
                    else (spec.get("dimensions", "N/A") if spec else "N/A")
                )
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
                    "fw_front_formula": (
                        f"{qty} * {cf_front:.2f} * {a_front:.2f} * {qp:.2f} = {fw_front_i:.2f} daN"
                        if qp else f"{fw_front_i:.2f} daN"
                    ),
                    "fw_lat_formula": (
                        f"{qty} * {cf_lat:.2f} * {a_lat:.2f} * {qp:.2f} = {fw_lat_i:.2f} daN"
                        if qp else f"{fw_lat_i:.2f} daN"
                    ),
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
                "fw_front_formula": (
                    " + ".join(f_front_parts) + f" = {round(tot_fw_front, 2):.2f} daN"
                    if len(f_front_parts) > 1
                    else (f"{round(tot_fw_front, 2):.2f} daN" if f_front_parts else "0.00 daN")
                ),
                "fw_lat_formula": (
                    " + ".join(f_lat_parts) + f" = {round(tot_fw_lat, 2):.2f} daN"
                    if len(f_lat_parts) > 1
                    else (f"{round(tot_fw_lat, 2):.2f} daN" if f_lat_parts else "0.00 daN")
                ),
            }

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

    cleaned_items = []
    for it in items:
        it_copy = dict(it)
        raw_name = it_copy.get("name") or it_copy.get("reference") or it_copy.get("catalog_reference") or ""
        it_copy["name"] = clean_equipment_designation(raw_name)
        cleaned_items.append(it_copy)
    items = cleaned_items

    from utils.domain_constants import resolve_sans_plot, resolve_support_has_echelle
    is_multi = len(items) > 1 or (totals.get("qty_total", 0) > 1)
    is_sans_plot = resolve_sans_plot(input_data, result_data, kind="rrh")

    h_mat = float(structure.get("hauteur_mat_m") if structure.get("hauteur_mat_m") is not None else ((input_data.get("rrh_equipment") or {}).get("hauteur_mat_m") if (input_data.get("rrh_equipment") or {}).get("hauteur_mat_m") is not None else 1.5))
    has_echelle = resolve_support_has_echelle(input_data, result_data, kind="rrh", is_sans_plot=is_sans_plot, hauteur_mat_m=h_mat)

    return {
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "hauteur_mat_m": h_mat,
        "extremes": extremes,
        "is_multi": is_multi,
        "qty_total": totals.get("qty_total", sum(it.get("qty", 1) for it in items)),
        "is_sans_plot": is_sans_plot,
        "has_echelle": has_echelle,
    }


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

    raw_items = result_data.get("rru_items") or rru_sub.get("rru_items") or []
    legacy_rru_compat = (
        not raw_items
        and result_data.get("has_rru") is None
        and isinstance(input_data.get("rru_equipment"), dict)
        and input_data["rru_equipment"].get("enabled")
    )
    if legacy_rru_compat:
        rrh_sub_legacy = result_data.get("rrh") if isinstance(result_data.get("rrh"), dict) else {}
        raw_items = result_data.get("rrh_items") or rrh_sub_legacy.get("rrh_items") or []

    totals = result_data.get("rru_totals") or rru_sub.get("rru_totals") or {}
    if not totals and legacy_rru_compat:
        rrh_sub_legacy = result_data.get("rrh") if isinstance(result_data.get("rrh"), dict) else {}
        totals = result_data.get("rrh_totals") or rrh_sub_legacy.get("rrh_totals") or {}

    wind = (
        result_data.get("rru_wind_params")
        or rru_sub.get("wind_params")
        or result_data.get("wind_params")
        or {}
    )
    structure = rru_sub.get("structure_params") or result_data.get("structure_params") or {}
    extremes = result_data.get("extremes") or rru_sub.get("extremes") or {}
    operateur = (
        result_data.get("operateur")
        or rru_sub.get("operateur")
        or input_data.get("operateur")
        or input_data.get("site", {}).get("operator")
        or "bouygues"
    )
    from utils.domain_constants import resolve_sans_plot
    is_sans_plot = resolve_sans_plot(input_data, result_data, kind="rru")

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
            weight_total = float(
                it.get("weight_total_kg") if it.get("weight_total_kg") is not None else round(qty * weight_kg, 2)
            )
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

    if not items:
        from geodata.catalogue_loader import find_rru_reference
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
                dims_str = (
                    f"{h_mm:g} x {w_mm:g} x {d_mm:g}"
                    if (h_mm or w_mm or d_mm)
                    else (spec.get("dimensions", "N/A") if spec else "N/A")
                )
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
                    "fw_front_formula": (
                        f"{qty} * {cf_front:.2f} * {a_front_calc:.2f} * {qp:.2f} = {fw_front_i:.2f} daN"
                        if qp else f"{fw_front_i:.2f} daN"
                    ),
                    "fw_lat_formula": (
                        f"{qty} * {cf_lat:.2f} * {a_lat_calc:.2f} * {qp:.2f} = {fw_lat_i:.2f} daN"
                        if qp else f"{fw_lat_i:.2f} daN"
                    ),
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
                "fw_front_formula": (
                    " + ".join(f_front_parts) + f" = {round(tot_fw_front, 2):.2f} daN"
                    if len(f_front_parts) > 1
                    else (f"{round(tot_fw_front, 2):.2f} daN" if f_front_parts else "0.00 daN")
                ),
                "fw_lat_formula": (
                    " + ".join(f_lat_parts) + f" = {round(tot_fw_lat, 2):.2f} daN"
                    if len(f_lat_parts) > 1
                    else (f"{round(tot_fw_lat, 2):.2f} daN" if f_lat_parts else "0.00 daN")
                ),
            }

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

    cleaned_items = []
    for it in items:
        it_copy = dict(it)
        raw_name = it_copy.get("name") or it_copy.get("reference") or it_copy.get("catalog_reference") or ""
        it_copy["name"] = clean_equipment_designation(raw_name)
        cleaned_items.append(it_copy)
    items = cleaned_items

    is_multi = len(items) > 1 or (totals.get("qty_total", 0) > 1)

    h_mat = float(structure.get("hauteur_mat_m") if structure.get("hauteur_mat_m") is not None else ((input_data.get("rru_equipment") or {}).get("hauteur_mat_m") if (input_data.get("rru_equipment") or {}).get("hauteur_mat_m") is not None else 1.5))
    from utils.domain_constants import resolve_support_has_echelle
    has_echelle = resolve_support_has_echelle(input_data, result_data, kind="rru", is_sans_plot=is_sans_plot, hauteur_mat_m=h_mat)

    return {
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "hauteur_mat_m": h_mat,
        "extremes": extremes,
        "operateur": operateur,
        "is_sans_plot": is_sans_plot,
        "has_echelle": has_echelle,
        "is_multi": is_multi,
        "qty_total": totals.get("qty_total", sum(it.get("qty", 1) for it in items)),
    }


def extract_fh_ndc_context(result_data: dict, input_data: dict = None, qp_val: float = 0.0) -> dict:
    """
    Extracts FH data from result_data with fallback to input_data for preview/pre-worker states.
    Golden Rule: Never recalculate qp, d_coef, or FwFH in Django if already computed by worker.
    Table 0 has 4 columns: [Désignation, Quantité, Dimensions (mm), Poids (kg)] (no État column).
    """
    from utils.domain_constants import FH_DIAMETER_COEFFICIENTS, resolve_sans_plot

    result_data = result_data if isinstance(result_data, dict) else {}
    input_data = input_data if isinstance(input_data, dict) else {}
    fh_sub = result_data.get("fh") if isinstance(result_data.get("fh"), dict) else {}

    raw_items = result_data.get("fh_items") or fh_sub.get("fh_items") or []
    totals = result_data.get("fh_totals") or fh_sub.get("fh_totals") or {}
    wind = (
        result_data.get("fh_wind_params")
        or fh_sub.get("wind_params")
        or result_data.get("wind_params")
        or {}
    )
    structure = fh_sub.get("structure_params") or result_data.get("structure_params") or {}
    if not structure:
        structure = input_data.get("structure_fh") or input_data.get("structure") or {}

    is_sans_plot = resolve_sans_plot(input_data, result_data, kind="fh")

    fh_eq_in = input_data.get("fh_equipment") if isinstance(input_data.get("fh_equipment"), dict) else {}
    fh_struct_in = input_data.get("structure_fh") if isinstance(input_data.get("structure_fh"), dict) else {}
    raw_h_mat_for_ech = (
        structure.get("hauteur_mat_m")
        if structure.get("hauteur_mat_m") is not None
        else (
            fh_eq_in.get("hauteur_mat_m")
            if fh_eq_in.get("hauteur_mat_m") is not None
            else fh_struct_in.get("hauteur_mat_m")
        )
    )
    try:
        fh_h_mat_num = float(raw_h_mat_for_ech) if raw_h_mat_for_ech is not None else 1.70
    except (ValueError, TypeError):
        fh_h_mat_num = 1.70

    raw_fh_echelle = (
        fh_eq_in.get("echelle")
        or fh_sub.get("echelle")
        or result_data.get("fh_echelle")
        or fh_struct_in.get("echelle")
    )
    if is_sans_plot or fh_h_mat_num < 2.0:
        fh_has_echelle = False
    elif isinstance(raw_fh_echelle, bool):
        fh_has_echelle = raw_fh_echelle
    elif isinstance(raw_fh_echelle, str):
        norm_ech = raw_fh_echelle.strip().lower()
        fh_has_echelle = (
            bool(norm_ech)
            and "pas d'echelle" not in norm_ech
            and "pas d'échelle" not in norm_ech
            and norm_ech not in ("non", "none", "false", "0")
        )
    else:
        fh_has_echelle = False

    try:
        qp = float(wind.get("qp_dan") or qp_val or 0.0)
    except (ValueError, TypeError):
        qp = 0.0

    items = []
    if raw_items:
        tot_qty = 0
        tot_weight = 0.0
        tot_fw_fh = 0.0
        fw_parts = []

        for idx, it in enumerate(raw_items, start=1):
            qty = int(it.get("qty") or it.get("quantity") or 1)
            diam = float(it.get("diameter_mm") or it.get("diametre_mm") or 600.0)
            dims_str = it.get("dimensions_str") or f"Ø{diam:g}"
            w_kg = float(it.get("weight_kg") or 0.0)
            w_tot = float(it.get("weight_total_kg") if it.get("weight_total_kg") is not None else round(qty * w_kg, 2))
            d_coef = float(it.get("d_coef") or FH_DIAMETER_COEFFICIENTS.get(int(diam), 0.06))
            cf_fh = float(it.get("cf_fh") or 1.0)

            fw_raw = it.get("fw_fh") if it.get("fw_fh") is not None else it.get("fw_front")
            fw_fh_i = float(fw_raw) if fw_raw is not None else (round(qty * cf_fh * d_coef * qp, 2) if qp else 0.0)

            formula = it.get("fw_fh_formula") or (
                f"{qty} * {cf_fh:g} * {d_coef:g} * {qp:.2f} = {fw_fh_i:.2f} daN"
                if qp else f"{fw_fh_i:.2f} daN"
            )

            items.append({
                "index": it.get("index", idx),
                "name": clean_fh_designation(it.get("name") or it.get("reference") or "FH"),
                "qty": qty,
                "quantity": qty,
                "diameter_mm": diam,
                "diametre_mm": diam,
                "dimensions_str": dims_str,
                "weight_kg": w_kg,
                "weight_unit_kg": f"{w_kg:g}",
                "weight_total_kg": w_tot,
                "pe_dan": w_tot,
                "d_coef": d_coef,
                "cf_fh": cf_fh,
                "fw_fh": fw_fh_i,
                "fw_front": fw_fh_i,
                "fw_lat": fw_fh_i,
                "fw_fh_formula": formula,
            })
            tot_qty += qty
            tot_weight += w_tot
            tot_fw_fh += fw_fh_i
            fw_parts.append(f"{fw_fh_i:.2f}")

        totals = dict(totals) if isinstance(totals, dict) else {}
        totals.setdefault("count", len(items))
        totals.setdefault("qty_total", tot_qty)
        totals.setdefault("weight_total_kg", round(tot_weight, 2))
        totals.setdefault("pe_dan", totals.get("weight_total_kg", round(tot_weight, 2)))
        if totals.get("fw_fh") is None:
            totals["fw_fh"] = round(tot_fw_fh, 2)
        if totals.get("fw_front") is None:
            totals["fw_front"] = totals["fw_fh"]
        if totals.get("fw_lat") is None:
            totals["fw_lat"] = totals["fw_fh"]
        if not totals.get("fw_fh_formula"):
            totals["fw_fh_formula"] = (
                " + ".join(fw_parts) + f" = {round(tot_fw_fh, 2):.2f} daN"
                if len(fw_parts) > 1
                else (f"{round(tot_fw_fh, 2):.2f} daN" if fw_parts else "0.00 daN")
            )

    # Fallback from input_data when result_data has no items
    if not items:
        fh_eq = input_data.get("fh_equipment") or {}
        raw_in_items = fh_eq.get("items") or []
        if not raw_in_items and fh_eq.get("enabled"):
            raw_in_items = [fh_eq]

        if raw_in_items:
            from geodata.catalogue_loader import find_fh_reference
            tot_qty = 0
            tot_weight = 0.0
            tot_fw_fh = 0.0
            fw_parts = []

            for idx, it in enumerate(raw_in_items, start=1):
                ref = it.get("reference") or it.get("name") or "Antenne FH"
                spec = find_fh_reference(ref) if ref else None
                qty = int(it.get("quantity") or it.get("qty") or 1)
                diam = float(it.get("diameter_mm") or (spec.get("diameter") if spec else 600.0) or 600.0)
                dims_str = f"Ø{diam:g}"
                w_kg = float(it.get("weight_kg") or (spec.get("weight") if spec else 15.0) or 15.0)
                w_tot = round(qty * w_kg, 2)
                d_coef = FH_DIAMETER_COEFFICIENTS.get(int(diam), 0.06)
                cf_fh = 1.0
                fw_i = round(qty * cf_fh * d_coef * qp, 2) if qp else 0.0
                formula = f"{qty} * 1 * {d_coef:g} * {qp:.2f} = {fw_i:.2f} daN" if qp else f"{fw_i:.2f} daN"

                items.append({
                    "index": idx,
                    "name": clean_fh_designation((spec.get("name") if spec else None) or ref),
                    "qty": qty,
                    "quantity": qty,
                    "diameter_mm": diam,
                    "diametre_mm": diam,
                    "dimensions_str": dims_str,
                    "weight_kg": w_kg,
                    "weight_unit_kg": f"{w_kg:g}",
                    "weight_total_kg": w_tot,
                    "pe_dan": w_tot,
                    "d_coef": d_coef,
                    "cf_fh": cf_fh,
                    "fw_fh": fw_i,
                    "fw_front": fw_i,
                    "fw_lat": fw_i,
                    "fw_fh_formula": formula,
                })
                tot_qty += qty
                tot_weight += w_tot
                tot_fw_fh += fw_i
                fw_parts.append(f"{fw_i:.2f}")

            totals = {
                "count": len(items),
                "qty_total": tot_qty,
                "weight_total_kg": round(tot_weight, 2),
                "pe_dan": round(tot_weight, 2),
                "fw_fh": round(tot_fw_fh, 2),
                "fw_front": round(tot_fw_fh, 2),
                "fw_lat": round(tot_fw_fh, 2),
                "fw_fh_formula": (
                    " + ".join(fw_parts) + f" = {round(tot_fw_fh, 2):.2f} daN"
                    if len(fw_parts) > 1
                    else (f"{round(tot_fw_fh, 2):.2f} daN" if fw_parts else "0.00 daN")
                ),
            }

    if not items:
        diam = 600.0
        d_coef = 0.06
        fw_i = round(1.0 * d_coef * qp, 2) if qp else 0.0
        items = [{
            "index": 1,
            "name": "Antenne FH",
            "qty": 1,
            "quantity": 1,
            "diameter_mm": diam,
            "diametre_mm": diam,
            "dimensions_str": f"Ø{diam:g}",
            "weight_kg": 15.0,
            "weight_unit_kg": "15",
            "weight_total_kg": 15.0,
            "pe_dan": 15.0,
            "d_coef": d_coef,
            "cf_fh": 1.0,
            "fw_fh": fw_i,
            "fw_front": fw_i,
            "fw_lat": fw_i,
            "fw_fh_formula": f"1 * 1 * {d_coef:g} * {qp:.2f} = {fw_i:.2f} daN" if qp else f"{fw_i:.2f} daN",
        }]
        totals = {
            "count": 1,
            "qty_total": 1,
            "weight_total_kg": 15.0,
            "pe_dan": 15.0,
            "fw_fh": fw_i,
            "fw_front": fw_i,
            "fw_lat": fw_i,
            "fw_fh_formula": f"{fw_i:.2f} daN",
        }

    table_0_rows = []
    for it in items:
        table_0_rows.append({
            "name": clean_fh_designation(it.get("name") or "FH"),
            "quantity": it.get("qty", 1),
            "dimensions_str": it.get("dimensions_str", f"Ø{it.get('diameter_mm', 600):g}"),
            "weight_unit_kg": f"{float(it.get('weight_kg', 0)):g}",
            "diameter_mm": it.get("diameter_mm", 600),
            "d_coef": it.get("d_coef", 0.06),
            "fw_fh_formula": it.get("fw_fh_formula", ""),
        })

    mast_sec = structure.get("mast_section", "TRON 88x3.2")
    plot_sec = None if is_sans_plot else structure.get("plot_section", "TCAR 150x5")
    h_mat = float(structure.get("hauteur_mat_m") if structure.get("hauteur_mat_m") is not None else 1.7)
    h_plot = 0.0 if is_sans_plot else float(structure.get("plot_h_m") if structure.get("plot_h_m") is not None else (structure.get("hauteur_plot_m") if structure.get("hauteur_plot_m") is not None else 0.5))

    return {
        "is_fh": True,
        "is_sans_plot": is_sans_plot,
        "has_echelle": fh_has_echelle,
        "table_0_items": table_0_rows,
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "mast_section": mast_sec,
        "plot_section": plot_sec,
        "hauteur_mat_m": h_mat,
        "hauteur_plot_m": h_plot,
        "extremes": fh_sub.get("extremes") or result_data.get("extremes") or {},
        "qty_total": totals.get("qty_total", sum(it.get("qty", 1) for it in items)),
        "is_multi": len(items) > 1 or totals.get("qty_total", 1) > 1,
    }


def extract_lovage_ndc_context(result_data: dict, input_data: dict = None, qp_val: float = 0.0) -> dict:
    """
    Extracts Boîtier de Lovage (Zone Technique) data from result_data with fallback to
    input_data for preview/pre-worker states.
    Wind drag coefficients: Cf,front = 1.47, Cf,lat = 1.19.
    Supports both `avec plot` (TCAR 150x5) and `sans plot` (mât TRON 88x3.2 only).
    """
    from utils.domain_constants import (
        LOVAGE_CF_FRONT,
        LOVAGE_CF_LAT,
        LOVAGE_DEFAULT_MAST_HEIGHT_M,
        LOVAGE_DEFAULT_MAST_SECTION,
        LOVAGE_DEFAULT_PLOT_HEIGHT_M,
        LOVAGE_DEFAULT_PLOT_SECTION,
        MDEA_CF_FRONT,
        MDEA_CF_LAT,
        resolve_lovage_comounts,
        resolve_sans_plot,
    )

    result_data = result_data if isinstance(result_data, dict) else {}
    input_data = input_data if isinstance(input_data, dict) else {}
    lovage_sub = result_data.get("lovage") if isinstance(result_data.get("lovage"), dict) else {}
    lovage_in = input_data.get("boitier_lovage") if isinstance(input_data.get("boitier_lovage"), dict) else {}
    if not lovage_in and isinstance(input_data.get("lovage_equipment"), dict):
        lovage_in = input_data.get("lovage_equipment")

    raw_items = result_data.get("lovage_items") or lovage_sub.get("lovage_items") or []
    has_worker_totals = bool(result_data.get("lovage_totals") or lovage_sub.get("lovage_totals"))
    totals = result_data.get("lovage_totals") or lovage_sub.get("lovage_totals") or {}
    wind = (
        result_data.get("lovage_wind_params")
        or lovage_sub.get("wind_params")
        or result_data.get("wind_params")
        or {}
    )
    structure = lovage_sub.get("structure_params") or result_data.get("structure_params") or {}
    if not structure:
        structure = input_data.get("structure_lovage") or input_data.get("structure") or {}

    is_sans_plot = resolve_sans_plot(input_data, result_data, kind="lovage")

    try:
        qp = float(wind.get("qp_dan") or qp_val or 0.0)
    except (ValueError, TypeError):
        qp = 0.0

    def _fmt_area(val: float) -> str:
        return f"{val:.4f}".rstrip("0").rstrip(".") if val else "0"

    items = []
    if raw_items:
        tot_qty = 0
        tot_weight = 0.0
        tot_fw_front = 0.0
        tot_fw_lat = 0.0
        f_front_parts = []
        f_lat_parts = []

        for idx, it in enumerate(raw_items, start=1):
            qty = int(it.get("qty") or it.get("quantity") or 1)
            h_mm = float(it.get("h_mm") or it.get("hauteur_mm") or 0.0)
            w_mm = float(it.get("w_mm") or it.get("largeur_mm") or 0.0)
            d_mm = float(
                it.get("d_mm")
                if it.get("d_mm") is not None
                else (it.get("t_mm") or it.get("epaisseur_mm") or 0.0)
            )
            dims_str = it.get("dimensions_str") or it.get("dimensions")
            if not dims_str:
                dims_str = f"{h_mm:g} x {w_mm:g} x {d_mm:g}" if (h_mm or w_mm or d_mm) else "N/A"

            weight_kg = float(it.get("weight_kg") or it.get("poids_kg") or 0.0)
            weight_total = float(
                it.get("weight_total_kg") if it.get("weight_total_kg") is not None else round(qty * weight_kg, 2)
            )
            cf_front = float(it.get("cf_front") if it.get("cf_front") is not None else LOVAGE_CF_FRONT)
            cf_lat = float(it.get("cf_lat") if it.get("cf_lat") is not None else LOVAGE_CF_LAT)

            a_front = float(
                it.get("area_front_m2")
                if it.get("area_front_m2") is not None
                else (
                    it.get("a_front")
                    if it.get("a_front") is not None
                    else (round((h_mm * w_mm) / 1e6, 4) if (h_mm and w_mm) else 0.0)
                )
            )
            a_lat = float(
                it.get("area_lat_m2")
                if it.get("area_lat_m2") is not None
                else (
                    it.get("a_lat")
                    if it.get("a_lat") is not None
                    else (round((h_mm * d_mm) / 1e6, 4) if (h_mm and d_mm) else 0.0)
                )
            )

            fw_f_raw = it.get("fw_front") if it.get("fw_front") is not None else it.get("fw_front_dan")
            fw_l_raw = it.get("fw_lat") if it.get("fw_lat") is not None else it.get("fw_lat_dan")
            fw_front_i = float(fw_f_raw) if fw_f_raw is not None else (round(qty * cf_front * a_front * qp, 2) if qp else 0.0)
            fw_lat_i = float(fw_l_raw) if fw_l_raw is not None else (round(qty * cf_lat * a_lat * qp, 2) if qp else 0.0)

            fw_front_formula = it.get("fw_front_formula") or (
                f"{qty} * {cf_front:.2f} * {_fmt_area(a_front)} * {qp:.2f} = {fw_front_i:.2f} daN"
                if qp else f"{fw_front_i:.2f} daN"
            )
            fw_lat_formula = it.get("fw_lat_formula") or (
                f"{qty} * {cf_lat:.2f} * {_fmt_area(a_lat)} * {qp:.2f} = {fw_lat_i:.2f} daN"
                if qp else f"{fw_lat_i:.2f} daN"
            )

            items.append({
                "index": it.get("index", idx),
                "name": it.get("name") or it.get("reference") or "Boitiers de lovage",
                "catalog_reference": it.get("catalog_reference") or it.get("reference") or it.get("name") or "Boitiers de lovage",
                "qty": qty,
                "h_mm": h_mm,
                "w_mm": w_mm,
                "d_mm": d_mm,
                "dimensions_str": dims_str,
                "weight_kg": weight_kg,
                "weight_unit_kg": f"{weight_kg:g}",
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
            f_front_parts.append(f"{fw_front_i:.2f}")
            f_lat_parts.append(f"{fw_lat_i:.2f}")

        totals = dict(totals) if isinstance(totals, dict) else {}
        totals.setdefault("count", len(items))
        totals.setdefault("qty_total", tot_qty)
        totals.setdefault("weight_total_kg", round(tot_weight, 2))
        totals.setdefault("pe_dan", totals.get("weight_total_kg", round(tot_weight, 2)))
        if totals.get("fw_front") is None:
            totals["fw_front"] = wind.get("fw_front_total_dan") if wind.get("fw_front_total_dan") is not None else round(tot_fw_front, 2)
        if totals.get("fw_lat") is None:
            totals["fw_lat"] = wind.get("fw_lat_total_dan") if wind.get("fw_lat_total_dan") is not None else round(tot_fw_lat, 2)
        totals.setdefault(
            "fw_front_formula",
            " + ".join(f_front_parts) + f" = {round(tot_fw_front, 2):.2f} daN"
            if len(f_front_parts) > 1
            else (f"{round(tot_fw_front, 2):.2f} daN" if f_front_parts else "0.00 daN"),
        )
        totals.setdefault(
            "fw_lat_formula",
            " + ".join(f_lat_parts) + f" = {round(tot_fw_lat, 2):.2f} daN"
            if len(f_lat_parts) > 1
            else (f"{round(tot_fw_lat, 2):.2f} daN" if f_lat_parts else "0.00 daN"),
        )

    if not items:
        raw_in_items = lovage_in.get("items") or []
        if not raw_in_items and lovage_in.get("enabled"):
            raw_in_items = [lovage_in]

        if raw_in_items:
            built_items = []
            tot_qty = 0
            tot_weight = 0.0
            tot_fw_front = 0.0
            tot_fw_lat = 0.0
            f_front_parts = []
            f_lat_parts = []

            for idx, it in enumerate(raw_in_items, start=1):
                ref = it.get("reference") or it.get("name") or "Boitiers de lovage"
                qty = int(it.get("quantity") or it.get("qty") or 1)
                h_mm = float(it.get("h_mm") or it.get("hauteur_mm") or 0.0)
                w_mm = float(it.get("w_mm") or it.get("largeur_mm") or 0.0)
                d_mm = float(it.get("d_mm") or it.get("epaisseur_mm") or it.get("t_mm") or 0.0)
                if not (h_mm and w_mm and d_mm) and it.get("dimensions"):
                    parsed = _parse_envelope_dims_m(it.get("dimensions"))
                    if parsed:
                        h_mm, w_mm, d_mm = round(parsed[0] * 1000, 1), round(parsed[1] * 1000, 1), round(parsed[2] * 1000, 1)
                dims_str = (
                    f"{h_mm:g} x {w_mm:g} x {d_mm:g}"
                    if (h_mm or w_mm or d_mm)
                    else (str(it.get("dimensions")) if it.get("dimensions") else "N/A")
                )
                weight_kg = float(it.get("weight_kg") or it.get("poids_kg") or 0.0)
                weight_total = round(qty * weight_kg, 2)
                cf_front = float(it.get("cf_front") if it.get("cf_front") is not None else LOVAGE_CF_FRONT)
                cf_lat = float(it.get("cf_lat") if it.get("cf_lat") is not None else LOVAGE_CF_LAT)
                a_front = float(
                    it.get("a_front")
                    if it.get("a_front") is not None
                    else (round((h_mm * w_mm) / 1e6, 4) if (h_mm and w_mm) else 0.0)
                )
                a_lat = float(
                    it.get("a_lat")
                    if it.get("a_lat") is not None
                    else (round((h_mm * d_mm) / 1e6, 4) if (h_mm and d_mm) else 0.0)
                )
                fw_front_i = round(qty * cf_front * a_front * qp, 2) if qp else 0.0
                fw_lat_i = round(qty * cf_lat * a_lat * qp, 2) if qp else 0.0

                built_items.append({
                    "index": idx,
                    "name": ref,
                    "catalog_reference": ref,
                    "qty": qty,
                    "h_mm": h_mm,
                    "w_mm": w_mm,
                    "d_mm": d_mm,
                    "dimensions_str": dims_str,
                    "weight_kg": weight_kg,
                    "weight_unit_kg": f"{weight_kg:g}" if weight_kg else "N/A",
                    "weight_total_kg": weight_total,
                    "cf_front": cf_front,
                    "cf_lat": cf_lat,
                    "a_front": a_front,
                    "a_lat": a_lat,
                    "fw_front": fw_front_i,
                    "fw_lat": fw_lat_i,
                    "pe_dan": weight_total,
                    "fw_front_formula": (
                        f"{qty} * {cf_front:.2f} * {_fmt_area(a_front)} * {qp:.2f} = {fw_front_i:.2f} daN"
                        if qp else f"{fw_front_i:.2f} daN"
                    ),
                    "fw_lat_formula": (
                        f"{qty} * {cf_lat:.2f} * {_fmt_area(a_lat)} * {qp:.2f} = {fw_lat_i:.2f} daN"
                        if qp else f"{fw_lat_i:.2f} daN"
                    ),
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
                "fw_front_formula": (
                    " + ".join(f_front_parts) + f" = {round(tot_fw_front, 2):.2f} daN"
                    if len(f_front_parts) > 1
                    else (f"{round(tot_fw_front, 2):.2f} daN" if f_front_parts else "0.00 daN")
                ),
                "fw_lat_formula": (
                    " + ".join(f_lat_parts) + f" = {round(tot_fw_lat, 2):.2f} daN"
                    if len(f_lat_parts) > 1
                    else (f"{round(tot_fw_lat, 2):.2f} daN" if f_lat_parts else "0.00 daN")
                ),
            }

    if not items:
        items = [{
            "index": 1,
            "name": "Boitiers de lovage",
            "catalog_reference": "Boitiers de lovage",
            "qty": 1,
            "h_mm": 0.0,
            "w_mm": 0.0,
            "d_mm": 0.0,
            "dimensions_str": "N/A",
            "weight_kg": 0.0,
            "weight_unit_kg": "N/A",
            "weight_total_kg": 0.0,
            "cf_front": LOVAGE_CF_FRONT,
            "cf_lat": LOVAGE_CF_LAT,
            "a_front": 0.0,
            "a_lat": 0.0,
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

    mast_sec = structure.get("mast_section") or LOVAGE_DEFAULT_MAST_SECTION
    plot_sec = None if is_sans_plot else (structure.get("plot_section") or LOVAGE_DEFAULT_PLOT_SECTION)
    raw_h_mat = (
        structure.get("hauteur_mat_m")
        if structure.get("hauteur_mat_m") is not None
        else lovage_in.get("hauteur_mat_m")
    )
    try:
        h_mat = float(raw_h_mat) if raw_h_mat is not None else LOVAGE_DEFAULT_MAST_HEIGHT_M
    except (ValueError, TypeError):
        h_mat = LOVAGE_DEFAULT_MAST_HEIGHT_M
    raw_h_plot = (
        structure.get("plot_h_m")
        if structure.get("plot_h_m") is not None
        else structure.get("hauteur_plot_m")
    )
    try:
        h_plot = 0.0 if is_sans_plot else (float(raw_h_plot) if raw_h_plot is not None else LOVAGE_DEFAULT_PLOT_HEIGHT_M)
    except (ValueError, TypeError):
        h_plot = 0.0 if is_sans_plot else LOVAGE_DEFAULT_PLOT_HEIGHT_M

    has_echelle = False

    comounts = resolve_lovage_comounts(input_data, result_data)
    has_gps = comounts["has_gps"]
    has_mdea = comounts["has_mdea"]
    lovage_variant = comounts["variant"]

    gps_item = None
    if has_gps and comounts["gps"]:
        g = comounts["gps"]
        g_qty = int(g.get("quantity") or 1)
        g_w = float(g.get("weight_kg") or 0.0)
        gps_item = {
            "name": "Antenne GPS",
            "marque": g.get("marque"),
            "reference": g.get("reference"),
            "qty": g_qty,
            "dimensions_str": g.get("dimensions_str") or "N/A",
            "weight_kg": g_w,
            "weight_unit_kg": f"{g_w:g}" if g_w > 0 else "Négligeable",
            "pe_dan": 0.0,
            "fw_front": 0.0,
            "fw_lat": 0.0,
        }

    mdea_item = None
    if has_mdea and comounts["mdea"]:
        m = comounts["mdea"]
        mdea_res = (
            result_data.get("lovage_mdea")
            if isinstance(result_data.get("lovage_mdea"), dict)
            else (lovage_sub.get("mdea") if isinstance(lovage_sub.get("mdea"), dict) else {})
        )
        m_qty = int(m.get("quantity") or 1)
        mh = float(m.get("h_mm") or 338.0)
        mw = float(m.get("w_mm") or 295.0)
        md = float(m.get("d_mm") or 140.0)
        m_dims = m.get("dimensions_str") or f"{mh:g} x {mw:g} x {md:g}"
        m_w = float(m.get("weight_kg") if m.get("weight_kg") is not None else 10.0)
        m_cf_f = float(m.get("cf_front") if m.get("cf_front") is not None else MDEA_CF_FRONT)
        m_cf_l = float(m.get("cf_lat") if m.get("cf_lat") is not None else MDEA_CF_LAT)

        m_a_front = float(
            mdea_res.get("area_front_m2")
            if mdea_res.get("area_front_m2") is not None
            else (
                mdea_res.get("a_front")
                if mdea_res.get("a_front") is not None
                else (round((mh * mw) / 1e6, 4) if (mh and mw) else 0.0)
            )
        )
        m_a_lat = float(
            mdea_res.get("area_lat_m2")
            if mdea_res.get("area_lat_m2") is not None
            else (
                mdea_res.get("a_lat")
                if mdea_res.get("a_lat") is not None
                else (round((mh * md) / 1e6, 4) if (mh and md) else 0.0)
            )
        )
        m_fw_f_raw = mdea_res.get("fw_front") if mdea_res.get("fw_front") is not None else mdea_res.get("fw_front_dan")
        m_fw_l_raw = mdea_res.get("fw_lat") if mdea_res.get("fw_lat") is not None else mdea_res.get("fw_lat_dan")
        m_fw_front = float(m_fw_f_raw) if m_fw_f_raw is not None else (round(m_qty * m_cf_f * m_a_front * qp, 2) if qp else 0.0)
        m_fw_lat = float(m_fw_l_raw) if m_fw_l_raw is not None else (round(m_qty * m_cf_l * m_a_lat * qp, 2) if qp else 0.0)
        m_pe = float(mdea_res.get("pe_dan") if mdea_res.get("pe_dan") is not None else round(m_qty * m_w, 2))

        m_fw_front_formula = mdea_res.get("fw_front_formula") or (
            f"{m_qty} * {m_cf_f:.2f} * {_fmt_area(m_a_front)} * {qp:.2f} = {m_fw_front:.2f} daN"
            if qp else f"{m_fw_front:.2f} daN"
        )
        m_fw_lat_formula = mdea_res.get("fw_lat_formula") or (
            f"{m_qty} * {m_cf_l:.2f} * {_fmt_area(m_a_lat)} * {qp:.2f} = {m_fw_lat:.2f} daN"
            if qp else f"{m_fw_lat:.2f} daN"
        )

        mdea_item = {
            "name": "MDEA",
            "qty": m_qty,
            "h_mm": mh,
            "w_mm": mw,
            "d_mm": md,
            "dimensions_str": m_dims,
            "weight_kg": m_w,
            "weight_unit_kg": f"{m_w:g}",
            "weight_total_kg": m_pe,
            "cf_front": m_cf_f,
            "cf_lat": m_cf_l,
            "a_front": m_a_front,
            "a_lat": m_a_lat,
            "fw_front": m_fw_front,
            "fw_lat": m_fw_lat,
            "pe_dan": m_pe,
            "fw_front_formula": m_fw_front_formula,
            "fw_lat_formula": m_fw_lat_formula,
        }

    if not has_worker_totals:
        totals = dict(totals)
        extra_pe = (mdea_item["pe_dan"] if mdea_item else 0.0) + (gps_item["pe_dan"] if gps_item else 0.0)
        if extra_pe:
            totals["weight_total_kg"] = round(float(totals.get("weight_total_kg") or 0.0) + extra_pe, 2)
            totals["pe_dan"] = round(float(totals.get("pe_dan") or 0.0) + extra_pe, 2)
        if mdea_item:
            totals["fw_front"] = round(float(totals.get("fw_front") or 0.0) + mdea_item["fw_front"], 2)
            totals["fw_lat"] = round(float(totals.get("fw_lat") or 0.0) + mdea_item["fw_lat"], 2)

    qty_total = totals.get("qty_total", sum(it.get("qty", 1) for it in items))
    return {
        "is_lovage": True,
        "is_sans_plot": is_sans_plot,
        "has_echelle": has_echelle,
        "has_gps": has_gps,
        "has_mdea": has_mdea,
        "lovage_variant": lovage_variant,
        "gps_item": gps_item,
        "mdea_item": mdea_item,
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "mast_section": mast_sec,
        "plot_section": plot_sec,
        "hauteur_mat_m": h_mat,
        "hauteur_plot_m": h_plot,
        "extremes": lovage_sub.get("extremes") or result_data.get("extremes") or {},
        "qty_total": qty_total,
        "is_multi": len(items) > 1 or qty_total > 1,
    }


