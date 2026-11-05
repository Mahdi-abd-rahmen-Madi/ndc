import json
import hashlib
from typing import Dict, Any

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
    if input_data.get("is_rrh") is True:
        return "rrh"
    type_str = f"{input_data.get('type_support', '')} {input_data.get('type', '')}".lower()
    if "rrh" in type_str:
        return "rrh"
    eq = input_data.get("equipment")
    if eq and isinstance(eq, dict):
        if "rrh" in str(eq.get("model", "")).lower():
            return "rrh"
        if "antenna_4g" not in input_data and "antenna_5g" not in input_data:
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

    if normalized_type == "rrh" or equipment:
        canonical["equipment"] = _normalize(equipment)
    if normalized_type == "antenna" or antenna_4g or antenna_5g:
        canonical["antenna_4g"] = _normalize(antenna_4g)
        canonical["antenna_5g"] = _normalize(antenna_5g)

    if "deflection_limit" in data:
        canonical["deflection_limit"] = _normalize(data["deflection_limit"])

    canonical_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    sha = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    return f"ndc_{normalized_type}_{sha[:24]}"

