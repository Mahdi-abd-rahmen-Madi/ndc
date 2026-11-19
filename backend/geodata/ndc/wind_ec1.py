"""EC1 (EN 1991-1-4) wind parameter calculations and structural section parsing."""
import math
import re

# z0 roughness lengths and z_min per terrain category
# Keys match the canonical frontend/DB values: '0', 'II', 'IIIa', 'IIIb', 'IV'
TERRAIN_Z0 = {
    '0': (0.003, 1),     # (z0 in m, zmin in m)
    'II': (0.05, 2),
    'IIIa': (0.2, 5),
    'IIIb': (0.5, 10),
    'IV': (1.0, 15),
}

# Reference terrain is always Terrain II
Z0_II = 0.05

# Air density (kg/m^3) -- standard EN 1991-1-4 value
RHO_AIR = 1.25


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
    and reference wind speed Vb.
    """
    z0, zmin = TERRAIN_Z0.get(terrain_type, TERRAIN_Z0['IIIa'])

    # Clamp z to zmin (EC1 §4.3.2)
    z_used = max(z_total, zmin)

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


def _resolve_support_wind_params(wind_p: dict, context: dict, env: dict, vb, h_plot_m, h_mat_m) -> dict:
    """Resolve EC1 wind chain for an auxiliary support (RRH or RRU) consistently."""
    qp_z = wind_p.get('qp_dan') or context.get('qp_z')
    cr_z = wind_p.get('cr_z') or wind_p.get('cr')
    vm_z = wind_p.get('vm_z') or wind_p.get('vm')
    iv_z = wind_p.get('iv_z') or wind_p.get('iv')
    kr_z = wind_p.get('kr_z') or wind_p.get('kr')

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
    vb_m_s = (
        wind_p.get('vb0_ms')
        if wind_p.get('vb0_ms') is not None
        else (wind_p.get('v_b0') if wind_p.get('v_b0') is not None else context.get('vb_m_s'))
    )

    try:
        vb_num = (
            float(vb_m_s)
            if vb_m_s is not None and str(vb_m_s) != '[Vb]'
            else (float(vb) if vb is not None else None)
        )
    except (ValueError, TypeError):
        vb_num = float(vb) if vb is not None else None

    if not cr_z:
        try:
            target_qp_dan = float(wind_p.get('qp_dan') or 0.0)
        except (ValueError, TypeError):
            target_qp_dan = 0.0

        if target_qp_dan > 0 and vb_num is not None and vb_num > 0:
            z0_val, _ = TERRAIN_Z0.get(terrain_type, TERRAIN_Z0['IIIa'])
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

    if not cr_z:
        try:
            h_bat = float(env.get('building_height_m') or 0)
            h_plot = float(h_plot_m or 0)
            h_mat = float(h_mat_m or 0)
            z_tot = h_bat + h_plot + h_mat
            if z_tot <= 0:
                z_tot = h_bat
        except (ValueError, TypeError):
            z_tot = 0

        if vb_num is not None and vb_num > 0 and z_tot > 0:
            wind_calc = calculate_wind_params(terrain_type, z_tot, vb_num)
            cr_z = wind_calc['cr_z']
            vm_z = wind_calc['vm']
            iv_z = wind_calc['iv_z']
            kr_z = wind_calc['kr']
            if not qp_z:
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
        'vb_m_s': vb_m_s,
        'cr_z': cr_z,
        'vm_z': vm_z,
        'iv_z': iv_z,
        'kr_z': kr_z,
        'qp_z': qp_z,
    }

