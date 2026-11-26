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

# Convertisseur MDEA (co-mounted on Boîtier de Lovage mast)
MDEA_CF_FRONT: float = 1.46
MDEA_CF_LAT: float = 1.12
MDEA_DEFAULT_H_MM: float = 338.0
MDEA_DEFAULT_W_MM: float = 295.0
MDEA_DEFAULT_D_MM: float = 140.0
MDEA_DEFAULT_DIMENSIONS_STR: str = "338 x 295 x 140"
MDEA_DEFAULT_WEIGHT_KG: float = 10.0

# Antenne GPS (co-mounted on Boîtier de Lovage mast; negligible weight & wind load)
GPS_REFERENCE_SPECS: Dict[str, Dict[str, Any]] = {
    "FYGC 474074A": {"marque": "NOKIA", "dimensions": "Ø95 x 72.5", "weight_kg": 0.154},
    "FYGB 472748A": {"marque": "NOKIA", "dimensions": "Ø95 x 72.5", "weight_kg": 0.154},
    "KRE 101 2395/2": {"marque": "ERICSSON", "dimensions": "Ø78", "weight_kg": 0.225},
}

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

    k = (kind or "fh").lower().strip()
    if k in ("lovage", "boitier_lovage"):
        return False

    inp = parse_json_dict(input_data)
    res = parse_json_dict(result_data)
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


def _parse_dims_triplet_mm(raw_dims: Any) -> Optional[tuple]:
    if not raw_dims or not isinstance(raw_dims, str):
        return None
    import re
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*[*x×]\s*(\d+(?:[.,]\d+)?)\s*[*x×]\s*(\d+(?:[.,]\d+)?)", raw_dims)
    if not m:
        return None
    try:
        return (
            float(m.group(1).replace(",", ".")),
            float(m.group(2).replace(",", ".")),
            float(m.group(3).replace(",", ".")),
        )
    except (ValueError, TypeError):
        return None


def resolve_lovage_comounts(
    input_data: Optional[Dict[str, Any]] = None,
    result_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Resolve co-mounted Antenne GPS and Convertisseur MDEA installed on the
    Boîtier de Lovage mast from worker result_data and/or frontend input_data.
    """
    inp = parse_json_dict(input_data)
    res = parse_json_dict(result_data)

    lovage_in = inp.get("boitier_lovage") if isinstance(inp.get("boitier_lovage"), dict) else {}
    if not lovage_in and isinstance(inp.get("lovage_equipment"), dict):
        lovage_in = inp.get("lovage_equipment")
    lovage_sub = res.get("lovage") if isinstance(res.get("lovage"), dict) else {}

    # 1. Resolve Antenne GPS co-mount
    gps_in_nested = lovage_in.get("gps") if isinstance(lovage_in.get("gps"), dict) else {}
    gps_in_top = inp.get("gps") if isinstance(inp.get("gps"), dict) else {}
    gps_res = (
        res.get("lovage_gps")
        if isinstance(res.get("lovage_gps"), dict)
        else (lovage_sub.get("gps") if isinstance(lovage_sub.get("gps"), dict) else {})
    )

    has_gps = False
    for candidate in (
        lovage_sub.get("has_gps"),
        res.get("lovage_has_gps"),
        lovage_in.get("has_gps"),
        gps_in_nested.get("enabled") if gps_in_nested else None,
        gps_in_top.get("enabled") if gps_in_top else None,
    ):
        if isinstance(candidate, bool):
            has_gps = candidate
            break
    else:
        has_gps = bool(gps_res)

    gps_dict = None
    if has_gps:
        gps_src = {**gps_in_top, **gps_in_nested, **gps_res}
        ref = str(gps_src.get("reference") or "").strip()
        spec = GPS_REFERENCE_SPECS.get(ref)
        if spec is None and ref:
            ref_low = ref.lower()
            for k, v in GPS_REFERENCE_SPECS.items():
                if k.lower() == ref_low:
                    spec = v
                    break
        marque = str(gps_src.get("marque") or (spec.get("marque") if spec else "") or "").strip() or None
        dims_raw = gps_src.get("dimensions") or gps_src.get("dimensions_str") or (spec.get("dimensions") if spec else None)
        dims_clean = str(dims_raw).strip() if dims_raw and str(dims_raw).strip().lower() not in ("none", "n/a") else None
        dims_str = dims_clean if dims_clean else "N/A"
        raw_w = (
            gps_src.get("weight_kg")
            if gps_src.get("weight_kg") is not None
            else (
                gps_src.get("poids_kg")
                if gps_src.get("poids_kg") is not None
                else (spec.get("weight_kg") if spec else 0.0)
            )
        )
        try:
            gps_weight_kg = float(raw_w) if raw_w is not None else 0.0
        except (ValueError, TypeError):
            gps_weight_kg = 0.0
        try:
            gps_qty = max(1, int(gps_src.get("quantity") or gps_src.get("qty") or 1))
        except (ValueError, TypeError):
            gps_qty = 1
        gps_dict = {
            "enabled": True,
            "quantity": gps_qty,
            "marque": marque,
            "reference": ref or None,
            "dimensions": dims_clean,
            "dimensions_str": dims_str,
            "weight_kg": gps_weight_kg,
        }

    # 2. Resolve Convertisseur MDEA co-mount
    mdea_in_nested = lovage_in.get("mdea") if isinstance(lovage_in.get("mdea"), dict) else {}
    mdea_in_top = inp.get("convertisseur_mdea") if isinstance(inp.get("convertisseur_mdea"), dict) else {}
    mdea_res = (
        res.get("lovage_mdea")
        if isinstance(res.get("lovage_mdea"), dict)
        else (lovage_sub.get("mdea") if isinstance(lovage_sub.get("mdea"), dict) else {})
    )

    has_mdea = False
    for candidate in (
        lovage_sub.get("has_mdea"),
        res.get("lovage_has_mdea"),
        lovage_in.get("has_mdea"),
        mdea_in_nested.get("enabled") if mdea_in_nested else None,
        mdea_in_top.get("enabled") if mdea_in_top else None,
    ):
        if isinstance(candidate, bool):
            has_mdea = candidate
            break
    else:
        has_mdea = bool(mdea_res)

    op = normalize_operator(inp.get("operateur") or inp.get("operator"), fallback_site=inp.get("site"))
    if op and op != "free" and has_mdea:
        explicit_mdea = (
            lovage_sub.get("has_mdea")
            if isinstance(lovage_sub.get("has_mdea"), bool)
            else (
                res.get("lovage_has_mdea")
                if isinstance(res.get("lovage_has_mdea"), bool)
                else (
                    lovage_in.get("has_mdea")
                    if isinstance(lovage_in.get("has_mdea"), bool)
                    else (
                        mdea_in_nested.get("enabled")
                        if isinstance(mdea_in_nested.get("enabled"), bool)
                        else (True if mdea_res else None)
                    )
                )
            )
        )
        if explicit_mdea is not True:
            has_mdea = False

    mdea_dict = None
    if has_mdea:
        mdea_src = {**mdea_in_top, **mdea_in_nested, **mdea_res}
        raw_qty = (
            mdea_src.get("quantity")
            if mdea_src.get("quantity") is not None
            else (
                mdea_src.get("qty")
                if mdea_src.get("qty") is not None
                else mdea_src.get("quantite")
            )
        )
        try:
            mdea_qty = max(1, int(raw_qty)) if raw_qty is not None else 1
        except (ValueError, TypeError):
            mdea_qty = 1

        parsed_dims = _parse_dims_triplet_mm(mdea_src.get("dimensions") or mdea_src.get("dimensions_str"))
        raw_h = mdea_src.get("h_mm") if mdea_src.get("h_mm") is not None else mdea_src.get("hauteur_mm")
        raw_w = mdea_src.get("w_mm") if mdea_src.get("w_mm") is not None else mdea_src.get("largeur_mm")
        raw_d = (
            mdea_src.get("d_mm")
            if mdea_src.get("d_mm") is not None
            else (mdea_src.get("epaisseur_mm") if mdea_src.get("epaisseur_mm") is not None else mdea_src.get("t_mm"))
        )
        try:
            h_mm = float(raw_h) if raw_h is not None else (parsed_dims[0] if parsed_dims else MDEA_DEFAULT_H_MM)
        except (ValueError, TypeError):
            h_mm = parsed_dims[0] if parsed_dims else MDEA_DEFAULT_H_MM
        try:
            w_mm = float(raw_w) if raw_w is not None else (parsed_dims[1] if parsed_dims else MDEA_DEFAULT_W_MM)
        except (ValueError, TypeError):
            w_mm = parsed_dims[1] if parsed_dims else MDEA_DEFAULT_W_MM
        try:
            d_mm = float(raw_d) if raw_d is not None else (parsed_dims[2] if parsed_dims else MDEA_DEFAULT_D_MM)
        except (ValueError, TypeError):
            d_mm = parsed_dims[2] if parsed_dims else MDEA_DEFAULT_D_MM

        raw_weight = (
            mdea_src.get("weight_kg")
            if mdea_src.get("weight_kg") is not None
            else (mdea_src.get("poids_kg") if mdea_src.get("poids_kg") is not None else mdea_src.get("poids"))
        )
        try:
            mdea_weight_kg = float(raw_weight) if raw_weight is not None else MDEA_DEFAULT_WEIGHT_KG
        except (ValueError, TypeError):
            mdea_weight_kg = MDEA_DEFAULT_WEIGHT_KG

        try:
            cf_front = float(mdea_src.get("cf_front")) if mdea_src.get("cf_front") is not None else MDEA_CF_FRONT
        except (ValueError, TypeError):
            cf_front = MDEA_CF_FRONT
        try:
            cf_lat = float(mdea_src.get("cf_lat")) if mdea_src.get("cf_lat") is not None else MDEA_CF_LAT
        except (ValueError, TypeError):
            cf_lat = MDEA_CF_LAT

        mdea_dict = {
            "enabled": True,
            "quantity": mdea_qty,
            "h_mm": h_mm,
            "w_mm": w_mm,
            "d_mm": d_mm,
            "dimensions_str": f"{h_mm:g} x {w_mm:g} x {d_mm:g}",
            "weight_kg": mdea_weight_kg,
            "cf_front": cf_front,
            "cf_lat": cf_lat,
        }

    if has_gps and has_mdea:
        variant = "lovage_gps_mdea"
    elif has_gps:
        variant = "lovage_gps"
    elif has_mdea:
        variant = "lovage_mdea"
    else:
        variant = "lovage"

    return {
        "has_gps": has_gps,
        "has_mdea": has_mdea,
        "variant": variant,
        "gps": gps_dict,
        "mdea": mdea_dict,
    }

