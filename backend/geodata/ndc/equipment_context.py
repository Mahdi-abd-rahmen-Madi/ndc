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
    cleaned = re.sub(r'^(?:NOKIA|HUAWEI|ERICSSON|ZTE|SAMSUNG)\s+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^(?:RRH|RRU)\s+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^(?:NOKIA|HUAWEI|ERICSSON|ZTE|SAMSUNG)\s+', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or str(name)


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
    structure = result_data.get("structure_params") or rrh_sub.get("structure_params") or {}
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

    is_multi = len(items) > 1 or (totals.get("qty_total", 0) > 1)
    is_sans_plot = bool(
        result_data.get("rrh_sans_plot")
        or result_data.get("sans_plot")
        or rrh_sub.get("sans_plot")
        or structure.get("sans_plot")
        or input_data.get("rrh_sans_plot")
        or input_data.get("sans_plot")
        or "sans_plot" in str(result_data.get("calculation_type") or "").lower()
    )

    return {
        "items": items,
        "totals": totals,
        "wind": wind,
        "structure": structure,
        "extremes": extremes,
        "is_multi": is_multi,
        "qty_total": totals.get("qty_total", sum(it.get("qty", 1) for it in items)),
        "is_sans_plot": is_sans_plot,
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
    raw_sans_plot = (
        result_data.get("rru_sans_plot")
        if result_data.get("rru_sans_plot") is not None
        else (
            rru_sub.get("sans_plot")
            if rru_sub.get("sans_plot") is not None
            else (
                structure.get("sans_plot")
                if structure.get("sans_plot") is not None
                else (
                    input_data.get("sans_plot")
                    if input_data.get("sans_plot") is not None
                    else (input_data.get("rru_equipment") or {}).get("sans_plot")
                )
            )
        )
    )
    is_sans_plot = True if raw_sans_plot is None else bool(raw_sans_plot)

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

