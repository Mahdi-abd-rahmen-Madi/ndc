import json
import hashlib
from typing import Dict, Any

from utils.domain_constants import normalize_operator, normalize_structure_case, resolve_sans_plot

VOLATILE_KEYS = {
    "id", "job_id", "client_id", "client", "project_name", "site_name", "site",
    "user_id", "author", "created_at", "updated_at", "timestamp", "date",
    "inspect_mode", "inspect", "force_recalculate", "bypass_cache", "no_cache",
    "output_docx", "output_pdf", "generate_doc", "csrf_token", "auth", "token",
    "session_id", "status", "priority", "webhook_url",
    "_callback_url", "callback_url", "django_backend_url", "api_base_url"
}

def _has_active_antenna(input_data: Dict[str, Any]) -> bool:
    for key in ("antenna_4g", "antenna_5g"):
        ant = input_data.get(key)
        if isinstance(ant, dict) and any(
            ant.get(f) for f in ("model", "hauteur_mm", "largeur_mm", "epaisseur_mm", "poids_kg", "height_mm", "width_mm")
        ):
            return True
    return False


def detect_calculation_type(input_data: Dict[str, Any]) -> str:
    if not input_data:
        return "antenna"
    if input_data.get("calculation_type"):
        return str(input_data["calculation_type"]).lower().strip()

    has_antenna = _has_active_antenna(input_data)

    # Check active equipment stages in canonical worker execution order:
    # 1. RRH or RRU
    # 2. FH
    # 3. Any future registered <kind>_equipment blocks
    rrh_eq = input_data.get("rrh_equipment")
    rru_eq = input_data.get("rru_equipment")
    fh_eq = input_data.get("fh_equipment")

    rrh_active = (isinstance(rrh_eq, dict) and bool(rrh_eq.get("enabled"))) or input_data.get("is_rrh") is True
    rru_active = (isinstance(rru_eq, dict) and bool(rru_eq.get("enabled"))) or input_data.get("is_rru") is True
    fh_active = (isinstance(fh_eq, dict) and bool(fh_eq.get("enabled"))) or input_data.get("is_fh") is True

    active_segments = []
    if rrh_active:
        active_segments.append("rrh_sans_plot" if resolve_sans_plot(input_data, kind="rrh") else "rrh")
    elif rru_active:
        active_segments.append("rru_sans_plot" if resolve_sans_plot(input_data, kind="rru") else "rru")

    if fh_active:
        active_segments.append("fh_sans_plot" if resolve_sans_plot(input_data, kind="fh") else "fh")

    if active_segments:
        joined = "_and_".join(active_segments)
        return f"antenna_with_{joined}" if has_antenna else joined

    type_str = f"{input_data.get('type_support', '')} {input_data.get('type', '')}".lower()
    if "fh" in type_str or "faisceau" in type_str:
        return "fh_sans_plot" if resolve_sans_plot(input_data, kind="fh") else "fh"
    if "rru" in type_str:
        return "rru_sans_plot" if resolve_sans_plot(input_data, kind="rru") else "rru"
    if "rrh" in type_str:
        return "rrh_sans_plot" if resolve_sans_plot(input_data, kind="rrh") else "rrh"

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
    if normalized_type.startswith("antenna") or antenna_4g or antenna_5g or has_antenna:
        canonical["antenna_4g"] = _normalize(antenna_4g)
        canonical["antenna_5g"] = _normalize(antenna_5g)
        canonical["structure"]["structure_case"] = normalize_structure_case(
            structure.get("structure_case") or data.get("structure_case")
        )

    # 1. Base Antenna mast height in structure
    if has_antenna and "hauteur_mat_m" in structure and structure["hauteur_mat_m"] is not None:
        try:
            canonical["structure"]["hauteur_mat_m"] = round(float(structure["hauteur_mat_m"]), 3)
        except (ValueError, TypeError):
            pass

    # 2. Per-equipment mast heights & plot settings for every enabled equipment (RRH, RRU, FH, and future <kind>_equipment)
    active_equipments = []
    equipment_keys = list(dict.fromkeys(
        ["rrh_equipment", "rru_equipment", "fh_equipment"]
        + [k for k in sorted(data.keys()) if str(k).endswith("_equipment") and str(k) not in ("td_equipment", "tgbt_equipment")]
    ))
    for eq_key in equipment_keys:
        eq_blk = data.get(eq_key)
        if isinstance(eq_blk, dict) and eq_blk.get("enabled"):
            eq_copy = dict(eq_blk)
            kind = eq_key.replace("_equipment", "")
            active_equipments.append(kind)
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
            is_kind_sp = resolve_sans_plot(data, calc_type=normalized_type, kind=kind)
            eq_copy["sans_plot"] = is_kind_sp
            eq_copy["with_plot"] = not is_kind_sp
            if kind == "fh":
                try:
                    fh_h_val = float(eq_copy.get("hauteur_mat_m")) if eq_copy.get("hauteur_mat_m") is not None else 1.70
                except (ValueError, TypeError):
                    fh_h_val = 1.70
                if is_kind_sp or fh_h_val < 2.0:
                    eq_copy["echelle"] = "Pas d'échelle"
            canonical[eq_key] = _normalize(eq_copy)
            sub_struct_key = f"structure_{kind}"
            if sub_struct_key in data and isinstance(data[sub_struct_key], dict):
                canonical[sub_struct_key] = _normalize(data[sub_struct_key])

    if "structure_fh" in data and isinstance(data["structure_fh"], dict):
        canonical["structure_fh"] = _normalize(data["structure_fh"])

    if len(active_equipments) == 1:
        single_kind = active_equipments[0]
        if resolve_sans_plot(data, calc_type=normalized_type, kind=single_kind):
            canonical["sans_plot"] = True
    elif not active_equipments:
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

