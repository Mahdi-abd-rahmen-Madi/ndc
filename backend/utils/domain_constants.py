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

# Boîtier de Lovage (Zone Technique) aerodynamic wind drag coefficients & structural defaults
LOVAGE_CF_FRONT: float = 1.47
LOVAGE_CF_LAT: float = 1.19
LOVAGE_DEFAULT_MAST_SECTION: str = "TRON 88x3.2"
LOVAGE_DEFAULT_PLOT_SECTION: str = "TCAR 150x5"
LOVAGE_DEFAULT_MAST_HEIGHT_M: float = 1.50
LOVAGE_DEFAULT_PLOT_HEIGHT_M: float = 0.50

OPERATORS_WITHOUT_TD = frozenset({"bouygues", "orange"})

OPERATOR_ALIASES: Dict[str, str] = {
    "bytel": "bouygues",
    "bouygues telecom": "bouygues",
    "bouygues_telecom": "bouygues",
    "free mobile": "free",
    "free_mobile": "free",
}

# Canonical antenna structure cases (Cas 1 to Cas 4)
STRUCTURE_CASES = ("cas1", "cas2", "cas3", "cas4")
DEFAULT_STRUCTURE_CASE = "cas1"
STRUCTURE_CASE_ALIASES: Dict[str, str] = {
    "cas1": "cas1", "cas 1": "cas1", "cas_1": "cas1", "cas-1": "cas1", "c1": "cas1", "a1": "cas1", "1": "cas1",
    "cas2": "cas2", "cas 2": "cas2", "cas_2": "cas2", "cas-2": "cas2", "c2": "cas2", "a2": "cas2", "2": "cas2",
    "cas3": "cas3", "cas 3": "cas3", "cas_3": "cas3", "cas-3": "cas3", "c3": "cas3", "a3": "cas3", "3": "cas3",
    "cas4": "cas4", "cas 4": "cas4", "cas_4": "cas4", "cas-4": "cas4", "c4": "cas4", "a4": "cas4", "4": "cas4",
}


def normalize_structure_case(
    raw: Any = None,
    fallback_structure: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Return canonical structure case slug (`cas1`, `cas2`, `cas3`, or `cas4`).
    Normalizes legacy aliases (e.g. `A1`, `C1`, `Cas 1`) and defaults missing/blank
    values to `cas1` for backward compatibility.
    """
    val = raw
    if (val is None or str(val).strip() == "") and isinstance(fallback_structure, dict):
        val = fallback_structure.get("structure_case")
    if val is None:
        return DEFAULT_STRUCTURE_CASE
    cleaned = str(val).strip().lower()
    if not cleaned:
        return DEFAULT_STRUCTURE_CASE
    return STRUCTURE_CASE_ALIASES.get(cleaned, cleaned)


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

    def _from_ancrage(val):
        if not val:
            return None
        norm = str(val).strip().lower()
        if norm == "dallettes":
            return True
        if norm in ("beton", "metallique"):
            return False
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
            _from_ancrage(fh_eq.get("ancrage")),
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

    if eq_kind in ("lovage", "lovage_sans_plot", "boitier_lovage", "boitier_lovage_sans_plot") or (
        not kind
        and (
            inp.get("is_lovage") is True
            or ct in ("lovage", "lovage_sans_plot", "antenna_with_lovage", "antenna_with_lovage_sans_plot")
        )
    ):
        lovage_eq = inp.get("boitier_lovage") if isinstance(inp.get("boitier_lovage"), dict) else {}
        if not lovage_eq and isinstance(inp.get("lovage_equipment"), dict):
            lovage_eq = inp.get("lovage_equipment")
        lovage_sub = res.get("lovage") if isinstance(res.get("lovage"), dict) else {}
        struct_lovage = inp.get("structure_lovage") if isinstance(inp.get("structure_lovage"), dict) else {}
        for explicit in (
            res.get("lovage_sans_plot"),
            _invert_bool(res.get("lovage_with_plot")),
            lovage_sub.get("sans_plot"),
            _invert_bool(lovage_sub.get("with_plot")),
            lovage_eq.get("sans_plot"),
            _invert_bool(lovage_eq.get("with_plot")),
            _from_ancrage(lovage_eq.get("ancrage")),
            inp.get("lovage_sans_plot"),
            _invert_bool(inp.get("lovage_with_plot")),
            struct_lovage.get("sans_plot"),
            _invert_bool(struct_lovage.get("with_plot")),
            inp.get("sans_plot"),
            struct.get("sans_plot"),
        ):
            if explicit is True:
                return True
            if explicit is False:
                return False
        return "lovage_sans_plot" in ct

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
            _from_ancrage(rru_eq.get("ancrage")),
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
        _from_ancrage(rrh_eq.get("ancrage")),
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
    return "rrh_sans_plot" in ct or (eq_kind not in ("rrh", "rru", "fh", "lovage") and "sans_plot" in ct)


def resolve_support_has_echelle(
    input_data: Optional[Dict[str, Any]] = None,
    result_data: Optional[Dict[str, Any]] = None,
    kind: str = "fh",
    is_sans_plot: bool = False,
    hauteur_mat_m: Optional[float] = None,
) -> bool:
    """
    Canonical ladder (echelle) resolution for auxiliary supports (FH, RRH, RRU, Boîtier de Lovage).
    Allowed ONLY when WITH plot (is_sans_plot == False) AND hauteur_mat_m >= 2.0 m.
    Never reads main antenna `structure.echelle`.
    """
    if is_sans_plot:
        return False

    inp = parse_json_dict(input_data)
    res = parse_json_dict(result_data)
    k = (kind or "fh").lower().strip()
    eq_key = "boitier_lovage" if k in ("lovage", "boitier_lovage") else f"{k}_equipment"
    sub_key = "lovage" if k in ("lovage", "boitier_lovage") else k
    struct_key = f"structure_{sub_key}"

    eq_in = inp.get(eq_key) if isinstance(inp.get(eq_key), dict) else {}
    if not eq_in and sub_key == "lovage" and isinstance(inp.get("lovage_equipment"), dict):
        eq_in = inp.get("lovage_equipment")
    sub_res = res.get(sub_key) if isinstance(res.get(sub_key), dict) else {}
    struct_in = inp.get(struct_key) if isinstance(inp.get(struct_key), dict) else {}

    default_h = 1.70 if sub_key == "fh" else 1.50
    raw_h = hauteur_mat_m
    if raw_h is None:
        raw_h = eq_in.get("hauteur_mat_m")
    if raw_h is None:
        raw_h = struct_in.get("hauteur_mat_m")
    try:
        h_num = float(raw_h) if raw_h is not None else default_h
    except (ValueError, TypeError):
        h_num = default_h
    if h_num < 2.0:
        return False

    raw = (
        eq_in.get("echelle")
        if eq_in.get("echelle") is not None
        else (
            sub_res.get("echelle")
            if sub_res.get("echelle") is not None
            else (
                res.get(f"{sub_key}_echelle")
                if res.get(f"{sub_key}_echelle") is not None
                else struct_in.get("echelle")
            )
        )
    )
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        norm = raw.strip().lower()
        return (
            bool(norm)
            and "pas d'echelle" not in norm
            and "pas d'échelle" not in norm
            and norm not in ("non", "none", "false", "0")
        )
    return False

