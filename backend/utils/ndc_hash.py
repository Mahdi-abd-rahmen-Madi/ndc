import json
import hashlib
from typing import Dict, Any

from utils.domain_constants import normalize_operator, resolve_sans_plot

VOLATILE_KEYS = {
    "id", "job_id", "client_id", "client", "project_name", "site_name", "site",
    "user_id", "author", "created_at", "updated_at", "timestamp", "date",
    "inspect_mode", "inspect", "force_recalculate", "bypass_cache", "no_cache",
    "output_docx", "output_pdf", "generate_doc", "csrf_token", "auth", "token",
    "session_id", "status", "priority", "webhook_url"
}

def detect_calculation_type(input_data: Dict[str, Any]) -> str:
    if not input_data:
        return "antenna"
    if input_data.get("calculation_type"):
        return str(input_data["calculation_type"]).lower().strip()
    if input_data.get("is_fh") is True:
        return "fh_sans_plot" if resolve_sans_plot(input_data, kind="fh") else "fh"
    if input_data.get("is_rru") is True:
        return "rru_sans_plot" if resolve_sans_plot(input_data, kind="rru") else "rru"
    if input_data.get("is_rrh") is True:
        return "rrh_sans_plot" if resolve_sans_plot(input_data, kind="rrh") else "rrh"
    type_str = f"{input_data.get('type_support', '')} {input_data.get('type', '')}".lower()
    if "fh" in type_str or "faisceau" in type_str:
        return "fh_sans_plot" if resolve_sans_plot(input_data, kind="fh") else "fh"
    if "rru" in type_str:
        return "rru_sans_plot" if resolve_sans_plot(input_data, kind="rru") else "rru"
    if "rrh" in type_str:
        return "rrh_sans_plot" if resolve_sans_plot(input_data, kind="rrh") else "rrh"

    has_antenna = bool(input_data.get("antenna_4g") or input_data.get("antenna_5g"))
    fh_eq = input_data.get("fh_equipment")
    if isinstance(fh_eq, dict) and fh_eq.get("enabled"):
        if not has_antenna:
            return "fh_sans_plot" if resolve_sans_plot(input_data, kind="fh") else "fh"
        return "antenna_with_fh_sans_plot" if resolve_sans_plot(input_data, kind="fh") else "antenna_with_fh"

    rru_eq = input_data.get("rru_equipment")
    if isinstance(rru_eq, dict) and rru_eq.get("enabled") and not has_antenna:
        return "rru_sans_plot" if resolve_sans_plot(input_data, kind="rru") else "rru"

    eq = input_data.get("equipment")
    if eq and isinstance(eq, dict):
        eq_label = f"{eq.get('model', '')} {eq.get('reference', '')}".lower()
        if "fh" in eq_label:
            return "fh_sans_plot" if resolve_sans_plot(input_data, kind="fh") else "fh"
        if "rru" in eq_label or "radio " in eq_label:
            return "rru"
        if "rrh" in eq_label:
            return "rrh"
        if not has_antenna:
            return "rrh"
    return "antenna"

def _normalize(val: Any) -> Any:
    if isinstance(val, dict):
        return {
            str(k).strip().lower(): _normalize(v)
            for k, v in sorted(val.items())
            if str(k).strip().lower() not in VOLATILE_KEYS
        }
    elif isinstance(val, list):
        return [_normalize(x) for x in val]
    elif isinstance(val, float):
        return round(val, 4)
    elif isinstance(val, str):
        cleaned = val.strip()
        if any(prefix in cleaned.upper() for prefix in ["TCAR", "TRON", "IPE", "HEA", "HEB", "UPN", "RRH"]):
            return cleaned.upper()
        return cleaned
    elif isinstance(val, (int, bool)) or val is None:
        return val
    return str(val)

def compute_ndc_hash(calc_type: str, input_data: Dict[str, Any]) -> str:
    normalized_type = str(calc_type).lower().strip()
    data = input_data or {}

    structure = data.get("structure") or {}
    environment = data.get("environment") or {}
    equipment = data.get("equipment") or {}
    antenna_4g = data.get("antenna_4g") or {}
    antenna_5g = data.get("antenna_5g") or {}

    env_keys = ["region", "terrain_type", "building_height_m", "hauteur_batiment", "vb0", "qp_dan"]
    top_env = {k: data[k] for k in env_keys if k in data and k not in environment}
    merged_env = {**top_env, **(environment if isinstance(environment, dict) else {})}

    canonical = {
        "calc_type": normalized_type,
        "structure": _normalize(structure),
        "environment": _normalize(merged_env),
    }

    has_antenna = bool(data.get("antenna_4g") or data.get("antenna_5g"))
    if normalized_type in ("rrh", "rru") or equipment:
        canonical["equipment"] = _normalize(equipment)
    if normalized_type == "antenna" or antenna_4g or antenna_5g or has_antenna:
        canonical["antenna_4g"] = _normalize(antenna_4g)
        canonical["antenna_5g"] = _normalize(antenna_5g)

    # 1. Base Antenna mast height in structure
    if has_antenna and "hauteur_mat_m" in structure and structure["hauteur_mat_m"] is not None:
        try:
            canonical["structure"]["hauteur_mat_m"] = round(float(structure["hauteur_mat_m"]), 3)
        except (ValueError, TypeError):
            pass

    # 2. Per-equipment mast heights for every enabled equipment
    for eq_key in ("rrh_equipment", "rru_equipment", "fh_equipment"):
        eq_blk = data.get(eq_key)
        if isinstance(eq_blk, dict) and eq_blk.get("enabled"):
            eq_copy = dict(eq_blk)
            kind = eq_key.replace("_equipment", "")
            raw_h = eq_copy.get("hauteur_mat_m")
            if raw_h is None:
                sub_struct = data.get(f"structure_{kind}") or {}
                raw_h = sub_struct.get("hauteur_mat_m")
            if raw_h is None and not has_antenna:
                raw_h = structure.get("hauteur_mat_m")
            if raw_h is not None:
                try:
                    eq_copy["hauteur_mat_m"] = round(float(raw_h), 3)
                except (ValueError, TypeError):
                    pass
            if eq_copy.get("sans_plot") is None:
                eq_copy["sans_plot"] = False
            canonical[eq_key] = _normalize(eq_copy)

    if "structure_fh" in data and isinstance(data["structure_fh"], dict):
        canonical["structure_fh"] = _normalize(data["structure_fh"])

    is_rru = normalized_type in ("rru", "rru_sans_plot", "antenna_with_rru", "antenna_with_rru_sans_plot") or data.get("is_rru") is True
    is_fh = normalized_type in ("fh", "fh_sans_plot", "antenna_with_fh", "antenna_with_fh_sans_plot") or data.get("is_fh") is True
    target_kind = "fh" if is_fh else ("rru" if is_rru else normalized_type)
    if resolve_sans_plot(data, calc_type=normalized_type, kind=target_kind):
        canonical["sans_plot"] = True

    op = normalize_operator(data.get("operateur") or data.get("operator"), fallback_site=data.get("site"))
    if op:
        canonical["operateur"] = op

    if "deflection_limit" in data:
        canonical["deflection_limit"] = _normalize(data["deflection_limit"])

    canonical_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    sha = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    return f"ndc_{normalized_type}_{sha[:24]}"

