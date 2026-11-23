"""
Canonical domain constants and normalization helpers shared across `api`, `geodata`,
and `utils` to prevent drift between hashing, validation, views, and NDC generation.
"""
from typing import Any, Dict, Optional

# EC1 Wind Regions <-> Reference Wind Speed V_b0 (m/s)
WIND_REGION_VB0: Dict[int, int] = {
    1: 22,
    2: 24,
    3: 26,
    4: 28,
}

V_B0_TO_REGION: Dict[int, int] = {vb: reg for reg, vb in WIND_REGION_VB0.items()}

# Strict FH antenna diameters (mm) and aerodynamic wind drag coefficients (Cf = 1.0)
ALLOWED_FH_DIAMETERS = frozenset({300, 600, 900, 1200})
FH_DIAMETER_COEFFICIENTS: Dict[int, float] = {
    300: 0.03,
    600: 0.06,
    900: 0.09,
    1200: 1.2,
}

OPERATORS_WITHOUT_TD = frozenset({"bouygues", "orange"})

OPERATOR_ALIASES: Dict[str, str] = {
    "bytel": "bouygues",
    "bouygues telecom": "bouygues",
    "bouygues_telecom": "bouygues",
    "free mobile": "free",
    "free_mobile": "free",
}


def normalize_operator(raw: Optional[str], fallback_site: Optional[Dict[str, Any]] = None) -> str:
    """
    Return canonical lowercase operator slug (`bouygues`, `orange`, `free`, `sfr`, or `''`).
    Normalizes aliases such as `bytel` -> `bouygues`.
    """
    val = (raw or "").strip().lower()
    if not val and isinstance(fallback_site, dict):
        val = (fallback_site.get("operator") or fallback_site.get("operateur") or "").strip().lower()
    return OPERATOR_ALIASES.get(val, val)


def parse_json_dict(raw: Any) -> Dict[str, Any]:
    """Safely coerce a JSON string or dict into a dict (returns {} on invalid input)."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        import json
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def resolve_sans_plot(
    input_data: Optional[Dict[str, Any]] = None,
    result_data: Optional[Dict[str, Any]] = None,
    calc_type: Optional[str] = None,
    kind: Optional[str] = None,
) -> bool:
    """
    Canonical `sans_plot` resolution shared by `ndc_hash`, `api/views`, `api/services`,
    and `ndc_generator`.

    Rules:
    - Explicit True on per-equipment flags, nested structure, equipment sub-dict (`sans_plot` or inverted `with_plot`), or result_data wins.
    - Explicit False on per-equipment flags, nested structure, equipment sub-dict, or result_data wins.
    - Defaults to False (with plot) unless explicitly set to True (sans plot).
    - In multi-equipment payloads, checks per-equipment `<kind>_sans_plot` / `<kind>_with_plot` before falling back to top-level `sans_plot`.
    """
    inp = parse_json_dict(input_data)
    res = parse_json_dict(result_data)
    struct = inp.get("structure") if isinstance(inp.get("structure"), dict) else {}
    ct = str(
        calc_type
        or res.get("calculation_type")
        or inp.get("calculation_type")
        or ""
    ).lower().strip()
    eq_kind = (kind or ct).lower().strip()

    def _invert_bool(val):
        if val is True:
            return False
        if val is False:
            return True
        return None

    if eq_kind in ("fh", "fh_sans_plot") or (not kind and (inp.get("is_fh") is True or ct in ("fh", "fh_sans_plot", "antenna_with_fh", "antenna_with_fh_sans_plot"))):
        fh_eq = inp.get("fh_equipment") if isinstance(inp.get("fh_equipment"), dict) else {}
        fh_sub = res.get("fh") if isinstance(res.get("fh"), dict) else {}
        struct_fh = inp.get("structure_fh") if isinstance(inp.get("structure_fh"), dict) else {}
        for explicit in (
            res.get("fh_sans_plot"),
            _invert_bool(res.get("fh_with_plot")),
            fh_sub.get("sans_plot"),
            _invert_bool(fh_sub.get("with_plot")),
            fh_eq.get("sans_plot"),
            _invert_bool(fh_eq.get("with_plot")),
            inp.get("fh_sans_plot"),
            _invert_bool(inp.get("fh_with_plot")),
            struct_fh.get("sans_plot"),
            _invert_bool(struct_fh.get("with_plot")),
            inp.get("sans_plot"),
            struct.get("sans_plot"),
        ):
            if explicit is True:
                return True
            if explicit is False:
                return False
        return "fh_sans_plot" in ct or (ct in ("fh_sans_plot", "antenna_with_fh_sans_plot"))

    if eq_kind in ("rru", "rru_sans_plot") or (not kind and (inp.get("is_rru") is True or ct in ("rru", "rru_sans_plot", "antenna_with_rru", "antenna_with_rru_sans_plot"))):
        rru_eq = inp.get("rru_equipment") if isinstance(inp.get("rru_equipment"), dict) else {}
        rru_sub = res.get("rru") if isinstance(res.get("rru"), dict) else {}
        struct_rru = inp.get("structure_rru") if isinstance(inp.get("structure_rru"), dict) else {}
        for explicit in (
            res.get("rru_sans_plot"),
            _invert_bool(res.get("rru_with_plot")),
            rru_sub.get("sans_plot"),
            _invert_bool(rru_sub.get("with_plot")),
            rru_eq.get("sans_plot"),
            _invert_bool(rru_eq.get("with_plot")),
            inp.get("rru_sans_plot"),
            _invert_bool(inp.get("rru_with_plot")),
            struct_rru.get("sans_plot"),
            _invert_bool(struct_rru.get("with_plot")),
            inp.get("sans_plot"),
            struct.get("sans_plot"),
        ):
            if explicit is True:
                return True
            if explicit is False:
                return False
        return "rru_sans_plot" in ct

    rrh_eq = inp.get("rrh_equipment") if isinstance(inp.get("rrh_equipment"), dict) else {}
    rrh_sub = res.get("rrh") if isinstance(res.get("rrh"), dict) else {}
    struct_rrh = inp.get("structure_rrh") if isinstance(inp.get("structure_rrh"), dict) else {}
    for explicit in (
        res.get("rrh_sans_plot"),
        _invert_bool(res.get("rrh_with_plot")),
        rrh_sub.get("sans_plot"),
        _invert_bool(rrh_sub.get("with_plot")),
        rrh_eq.get("sans_plot"),
        _invert_bool(rrh_eq.get("with_plot")),
        inp.get("rrh_sans_plot"),
        _invert_bool(inp.get("rrh_with_plot")),
        struct_rrh.get("sans_plot"),
        _invert_bool(struct_rrh.get("with_plot")),
        res.get("sans_plot"),
        inp.get("sans_plot"),
        struct.get("sans_plot"),
    ):
        if explicit is True:
            return True
        if explicit is False:
            return False
    return "rrh_sans_plot" in ct or (eq_kind not in ("rrh", "rru", "fh") and "sans_plot" in ct)

