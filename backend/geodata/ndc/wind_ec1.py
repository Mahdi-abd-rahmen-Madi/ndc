"""EC1 (EN 1991-1-4) wind parameter calculations and structural section parsing."""
import math
import re

# z0 roughness lengths (m) per terrain category
# Keys match the canonical frontend/DB values: '0', 'II', 'IIIa', 'IIIb', 'IV'
TERRAIN_Z0 = {
    '0': 0.003,
    'II': 0.05,
    'IIIa': 0.2,
    'IIIb': 0.5,
    'IV': 1.0,
}

# Reference terrain is always Terrain II
Z0_II = 0.05

# Air density (kg/m^3) -- standard EN 1991-1-4 value
RHO_AIR = 1.25


def _to_float(val) -> float:
    """Safely convert numeric inputs to float, returning 0.0 for placeholders or blanks."""
    if val is None or val == '':
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def compute_wind_z(h_bat, h_mat, h_plot=0.0, sans_plot: bool = False) -> float:
    """
    Compute exact EC1 reference height z (m):
    - sans_plot=True:  z = h_bat + h_mat
    - sans_plot=False: z = h_bat + h_mat + h_plot
    """
    hb = _to_float(h_bat)
    hm = _to_float(h_mat)
    hp = 0.0 if sans_plot else _to_float(h_plot)
    return hb + hm + hp


def _parse_section_dimensions(section_str):
    """Extract (dim1, dim2) from section strings like 'TRON 139x6.3' or 'TCAR 200x5'."""
    if section_str:
        match = re.search(r'(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)', str(section_str))
        if match:
            return match.group(1), match.group(2)
    return None, None


def _parse_envelope_dims_m(env_str: str):
    """Parse '600*500*200' or '600*500*200mm' into (h_m, w_m, d_m)."""
    if not env_str:
        return None
    m = re.search(r'(\d+(?:\.\d+)?)\s*[*xX]\s*(\d+(?:\.\d+)?)\s*[*xX]\s*(\d+(?:\.\d+)?)', str(env_str))
    if not m:
        return None
    return float(m.group(1)) / 1000.0, float(m.group(2)) / 1000.0, float(m.group(3)) / 1000.0


def calculate_wind_params(terrain_type: str, z_total: float, vb: float) -> dict:
    """
    Compute the EC1 wind chain for a given terrain category, total height z,
    and reference wind speed Vb (without z_min clamping).
    """
    z0 = TERRAIN_Z0.get(terrain_type, TERRAIN_Z0['IIIa'])
    z_used = float(z_total)
    if z_used <= z0:
        raise ValueError(
            f"z_total ({z_used}) must be greater than z0 ({z0}) for terrain '{terrain_type}'"
        )

    # kr -- terrain roughness factor (EC1 eq. 4.5)
    kr = 0.19 * (z0 / Z0_II) ** 0.07

    # cr(z) -- roughness coefficient (EC1 eq. 4.4)
    cr_z = kr * math.log(z_used / z0)

    # c0 = 1.0 (flat terrain, no orography correction)
    c0 = 1.0

    # Vm -- mean wind speed (EC1 eq. 4.3)
    vm = cr_z * c0 * vb

    # Iv(z) -- turbulence intensity (EC1 eq. 4.7, kI=1, c0=1)
    iv_z = 1.0 / math.log(z_used / z0)

    # qp(z) -- peak velocity pressure in Pa (EC1 eq. 4.8)
    qp_pa = (1 + 7 * iv_z) * 0.5 * RHO_AIR * vm ** 2

    # Convert Pa -> daN/m^2 (1 daN/m^2 = 10 Pa)
    qp_dan = qp_pa / 10.0

    return {
        'kr': round(kr, 2),
        'cr_z': round(cr_z, 2),
        'vm': round(vm, 2),
        'iv_z': round(iv_z, 2),
        'qp_pa': round(qp_pa, 2),
        'qp_dan': round(qp_dan, 2),
        'z_used': round(z_used, 2),
    }


def _first_non_none(*vals):
    """Return the first value that is not None."""
    for v in vals:
        if v is not None:
            return v
    return None


def _is_non_placeholder(val) -> bool:
    """Return True if val is present and not a template bracket placeholder like '[VAR_23]'."""
    if val is None:
        return False
    if isinstance(val, str):
        s = val.strip()
        return bool(s) and not (s.startswith('[') and s.endswith(']'))
    return True


def get_antenna_wind(result_data: dict) -> dict:
    """Return Robot-computed wind dictionary for the Base Antenna stage."""
    if not isinstance(result_data, dict):
        return {}
    wind = result_data.get("wind")
    return wind if isinstance(wind, dict) else {}


def get_support_wind(result_data: dict, kind: str) -> dict:
    """
    Return Robot-computed `wind_params` for a support module
    (`kind` in {'rrh', 'rru', 'fh', 'lovage'}), handling both composite
    and standalone result payloads.
    """
    if not isinstance(result_data, dict):
        return {}
    kind = str(kind or "").lower()
    sub = result_data.get(kind)
    sub_wind = sub.get("wind_params") if isinstance(sub, dict) else None
    kind_wind = result_data.get(f"{kind}_wind_params")
    top_wind = result_data.get("wind_params")
    if isinstance(kind_wind, dict) and kind_wind:
        return kind_wind
    if isinstance(sub_wind, dict) and sub_wind:
        return sub_wind
    if isinstance(top_wind, dict) and top_wind:
        return top_wind
    return {}


def get_support_structure_params(result_data: dict, kind: str) -> dict:
    """Return Robot-resolved `structure_params` for a support module."""
    if not isinstance(result_data, dict):
        return {}
    kind = str(kind or "").lower()
    sub = result_data.get(kind)
    if isinstance(sub, dict) and isinstance(sub.get("structure_params"), dict) and sub["structure_params"]:
        return sub["structure_params"]
    top_struct = result_data.get("structure_params")
    return top_struct if isinstance(top_struct, dict) else {}


def resolve_antenna_wind_params(
    result_data,
    env: dict,
    mast_height_m,
    vb,
    structure_data: dict = None,
    active_data: dict = None,
) -> dict:
    """
    Resolve Base Antenna EC1 wind parameters treating Robot's `result_data["wind"]`
    (and `result_data["ndc_vars"]`) as the single source of truth, falling back to
    local calculation only for legacy historical jobs, previews, or fast-track.
    """
    res = result_data if isinstance(result_data, dict) else {}
    env = env if isinstance(env, dict) else {}
    structure_data = structure_data if isinstance(structure_data, dict) else {}
    active_data = active_data if isinstance(active_data, dict) else {}

    worker_wind = get_antenna_wind(res)
    ndc_vars = res.get("ndc_vars") if isinstance(res.get("ndc_vars"), dict) else {}

    has_worker_wind = any(
        worker_wind.get(k) is not None
        for k in ("qp_dan_m2", "qp_dan", "cr", "cr_z", "vm", "vm_z")
    )
    if has_worker_wind:
        z_total = _first_non_none(worker_wind.get("z_ref_m"), worker_wind.get("z_ref"), ndc_vars.get("var_14"))
        vb_m_s = _first_non_none(
            worker_wind.get("vb0"),
            worker_wind.get("v_b0"),
            ndc_vars.get("var_15"),
            ndc_vars.get("var_20"),
            vb,
        )
        kr_z = _first_non_none(worker_wind.get("kr"), worker_wind.get("kr_z"), ndc_vars.get("var_16"))
        cr_z = _first_non_none(
            worker_wind.get("cr"),
            worker_wind.get("cr_z"),
            ndc_vars.get("var_17"),
            ndc_vars.get("var_18"),
        )
        vm_z = _first_non_none(worker_wind.get("vm"), worker_wind.get("vm_z"), ndc_vars.get("var_21"))
        iv_z = _first_non_none(worker_wind.get("iv"), worker_wind.get("iv_z"), ndc_vars.get("var_22"))
        qp_z = _first_non_none(worker_wind.get("qp_dan_m2"), worker_wind.get("qp_dan"), ndc_vars.get("var_23"))

        return {
            "source": "worker",
            "z_total": z_total if z_total is not None else "[z]",
            "vb_m_s": vb_m_s,
            "kr_z": kr_z if kr_z is not None else "[kr]",
            "cr_z": cr_z if cr_z is not None else "[cr(z)]",
            "vm_z": vm_z if vm_z is not None else "[Vm]",
            "iv_z": iv_z if iv_z is not None else "[Iv(z)]",
            "qp_z": qp_z if qp_z is not None else "[qp]",
            "fw_mast": _first_non_none(worker_wind.get("fw_mast_dan_m"), worker_wind.get("fw_mast"), ndc_vars.get("var_26")),
            "fw_4g_front": _first_non_none(worker_wind.get("fw_4g_front_dan"), ndc_vars.get("var_30")),
            "fw_4g_lat": _first_non_none(worker_wind.get("fw_4g_lat_dan"), ndc_vars.get("var_34")),
            "fw_5g_front": _first_non_none(worker_wind.get("fw_5g_front_dan"), ndc_vars.get("var_38")),
            "fw_5g_lat": _first_non_none(worker_wind.get("fw_5g_lat_dan"), ndc_vars.get("var_42")),
        }

    var_cr = _first_non_none(ndc_vars.get("var_17"), ndc_vars.get("var_18"))
    var_qp = ndc_vars.get("var_23")
    if _is_non_placeholder(var_qp) and _is_non_placeholder(var_cr):
        z_total = ndc_vars.get("var_14")
        vb_m_s = _first_non_none(ndc_vars.get("var_15"), ndc_vars.get("var_20"), vb)
        kr_z = ndc_vars.get("var_16")
        vm_z = ndc_vars.get("var_21")
        iv_z = ndc_vars.get("var_22")
        return {
            "source": "worker_ndc_vars",
            "z_total": z_total if _is_non_placeholder(z_total) else "[z]",
            "vb_m_s": vb_m_s if _is_non_placeholder(vb_m_s) else vb,
            "kr_z": kr_z if _is_non_placeholder(kr_z) else "[kr]",
            "cr_z": var_cr,
            "vm_z": vm_z if _is_non_placeholder(vm_z) else "[Vm]",
            "iv_z": iv_z if _is_non_placeholder(iv_z) else "[Iv(z)]",
            "qp_z": var_qp,
            "fw_mast": ndc_vars.get("var_26") if _is_non_placeholder(ndc_vars.get("var_26")) else None,
            "fw_4g_front": ndc_vars.get("var_30") if _is_non_placeholder(ndc_vars.get("var_30")) else None,
            "fw_4g_lat": ndc_vars.get("var_34") if _is_non_placeholder(ndc_vars.get("var_34")) else None,
            "fw_5g_front": ndc_vars.get("var_38") if _is_non_placeholder(ndc_vars.get("var_38")) else None,
            "fw_5g_lat": ndc_vars.get("var_42") if _is_non_placeholder(ndc_vars.get("var_42")) else None,
        }

    # Fallback for legacy jobs, fast-track, and template previews
    terrain_type_str = str(env.get("terrain_type") or "IIIa")
    is_antenna_sans_plot = bool(
        structure_data.get("sans_plot") is True
        or structure_data.get("with_plot") is False
        or active_data.get("sans_plot") is True
        or active_data.get("with_plot") is False
    )
    h_plot_raw = (
        env.get("plot_height_m")
        if env.get("plot_height_m") is not None
        else (
            structure_data.get("plot_h_m")
            if structure_data.get("plot_h_m") is not None
            else structure_data.get("hauteur_plot_m")
        )
    )
    z_total = compute_wind_z(
        env.get("building_height_m"),
        mast_height_m,
        h_plot=h_plot_raw,
        sans_plot=is_antenna_sans_plot,
    )
    z0_val = TERRAIN_Z0.get(terrain_type_str, TERRAIN_Z0["IIIa"])
    if vb is not None and z_total > z0_val:
        wind = calculate_wind_params(terrain_type_str, z_total, float(vb))
        return {
            "source": "fallback",
            "z_total": wind["z_used"],
            "vb_m_s": vb,
            "kr_z": wind["kr"],
            "cr_z": wind["cr_z"],
            "vm_z": wind["vm"],
            "iv_z": wind["iv_z"],
            "qp_z": wind["qp_dan"],
        }

    return {
        "source": "fallback",
        "z_total": "[z]",
        "vb_m_s": vb,
        "kr_z": "[kr]",
        "cr_z": "[cr(z)]",
        "vm_z": "[Vm]",
        "iv_z": "[Iv(z)]",
        "qp_z": "[qp]",
    }


def _resolve_support_wind_params(
    wind_p: dict,
    context: dict,
    env: dict,
    vb,
    h_plot_m,
    h_mat_m,
    sans_plot: bool = False,
) -> dict:
    """Resolve EC1 wind chain for an auxiliary support (RRH, RRU, FH, or Lovage) consistently."""
    wind_p = wind_p if isinstance(wind_p, dict) else {}
    context = context if isinstance(context, dict) else {}
    env = env if isinstance(env, dict) else {}

    qp_z = wind_p.get('qp_dan') if wind_p.get('qp_dan') is not None else context.get('qp_z')
    cr_z = _first_non_none(wind_p.get('cr_z'), wind_p.get('cr'))
    vm_z = _first_non_none(wind_p.get('vm_z'), wind_p.get('vm'))
    iv_z = _first_non_none(wind_p.get('iv_z'), wind_p.get('iv'))
    kr_z = _first_non_none(wind_p.get('kr_z'), wind_p.get('kr'))
    z_ref = _first_non_none(wind_p.get('z_ref'), wind_p.get('z_ref_m'))

    raw_region = wind_p.get('region')
    if raw_region is not None:
        if isinstance(raw_region, (int, float)) or (isinstance(raw_region, str) and str(raw_region).isdigit()):
            region_str = f"Region {raw_region}"
        else:
            region_str = str(raw_region)
    else:
        region_str = context.get('region')

    terrain_type = str(wind_p.get('terrain_type') or context.get('terrain_type') or env.get('terrain_type') or 'IIIa')
    building_height = (
        wind_p.get('building_height_m')
        if wind_p.get('building_height_m') is not None
        else context.get('building_height')
    )
    vb_m_s = _first_non_none(
        wind_p.get('vb0_ms'),
        wind_p.get('v_b0'),
        wind_p.get('vb0'),
        context.get('vb_m_s'),
    )

    try:
        vb_num = (
            float(vb_m_s)
            if vb_m_s is not None and str(vb_m_s) != '[Vb]'
            else (float(vb) if vb is not None else None)
        )
    except (ValueError, TypeError):
        vb_num = float(vb) if vb is not None else None

    if cr_z is None:
        try:
            target_qp_dan = float(wind_p.get('qp_dan') or 0.0)
        except (ValueError, TypeError):
            target_qp_dan = 0.0

        if target_qp_dan > 0 and vb_num is not None and vb_num > 0:
            z0_val = TERRAIN_Z0.get(terrain_type, TERRAIN_Z0['IIIa'])
            kr_val = 0.19 * (z0_val / Z0_II) ** 0.07
            a_coeff = 0.5 * RHO_AIR * (vb_num ** 2) * (kr_val ** 2)
            qp_pa_target = target_qp_dan * 10.0
            disc = 49.0 + 4.0 * (qp_pa_target / a_coeff)
            if disc > 0:
                x_val = (-7.0 + math.sqrt(disc)) / 2.0
                cr_calc = kr_val * x_val
                vm_calc = cr_calc * 1.0 * vb_num
                iv_calc = 1.0 / x_val if x_val > 0 else 0.12
                cr_z = round(cr_calc, 2)
                vm_z = round(vm_calc, 2)
                iv_z = round(iv_calc, 2)
                kr_z = round(kr_val, 2)

    if cr_z is None:
        z_tot = compute_wind_z(
            env.get('building_height_m'),
            h_mat_m,
            h_plot=h_plot_m,
            sans_plot=sans_plot,
        )
        z0_val = TERRAIN_Z0.get(terrain_type, TERRAIN_Z0['IIIa'])

        if vb_num is not None and vb_num > 0 and z_tot > z0_val:
            wind_calc = calculate_wind_params(terrain_type, z_tot, vb_num)
            cr_z = wind_calc['cr_z']
            vm_z = wind_calc['vm']
            iv_z = wind_calc['iv_z']
            kr_z = wind_calc['kr']
            if z_ref is None:
                z_ref = wind_calc['z_used']
            if wind_p.get('qp_dan') is None:
                qp_z = wind_calc['qp_dan']
        else:
            cr_z = context.get('cr_z')
            vm_z = context.get('vm_z')
            iv_z = context.get('iv_z')
            kr_z = context.get('kr_z')

    return {
        'region': region_str,
        'terrain_type': terrain_type,
        'building_height': building_height,
        'z_ref': z_ref,
        'vb_m_s': vb_m_s,
        'cr_z': cr_z,
        'vm_z': vm_z,
        'iv_z': iv_z,
        'kr_z': kr_z,
        'qp_z': qp_z,
    }

