import math
from rest_framework.exceptions import ValidationError

MAST_HEIGHT_MIN_M = 0.5
MAST_HEIGHT_MAX_M = 6.0

EQUIPMENT_BLOCKS = ("rrh_equipment", "rru_equipment", "fh_equipment")
# Add any future "<kind>_equipment" keys here.


def validate_hauteur_mat_m(value, field_label: str) -> float:
    if value is None or isinstance(value, bool) or str(value).strip() == "":
        raise ValidationError({
            field_label: f"hauteur_mat_m est obligatoire ({MAST_HEIGHT_MIN_M} m à {MAST_HEIGHT_MAX_M} m)."
        })
    try:
        h = float(value)
    except (TypeError, ValueError):
        raise ValidationError({
            field_label: f"hauteur_mat_m invalide ({value!r}). Doit être un nombre."
        })
    if not math.isfinite(h) or h < MAST_HEIGHT_MIN_M or h > MAST_HEIGHT_MAX_M:
        raise ValidationError({
            field_label: f"hauteur_mat_m doit être compris entre {MAST_HEIGHT_MIN_M} m et {MAST_HEIGHT_MAX_M} m."
        })
    return h


def validate_calculation_mast_heights(input_data: dict) -> None:
    """Call before dispatching input_data to the Robot worker."""
    # 1. Base Antenna (if present)
    has_antenna = bool(input_data.get("antenna_4g") or input_data.get("antenna_5g"))
    if has_antenna:
        structure = input_data.get("structure") or {}
        validate_hauteur_mat_m(structure.get("hauteur_mat_m"), "structure.hauteur_mat_m")

    # 2. Every enabled equipment block (RRH, RRU, FH, and future equipments)
    for eq_key in EQUIPMENT_BLOCKS:
        eq_blk = input_data.get(eq_key)
        if not isinstance(eq_blk, dict) or not eq_blk.get("enabled"):
            continue
        # Canonical location: <kind>_equipment.hauteur_mat_m
        kind = eq_key.replace("_equipment", "")
        sub_struct = input_data.get(f"structure_{kind}") or {}
        raw_h = eq_blk.get("hauteur_mat_m")
        if raw_h is None:
            raw_h = sub_struct.get("hauteur_mat_m")
        if raw_h is None and not has_antenna:
            raw_h = (input_data.get("structure") or {}).get("hauteur_mat_m")

        h_val = validate_hauteur_mat_m(raw_h, f"{eq_key}.hauteur_mat_m")
        # Normalize into canonical location before sending to worker
        eq_blk["hauteur_mat_m"] = h_val

    # 3. Zone Technique: Boîtier de lovage (defaults to 1.50 m if omitted by legacy clients)
    lovage_blk = input_data.get("boitier_lovage") or input_data.get("lovage_equipment")
    if isinstance(lovage_blk, dict) and lovage_blk.get("enabled"):
        sub_struct = input_data.get("structure_lovage") or {}
        raw_h = lovage_blk.get("hauteur_mat_m")
        if raw_h is None:
            raw_h = sub_struct.get("hauteur_mat_m")
        if raw_h is None:
            raw_h = 1.50
        h_val = validate_hauteur_mat_m(raw_h, "boitier_lovage.hauteur_mat_m")
        lovage_blk["hauteur_mat_m"] = h_val


def get_support_mast_height_m(result_data: dict, kind: str, fallback_h: float = None) -> float:
    """
    Extracts support mast height from result_data:
    - result_data.<kind>.structure_params.hauteur_mat_m (composite jobs)
    - result_data.structure_params.hauteur_mat_m (standalone jobs)
    """
    res = result_data if isinstance(result_data, dict) else {}
    sub = res.get(kind) if isinstance(res.get(kind), dict) else {}
    sp = sub.get("structure_params") or res.get("structure_params") or {}
    h = sp.get("hauteur_mat_m")
    if h is not None:
        try:
            return float(h)
        except (ValueError, TypeError):
            pass
    if fallback_h is not None:
        try:
            return float(fallback_h)
        except (ValueError, TypeError):
            pass
    return 1.5 if kind in ("rrh", "rru", "lovage", "boitier_lovage") else 1.7
