import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')

import os
import time
import requests
import win32com.client
import pythoncom
import re
import asyncio
import concurrent.futures
import threading
import traceback
import psutil
import pyautogui
from PIL import ImageGrab
import glob
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse
import uvicorn
from pydantic import BaseModel
from typing import Dict, Any, Optional

API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api")

# Worker State
WORKER_STATUS = "IDLE"
CURRENT_JOB_ID = None

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Robot Worker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
com_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
job_queue = asyncio.Queue()
new_job_event = threading.Event()

class JobPayload(BaseModel):
    id: int
    input_data: Dict[str, Any]

class JobRejectedException(Exception):
    pass

def log_to_server(msg):
    print(msg)
    try:
        requests.post(f"{API_BASE_URL}/worker/control/", json={'message': msg}, timeout=1)
    except:
        pass

def connect_to_robot():
    """Connects to the active Robot Structural Analysis instance."""
    import win32com.client
    try:
        robot_app = win32com.client.gencache.EnsureDispatch("Robot.Application")
        robot_app.Interactive = 0
        robot_app.Visible = 1
        return robot_app
    except Exception:
        try:
            robot_app = win32com.client.Dispatch("Robot.Application")
            robot_app.Interactive = 0
            robot_app.Visible = 1
            return robot_app
        except Exception as e:
            log_to_server(f"❌ Error connecting to Robot application: {e}")
            return None

def get_valid_materials(project):
    """
    Fetches the exact material names expected by the active Robot SDK database.
    Checks Steel (1) and Concrete (2) databases.
    """
    valid_materials = []
    try:
        materials = project.Preferences.Materials
        # 1 = I_MT_STEEL, 2 = I_MT_CONCRETE
        for mat_type in [1, 2]:
            names_array = materials.Get(mat_type)
            count = getattr(names_array, 'Count', 0)
            for i in range(1, count + 1):
                valid_materials.append(names_array.Get(i))
    except Exception as e:
        log_to_server(f"⚠ Warning: Could not fetch material list from SDK: {e}")
    return valid_materials

def configure_task_preferences(project):
    """
    Configure Robot task preferences (Job Preferences / Préférences de la tâche)
    to match the Eurocode FR defaults:
      - Unités: Poids=daN, Force=daN, Moment=daN*m, Contrainte=daN/m2
      - Analyse: Méthode de résolution = Skyline
      - Normes: NF EN 1990 (pondérations), NF EN 1991 (neige/vent), NF EN 1998 (sismique)
    """
    prefs = project.Preferences

    # ── IRobotUnitType enum values (from Robot SDK) ──
    I_UT_FORCE   = 7    # Force          → daN
    I_UT_MOMENT  = 8    # Moment         → daN*m
    I_UT_STRESS  = 9    # Contrainte     → daN/m2
    I_UT_WEIGHT  = 14   # Poids          → daN

    unit_map = {
        I_UT_FORCE:  "daN",
        I_UT_MOMENT: "daN",
        I_UT_STRESS: "daN",
        I_UT_WEIGHT: "daN",
    }

    for unit_type, unit_name in unit_map.items():
        try:
            ud = prefs.Units.Get(unit_type)
            ud.Name = unit_name
            prefs.Units.Set(unit_type, ud)
        except Exception as e:
            log_to_server(f"⚠ Could not set unit {unit_name} (type={unit_type}): {e}")

    # ── Méthode de résolution: Skyline ──
    # IRobotEquationSolvingMethod: 0 = Automatic, 1 = Skyline, 2 = Frontal, 3 = Sparse, 4 = SparseM
    try:
        project.CalcEngine.AnalysisParams.EquationSolvingMethod = 1
        log_to_server("   ✓ Solver set to Skyline (Method 1)")
    except Exception as e:
        log_to_server(f"⚠ Could not set Skyline solver: {e}")

    # ── Normes de conception / Charges (Eurocode FR) ──
    # IRobotCodeType enum values:
    I_CT_STEEL_STRUCTURES  = 0   # Structures acier et aluminium → NF EN 1993-1:2005/NA:2007/AC:2009
    I_CT_STEEL_CONNECTIONS = 1   # Assemblages acier             → NF EN 1993-1-8:2005/NA:2007/AC:2009
    I_CT_SNOW_WIND_LOADS   = 6   # Neige et vent                → NF EN 1991
    I_CT_SEISMIC_LOADS     = 7   # Sismique                     → NF EN 1998
    I_CT_CODE_COMBINATIONS = 9   # Pondérations                 → NF EN 1990

    code_map = {
        I_CT_STEEL_STRUCTURES:  "NF EN 1993-1:2005/NA:2007/AC:2009",
        I_CT_STEEL_CONNECTIONS: "NF EN 1993-1-8:2005/NA:2007/AC:2009",
        I_CT_SNOW_WIND_LOADS:   "NF-EN 1991-1-3/4/NA:2007/2008",
        I_CT_SEISMIC_LOADS:     "NF EN 1998-1/NA Septembre 2021",
        I_CT_CODE_COMBINATIONS: "NF EN 1990/NA Décembre 2011",
    }

    for code_type, code_name in code_map.items():
        try:
            prefs.SetActiveCode(code_type, code_name)
            log_to_server(f"   ✓ Code set: {code_name}")
        except Exception as e:
            log_to_server(f"⚠ Could not set code '{code_name}' (type={code_type}): {e}")

    log_to_server("   ✓ Task preferences configured (daN units, Skyline, Eurocode FR)")

def require_input(d, key, parent_name):
    """Fetches a key from a dictionary, raising an error if missing."""
    if not isinstance(d, dict) or key not in d or d[key] is None:
        raise ValueError(f"Missing required input parameter: '{parent_name}.{key}'. No fallback values are allowed.")
    return d[key]

def parse_section_dimensions(section_name):
    """
    Parses section names like 'TCAR 200x5', 'TRON 76x5' to extract 
    width/diameter and thickness in meters. Assumes mm in string.
    """
    if not section_name:
        raise ValueError("Section name is empty or missing.")
    match = re.search(r'([\d.]+)\s*[xX]\s*([\d.]+)', section_name)
    if match:
        w_mm = float(match.group(1))
        t_mm = float(match.group(2))
        return w_mm / 1000.0, t_mm / 1000.0
    raise ValueError(f"Could not parse dimensions from section name '{section_name}'. Expected format like '200x5'.")

def process_calculation(job_id, input_data):
    """
    Parses inputs, controls Robot Structural Analysis via COM, 
    and returns the structural results including full NDC variables.
    """
    log_to_server(f"🔄 Processing Job #{job_id}...")
    
    robot_app = connect_to_robot()
    if not robot_app:
        raise Exception("Could not connect to or start Robot application.")
    
    # Save active project to a temp file first so the "dirty" flag is cleared.
    # This completely prevents the "Save Changes?" popup without breaking COM!
    import os
    import uuid
    tmp_rtd = os.path.join(os.environ.get('TEMP', r'C:\Temp'), f"worker_temp_{job_id}_{uuid.uuid4().hex}.rtd")
    try:
        if robot_app.Project.IsActive:
            robot_app.Project.SaveAs(tmp_rtd)
    except:
        pass
        
    robot_app.Project.New(4) # 4 = I_PT_FRAME_3D
    time.sleep(1) # Give Robot 1s to fully initialize the new COM objects
    project = robot_app.Project
    
    # --- 0. Apply task preferences (units daN, Skyline solver, Eurocode FR) ---
    configure_task_preferences(project)
    
    # --- 1. Extract inputs ---
    log_to_server(f"DEBUG PAYLOAD: {input_data}")
    structure = input_data.get('structure', {})
    environment = input_data.get('environment', {})
    antenna_4g = input_data.get('antenna_4g', {})
    antenna_5g = input_data.get('antenna_5g', {})
    site = input_data.get('site', {})
    
    hauteur_mat_m = require_input(structure, 'hauteur_mat_m', 'structure')
    # Length of bras de déport is always 0.3m
    bras_de_deport_len = 0.3
    
    plot_section_str = require_input(structure, 'plot_section', 'structure')
    bras_section_str = require_input(structure, 'bras_section', 'structure')
    mast_5g_section_str = require_input(structure, 'mast_5g_section', 'structure')
    mast_section_str = require_input(structure, 'mast_section', 'structure')

    plot_w_m, plot_t_m = parse_section_dimensions(plot_section_str)
    bras_w_m, bras_t_m = parse_section_dimensions(bras_section_str)
    mast_5g_d_m, mast_5g_t_m = parse_section_dimensions(mast_5g_section_str)
    D_m, t_m = parse_section_dimensions(mast_section_str)
    
    # Try alternate keys because frontend is dropping it
    requested_material = structure.get('material_name') or structure.get('material') or input_data.get('material_name') or input_data.get('material') or site.get('material')
    if not requested_material:
        raise ValueError("Missing required input parameter for material (e.g. structure.material_name). No fallback allowed.")
    ancrage = require_input(site, 'ancrage', 'site')
    
    # 4G
    a4g_h = require_input(antenna_4g, 'hauteur_mm', 'antenna_4g')
    a4g_w = require_input(antenna_4g, 'largeur_mm', 'antenna_4g')
    a4g_t = require_input(antenna_4g, 'epaisseur_mm', 'antenna_4g')
    a4g_weight = require_input(antenna_4g, 'poids_kg', 'antenna_4g')
    
    # 5G
    a5g_h = require_input(antenna_5g, 'hauteur_mm', 'antenna_5g')
    a5g_w = require_input(antenna_5g, 'largeur_mm', 'antenna_5g')
    a5g_t = require_input(antenna_5g, 'epaisseur_mm', 'antenna_5g')
    a5g_weight = require_input(antenna_5g, 'poids_kg', 'antenna_5g')
    # 5G mast height is always 1m
    a5g_mat_h = 1.0
    
    log_to_server(f"   -> Mât Principal spécifié: {hauteur_mat_m}m")
    log_to_server(f"   -> Matériau demandé: {requested_material}")
    log_to_server(f"   ! WARNING: 4G wind forces are HARDCODED to 192.40 daN and 105.15 daN")
    
    # --- 2. Eurocode Wind Calculations ---
    import math
    region = require_input(environment, 'region', 'environment')
    terrain_type = str(require_input(environment, 'terrain_type', 'environment'))
    
    region_vb0 = {1: 22.0, 2: 24.0, 3: 26.0, 4: 28.0, '1': 22.0, '2': 24.0, '3': 26.0, '4': 28.0}
    if region not in region_vb0:
        raise ValueError(f"Invalid environment.region: {region}")
    v_b0 = region_vb0[region]
    
    z0_map = {'0': 0.003, 'I': 0.01, 'II': 0.05, 'III': 0.3, 'IIIa': 0.2, 'IIIb': 0.5, 'IV': 1.0, 'A': 0.003, 'B': 0.05, 'C': 0.3}
    if terrain_type not in z0_map:
        raise ValueError(f"Invalid environment.terrain_type: {terrain_type}")
    z0 = z0_map[terrain_type]
    z0_II = 0.05
    z_ref = 15.0 # Typically 15m as seen in PDF
    
    kr = 0.19 * ((z0 / z0_II) ** 0.07)
    cr = kr * math.log(z_ref / z0) if z_ref > z0 else kr
    vm = cr * 1.0 * v_b0
    iv = 1.0 / math.log(z_ref / z0) if z_ref > z0 else 0.1
    
    rho = 1.225
    qp_pa = (1 + 7 * iv) * (0.5 * rho * (vm ** 2))
    qp_dan = qp_pa / 10.0 # daN/m2
    
    # Forces
    fw_mast = 15.72 # HARDCODED FOR NOW
    
    a4g_area_front = (a4g_h * a4g_w) / 1000000.0
    a4g_area_lat = (a4g_h * a4g_t) / 1000000.0
    # fw_4g_front = 1.0 * a4g_area_front * qp_dan * 1.55 # Shape factor approx
    # fw_4g_lat = 1.0 * a4g_area_lat * qp_dan * 1.42
    
    fw_4g_front = 192.40  # HARDCODED FOR NOW
    fw_4g_lat = 105.15    # HARDCODED FOR NOW
    
    a5g_area_front = (a5g_h * a5g_w) / 1000000.0
    a5g_area_lat = (a5g_h * a5g_t) / 1000000.0
    fw_5g_front = 42.60 # HARDCODED FOR NOW
    fw_5g_lat = 21.80   # HARDCODED FOR NOW
    
    # --- 3. Define Geometry ---
    plot_h = 0.3
    mast_top_z = plot_h + hauteur_mat_m
    
    # Create Structural Axes (Lignes de construction) matching the diagram:
    # X: axis 1 at x=0.0, axis 2 at x=bras_de_deport_len
    # Y: axis 1 at y=0.0 (single plane)
    # Z: axis A at z=0.0, axis B at z=plot_h, axis C at z=mast_top_z
    #
    # IMPORTANT: AddSequence(spacing, repetitions) — spacing is arg1, count is arg2
    # (confirmed by live SDK testing: GetSequence returns (spacing, count) in same order)
    try:
        import win32com.client
        axis_mngr = project.AxisMngr
        axis_mngr.Clear()
        grid = axis_mngr.Create(1, 'Axes_5G')
        grid_cart = win32com.client.CastTo(grid, 'IRobotStructuralAxisGridCartesian')
        
        # X Axes: axis 1 at x=0.0, axis 2 at x=bras_de_deport_len
        # AddSequence(spacing=bras_de_deport_len, repetitions=1)
        grid_cart.X.StartPosition = 0.0
        grid_cart.X.AddSequence(bras_de_deport_len, 1)    # spacing=0.3, 1 rep => axis at 0.3
        grid_cart.X.SetLabelFormat(1, '1', False)          # 1=numeric, from '1', not reversed
        
        # Y Axes: single plane at y=0.0, numeric label
        grid_cart.Y.StartPosition = 0.0
        grid_cart.Y.AddSequence(0.0, 0)                    # 0 spacing, 0 reps = only start plane
        grid_cart.Y.SetLabelFormat(1, '1', False)          # 1=numeric, from '1', not reversed
        
        # Z Axes: A at 0.0, B at plot_h (0.30), C at mast_top_z
        # Two AddSequence calls with exact spacing for each gap
        grid_cart.Z.StartPosition = 0.0
        grid_cart.Z.AddSequence(plot_h, 1)                 # spacing=plot_h, 1 rep => B at plot_h
        grid_cart.Z.AddSequence(hauteur_mat_m, 1)          # spacing=hauteur_mat_m, 1 rep => C at mast_top_z
        grid_cart.Z.SetLabelFormat(2, 'A', False)          # 2=letters, from 'A', not reversed
        
        # CRITICAL: persist axis definitions to the model before activating
        grid.Save()
        axis_mngr.Activate(1)
        
        # Explicitly set axis labels using FindAxisByPos to ensure correct assignment
        # (SetLabelFormat alone does not always persist label text reliably)
        try:
            ix1 = grid_cart.X.FindAxisByPos(0.0)
            ix2 = grid_cart.X.FindAxisByPos(bras_de_deport_len)
            if ix1 > 0: grid_cart.X.SetAxisLabel(ix1, '1')
            if ix2 > 0: grid_cart.X.SetAxisLabel(ix2, '2')
            
            iy1 = grid_cart.Y.FindAxisByPos(0.0)
            if iy1 > 0: grid_cart.Y.SetAxisLabel(iy1, '1')
            
            iz1 = grid_cart.Z.FindAxisByPos(0.0)
            iz2 = grid_cart.Z.FindAxisByPos(plot_h)
            iz3 = grid_cart.Z.FindAxisByPos(mast_top_z)
            if iz1 > 0: grid_cart.Z.SetAxisLabel(iz1, 'A')
            if iz2 > 0: grid_cart.Z.SetAxisLabel(iz2, 'B')
            if iz3 > 0: grid_cart.Z.SetAxisLabel(iz3, 'C')
            
            grid.Save()  # persist labels
        except Exception as label_e:
            log_to_server(f"   ⚠ Could not set axis labels: {label_e}")

    except Exception as e:
        log_to_server(f"Could not create structural axes: {e}")
        
    str_nodes = project.Structure.Nodes
    
    # 5G mast height is a5g_mat_h (1.0m). The clamps are placed as follows:
    # 0.2m extension top, 0.6m spacing, 0.2m extension bottom.
    ext = 0.2
    clamp_spacing = 0.6
    
    # Shift the clamps slightly lower on the main mast
    top_clamp_offset = 0.3 # 30cm below the top of the main mast
    clamp_upper_z = mast_top_z - top_clamp_offset
    clamp_lower_z = clamp_upper_z - clamp_spacing
    
    if clamp_lower_z <= plot_h:
        # Fallback if mast is too short to support the requested clamp spacing
        available_height = hauteur_mat_m - top_clamp_offset - 0.05
        if available_height < 0.1:
            available_height = 0.1
        clamp_spacing = available_height
        ext = (a5g_mat_h - clamp_spacing) / 2.0
        clamp_upper_z = mast_top_z - top_clamp_offset
        clamp_lower_z = clamp_upper_z - clamp_spacing
        
    str_nodes.Create(1, 0.0, 0.0, 0.0)                        # Node 1: Base
    str_nodes.Create(2, 0.0, 0.0, plot_h)                     # Node 2: Top of Plot / Base of Mast
    str_nodes.Create(3, 0.0, 0.0, clamp_lower_z)              # Node 3: Lower clamp point on Main Mast
    str_nodes.Create(4, 0.0, 0.0, clamp_upper_z)              # Node 4: Upper clamp point on Main Mast
    str_nodes.Create(9, 0.0, 0.0, mast_top_z)                 # Node 9: Top of Main Mast
    
    str_nodes.Create(5, bras_de_deport_len, 0.0, clamp_lower_z) # Node 5: Lower clamp on 5G Mast
    str_nodes.Create(6, bras_de_deport_len, 0.0, clamp_upper_z) # Node 6: Upper clamp on 5G Mast
    str_nodes.Create(7, bras_de_deport_len, 0.0, clamp_lower_z - ext) # Node 7: Bottom of 5G Mast
    str_nodes.Create(8, bras_de_deport_len, 0.0, clamp_upper_z + ext) # Node 8: Top of 5G Mast
    
    # --- Additional Reference Points ---
    # Node 10: Midpoint of the 1m 5G mast
    mid_5g_z = (clamp_lower_z - ext + clamp_upper_z + ext) / 2.0
    str_nodes.Create(10, bras_de_deport_len, 0.0, mid_5g_z)
    
    # Node 11: -1.65m from the top of the 4G main mast
    str_nodes.Create(11, 0.0, 0.0, mast_top_z - 1.65)
    
    str_bars = project.Structure.Bars
    str_bars.Create(1, 1, 2) # Plot
    str_bars.Create(2, 2, 9) # Mast Principal (One continuous bar from base to top)
    str_bars.Create(3, 3, 5) # Lower Bras de deport
    str_bars.Create(4, 4, 6) # Upper Bras de deport
    str_bars.Create(5, 7, 8) # Mat antenne 5G (One continuous bar from bottom to top)
    
    # --- Assign Materials & Sections ---
    valid_materials = get_valid_materials(project)
    matched_material = None
    if valid_materials:
        matched_material = next((m for m in valid_materials if m.lower() == requested_material.lower()), None)
        if not matched_material:
            fallback = valid_materials[0]
            log_to_server(f"⚠ Matériau demandé '{requested_material}' introuvable dans la base active.")
            log_to_server(f"⚠ Utilisation du matériau par défaut: '{fallback}' (Base active a {len(valid_materials)} matériaux)")
            matched_material = fallback
    else:
        matched_material = requested_material
    
    labels = project.Structure.Labels
    
    def assign_section(bar_id, label_id, name, dim1_m, thick_m, is_tube=False):
        sec = labels.Create(3, name)
        sec_data = sec.Data
        
        # 1. Try to load from Robot's active section database
        success = False
        try:
            if sec_data.LoadFromDBase(name):
                success = True
        except Exception:
            pass

        if success:
            sec_data.MaterialName = matched_material
            labels.Store(sec)
            str_bars.Get(bar_id).SetLabel(3, name)
            log_to_server(f"   ✓ Loaded section '{name}' directly from native Robot catalog.")
            return

        log_to_server(f"   ! Section '{name}' not in DB. Generating custom parameterized section.")
        
        # 2. Fallback to manually generated non-standard section
        if is_tube:
            sec_data.Type = 4 # I_BST_NS_TUBE (Non-standard tube)
            sec_data.ShapeType = 93 # I_BSST_USER_TUBE
            nonstd_data = sec_data.CreateNonstd(0)
            nonstd_data.SetValue(0, dim1_m)  # I_BSNDV_TUBE_D = 0
            nonstd_data.SetValue(1, thick_m) # I_BSNDV_TUBE_T = 1
        else:
            sec_data.Type = 1 # I_BST_NS_BOX (Non-standard hollow box)
            sec_data.ShapeType = 91 # I_BSST_USER_BOX
            nonstd_data = sec_data.CreateNonstd(0)
            nonstd_data.SetValue(0, dim1_m)  # I_BSNDV_BOX_H = 0 (Height)
            nonstd_data.SetValue(1, dim1_m)  # I_BSNDV_BOX_B = 1 (Width)
            nonstd_data.SetValue(2, thick_m) # I_BSNDV_BOX_TH = 2 (Thickness)
            
        sec_data.MaterialName = matched_material
        sec_data.CalcNonstdGeometry()
        labels.Store(sec)
        str_bars.Get(bar_id).SetLabel(3, name)

    assign_section(1, 101, plot_section_str, plot_w_m, plot_t_m, is_tube=False)
    assign_section(2, 102, f"TRON {D_m*1000:g}x{t_m*1000:g}", D_m, t_m, is_tube=True)
    assign_section(3, 103, bras_section_str, bras_w_m, bras_t_m, is_tube=False)
    assign_section(4, 103, bras_section_str, bras_w_m, bras_t_m, is_tube=False)
    assign_section(5, 104, mast_5g_section_str, mast_5g_d_m, mast_5g_t_m, is_tube=True)
    
    # --- Support ---
    support_label = labels.Create(0, "Fixed_Base")
    support_data = support_label.Data
    support_data.UX = support_data.UY = support_data.UZ = 1
    support_data.RX = support_data.RY = support_data.RZ = 1
    labels.Store(support_label)
    str_nodes.Get(1).SetLabel(0, "Fixed_Base")
    
    # --- 4. Load Cases ---
    cases = project.Structure.Cases
    I_CN_PERMANENT = 0
    I_CN_WIND = 2
    I_CN_ACCIDENTAL = 5
    I_CAT_STATIC_LINEAR = 1
    
    # 1. pp (Poids propre)
    pp_case = cases.CreateSimple(1, "pp", I_CN_PERMANENT, I_CAT_STATIC_LINEAR)
    pp_case.Records.New(7) # self-weight
    log_to_server(f"   -> [Cas 1:pp] Applying self-weight to all bars")
    
    # 2. pe (Poids equipements)
    pe_case = cases.CreateSimple(2, "pe", I_CN_PERMANENT, I_CAT_STATIC_LINEAR)
    f_pe1 = pe_case.Records.New(0) # Nodal
    rec_pe1 = pe_case.Records.Get(f_pe1)
    rec_pe1.SetValue(2, -a5g_weight * 10.0) # API expects Newtons (1 daN = 10 N)
    rec_pe1.Objects.AddOne(10)
    log_to_server(f"   -> [Cas 2:pe] Applying 5G weight FZ={-a5g_weight:.2f} daN on Node 10")
    
    f_pe2 = pe_case.Records.New(0) # Nodal
    rec_pe2 = pe_case.Records.Get(f_pe2)
    rec_pe2.SetValue(2, -a4g_weight * 10.0) # API expects Newtons
    rec_pe2.Objects.AddOne(11)
    log_to_server(f"   -> [Cas 2:pe] Applying 4G weight FZ={-a4g_weight:.2f} daN on Node 11")
    
    # 3. ech (Echelle)
    ech_case = cases.CreateSimple(3, "ech", I_CN_PERMANENT, I_CAT_STATIC_LINEAR)
    f_ech = ech_case.Records.New(5) # I_LRT_BAR_UNIFORM
    rec_ech = ech_case.Records.Get(f_ech)
    rec_ech.SetValue(2, -15.0 * 10.0) # API expects N/m
    rec_ech.Objects.AddOne(2)
    log_to_server(f"   -> [Cas 3:ech] Applying PZ=-15.00 daN/m on Bar 2")
    
    # 4. ch (Chute homme)
    ch_case = cases.CreateSimple(4, "ch", I_CN_ACCIDENTAL, I_CAT_STATIC_LINEAR)
    f_ch = ch_case.Records.New(0) # Nodal
    rec_ch = ch_case.Records.Get(f_ch)
    rec_ch.SetValue(1, 220.0 * 10.0)  # FY in Newtons
    rec_ch.SetValue(2, -980.0 * 10.0) # FZ in Newtons
    rec_ch.Objects.AddOne(9)
    log_to_server(f"   -> [Cas 4:ch] Applying FY=220.00, FZ=-980.00 daN on Node 9")
    
    # --- 5. Wind Cases (5,6,7,8) ---
    vx_pos_case = cases.CreateSimple(5, "vx+", I_CN_WIND, I_CAT_STATIC_LINEAR)
    vx_neg_case = cases.CreateSimple(6, "vx-", I_CN_WIND, I_CAT_STATIC_LINEAR)
    vy_pos_case = cases.CreateSimple(7, "vy+", I_CN_WIND, I_CAT_STATIC_LINEAR)
    vy_neg_case = cases.CreateSimple(8, "vy-", I_CN_WIND, I_CAT_STATIC_LINEAR)

    # --- Node 11 (4G) ---
    f_vx_node = vx_pos_case.Records.New(0)
    rec_vx_node = vx_pos_case.Records.Get(f_vx_node)
    rec_vx_node.SetValue(0, fw_4g_front * 10.0)
    rec_vx_node.Objects.AddOne(11)

    f_vx_neg_node = vx_neg_case.Records.New(0)
    rec_vx_neg_node = vx_neg_case.Records.Get(f_vx_neg_node)
    rec_vx_neg_node.SetValue(0, -fw_4g_front * 10.0)
    rec_vx_neg_node.Objects.AddOne(11)

    f_vy_node = vy_pos_case.Records.New(0)
    rec_vy_node = vy_pos_case.Records.Get(f_vy_node)
    rec_vy_node.SetValue(1, fw_4g_lat * 10.0)
    rec_vy_node.Objects.AddOne(11)

    f_vy_neg_node = vy_neg_case.Records.New(0)
    rec_vy_neg_node = vy_neg_case.Records.Get(f_vy_neg_node)
    rec_vy_neg_node.SetValue(1, -fw_4g_lat * 10.0)
    rec_vy_neg_node.Objects.AddOne(11)

    # --- Node 10 (5G) ---
    f_vx_node_5g = vx_pos_case.Records.New(0)
    rec_vx_node_5g = vx_pos_case.Records.Get(f_vx_node_5g)
    rec_vx_node_5g.SetValue(0, fw_5g_front * 10.0)
    rec_vx_node_5g.Objects.AddOne(10)

    f_vx_neg_node_5g = vx_neg_case.Records.New(0)
    rec_vx_neg_node_5g = vx_neg_case.Records.Get(f_vx_neg_node_5g)
    rec_vx_neg_node_5g.SetValue(0, -fw_5g_front * 10.0)
    rec_vx_neg_node_5g.Objects.AddOne(10)

    f_vy_node_5g = vy_pos_case.Records.New(0)
    rec_vy_node_5g = vy_pos_case.Records.Get(f_vy_node_5g)
    rec_vy_node_5g.SetValue(1, fw_5g_lat * 10.0)
    rec_vy_node_5g.Objects.AddOne(10)

    f_vy_neg_node_5g = vy_neg_case.Records.New(0)
    rec_vy_neg_node_5g = vy_neg_case.Records.Get(f_vy_neg_node_5g)
    rec_vy_neg_node_5g.SetValue(1, -fw_5g_lat * 10.0)
    rec_vy_neg_node_5g.Objects.AddOne(10)

    # --- Bar 2 (Mast) ---
    f_vx_bar = vx_pos_case.Records.New(5)
    rec_vx_bar = vx_pos_case.Records.Get(f_vx_bar)
    rec_vx_bar.SetValue(0, fw_mast * 10.0)
    rec_vx_bar.Objects.AddOne(2)

    f_vx_neg_bar = vx_neg_case.Records.New(5)
    rec_vx_neg_bar = vx_neg_case.Records.Get(f_vx_neg_bar)
    rec_vx_neg_bar.SetValue(0, -fw_mast * 10.0)
    rec_vx_neg_bar.Objects.AddOne(2)

    f_vy_bar = vy_pos_case.Records.New(5)
    rec_vy_bar = vy_pos_case.Records.Get(f_vy_bar)
    rec_vy_bar.SetValue(1, fw_mast * 10.0)
    rec_vy_bar.Objects.AddOne(2)

    f_vy_neg_bar = vy_neg_case.Records.New(5)
    rec_vy_neg_bar = vy_neg_case.Records.Get(f_vy_neg_bar)
    rec_vy_neg_bar.SetValue(1, -fw_mast * 10.0)
    rec_vy_neg_bar.Objects.AddOne(2)

    log_to_server("   -> Applied wind cases 5,6,7,8 (grouped by component to match table ordering)")

    # --- Auto Combinations ---
    try:
        log_to_server("   -> Generating automatic combinations...")
        code_cmb_engine = cases.CodeCmbEngine
        
        # Ensure we have early-bound dispatch for Params
        win32com.client.gencache.EnsureModule('{F3A37BD0-AA2D-11D2-9844-0080C86BE4DF}', 0, 1, 0)
        params = win32com.client.gencache.EnsureDispatch(code_cmb_engine.Params)
        
        # 2 = I_CCGT_FULL (Complètes)
        params.GenType = 2
        
        # We just rely on the pure native rule (which is permanently patched on the server)
        code_cmb_engine.Generate()
        log_to_server("   -> Automatic combinations generated successfully without sismique.")
            
    except Exception as e:
        log_to_server(f"      [!] Failed to generate automatic combinations: {e}")

    
    # --- 5. Calculation ---
    robot_app.Interactive = 1
    
    # Try to force the default view into 3D with section shapes enabled
    try:
        view = project.ViewMngr.GetView(1)
        if view:
            view.Projection = 5 # 5 = I_P_3D (Isometric 3D projection)
            view.ParamsDisplay.Set(14, True) # 14 = I_VDA_SECTIONS_SHAPE
            view.ParamsDisplay.Set(45, True) # 45 = I_VDA_OTHER_STRUCTURAL_AXIS (Lignes de construction)
            view.ParamsDisplay.Set(97, True) # 97 = I_VDA_OTHER_STRUCTURAL_AXIS_DESCRIPTION
            view.ParamsDisplay.Set(12, True) # 12 = I_VDA_SECTIONS_COLORS (Couleurs de profilés)
            view.Redraw(1) # 1 = force init zoom to fit window
    except Exception as e:
        log_to_server(f"Could not force 3D view shapes: {e}")
        project.ViewMngr.Refresh()
        
    # --- Capture 3D Scenery Natively ---
    screenshot_path = None
    try:
        from PIL import Image
        output_dir = os.path.join(os.getcwd(), "screenshots")
        os.makedirs(output_dir, exist_ok=True)
        screenshot_path = os.path.join(output_dir, f"job_{job_id}_3d_view.jpg")
        temp_png = os.path.join(output_dir, f"job_{job_id}_3d_view_temp.png")
        
        view = project.ViewMngr.GetView(1)
        if view:
            view.Window.Activate()
            view.Projection = 3 # I_VP_3DXYZ chosen by user
            view.Redraw(1)
            time.sleep(1.5) # Wait for graphics engine
            
            temp_png = os.path.join(output_dir, f"job_{job_id}_3d_view_temp.png")
            screenshot_path = os.path.join(output_dir, f"job_{job_id}_3d_view.jpg")
            
            # 5 is I_OFF_PNG in Robot SDK
            view.Printable.SaveToFile(temp_png, 5)
            
            if os.path.exists(temp_png):
                img = Image.open(temp_png)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(screenshot_path, 'JPEG')
                try:
                    img.close()
                    os.remove(temp_png)
                except:
                    pass
                log_to_server(f"✅ 3D view natively captured (Proj 3): {screenshot_path}")
            else:
                log_to_server("⚠ Native capture failed to write the file.")
                screenshot_path = None
        else:
            log_to_server("⚠ No active view found to capture.")
            screenshot_path = None
    except Exception as e:
        log_to_server(f"⚠ Could not capture 3D view natively: {e}")
        screenshot_path = None


    log_to_server("   -> Calcul Robot en cours...")
    project.CalcEngine.Calculate()
    
    # --- 6. Results ---
    server = project.Structure.Results
    wind_rx = server.Nodes.Reactions.Value(1, 3) # Node 1, Case 3 (Vx+)
    fx_reaction = wind_rx.FX
    my_reaction = wind_rx.MY
    
    wind_disp = server.Nodes.Displacements.Value(3, 3) # Node 3, Case 3
    ux_deflection = wind_disp.UX
    
    # --- 7. Export Payload ---
    max_deflection_mm = abs(ux_deflection) * 1000
    allowable_deflection_mm = (hauteur_mat_m * 1000) / 200.0

    ndc_vars = {
        "var_1": int(D_m * 1000),
        "var_2": t_m * 1000,
        "var_3": int(hauteur_mat_m * 1000),
        "var_4": "x", 
        "var_5": "x",
        "var_6": 76,
        "var_7": 5,
        "var_8": int(a5g_mat_h * 1000),
        "var_9": int(bras_de_deport_len * 1000),
        "var_10": 5,
        "var_11": 50,
        "var_12": region,
        "var_13": terrain_type,
        "var_14": z_ref,
        "var_15": v_b0,
        "var_16": round(kr, 2),
        "var_17": round(cr, 2),
        "var_18": round(cr, 2),
        "var_19": 1.0,
        "var_20": v_b0,
        "var_21": round(vm, 2),
        "var_22": round(iv, 2),
        "var_23": round(qp_dan, 2),
        "var_24": round(D_m, 3),
        "var_25": round(qp_dan, 2),
        "var_26": round(fw_mast, 2),
        "var_27": round(a4g_w/1000, 2),
        "var_28": round(a4g_h/1000, 2),
        "var_29": round(qp_dan, 2),
        "var_30": round(fw_4g_front, 2),
        "var_31": round(a4g_t/1000, 2),
        "var_32": round(a4g_h/1000, 2),
        "var_33": round(qp_dan, 2),
        "var_34": round(fw_4g_lat, 2),
        "var_35": round(a5g_w/1000, 2),
        "var_36": round(a5g_h/1000, 2),
        "var_37": round(qp_dan, 2),
        "var_38": round(fw_5g_front, 2),
        "var_39": round(a5g_t/1000, 2),
        "var_40": round(a5g_h/1000, 2),
        "var_41": round(qp_dan, 2),
        "var_42": round(fw_5g_lat, 2),
        "var_43": f"{D_m * 1000:g}",
        "var_44": f"{int(a4g_h)}x{int(a4g_w)}x{int(a4g_t)}",
        "var_45": a4g_weight,
        "var_46": hauteur_mat_m,
        "var_47": f"{int(a5g_h)}x{int(a5g_w)}x{int(a5g_t)}",
        "var_48": a5g_weight,
        "var_49": hauteur_mat_m + ext, # Actual height of the 5G antenna top above the plot base
        "var_50": plot_section_str,
        "var_51": plot_h,
        "var_52": bras_section_str,
        "var_53": bras_de_deport_len,
        "var_54": f"{D_m*1000:g}x{t_m*1000:g}",
        "var_55": hauteur_mat_m,
        "var_56": mast_5g_section_str,
        "var_57": a5g_mat_h
    }

    result_data = {
        "max_deflection_mm": max_deflection_mm,
        "wind_force_applied_dan": fw_mast,
        "reaction_forces_dan": {"fx": fx_reaction, "my": my_reaction},
        "verdict": "PASSED" if max_deflection_mm < allowable_deflection_mm else "FAILED",
        "note_de_calcul_vars": ndc_vars,
        "screenshot_path": screenshot_path
    }
    
    return result_data

def submit_result(job_id, status, result_data=None, error_message=None):
    """Sends results or errors back to the Django API."""
    import json
    url = f"{API_BASE_URL}/calculations/{job_id}/complete/"
    
    screenshot_path = None
    files = None
    
    if result_data and "screenshot_path" in result_data and result_data["screenshot_path"]:
        screenshot_path = result_data["screenshot_path"]
        if os.path.exists(screenshot_path):
            files = {"screenshot": open(screenshot_path, "rb")}
            
    try:
        if files:
            # Send as multipart/form-data
            payload = {
                "status": status,
                "result_data": json.dumps(result_data) if result_data else "",
                "error_message": error_message or ""
            }
            response = requests.post(url, data=payload, files=files)
        else:
            # Send as standard JSON
            payload = {
                "status": status,
                "result_data": result_data,
                "error_message": error_message
            }
            response = requests.post(url, json=payload)
            
        if response.status_code == 200:
            log_to_server(f"✅ Job #{job_id} updated successfully on server with status: {status}")
            # Do NOT clean up the temporary screenshot file as the backend may access it directly
            if files and screenshot_path and os.path.exists(screenshot_path):
                files["screenshot"].close()
                log_to_server(f"ℹ Kept temporary screenshot for backend access: {screenshot_path}")
        else:
            log_to_server(f"❌ Failed to submit job update: {response.status_code} - {response.text}")
    except Exception as e:
        log_to_server(f"❌ Connection error while submitting result: {e}")
    finally:
        # Ensure file handle is closed even on failure
        if files and not files["screenshot"].closed:
            files["screenshot"].close()

def run_job_sync(job_id, input_data):
    """Synchronous function that runs inside the COM thread executor."""
    pythoncom.CoInitialize()
    
    is_inspect = input_data and input_data.get("inspect_mode")
    robot_ref = None
    if is_inspect:
        try:
            robot_ref = win32com.client.gencache.EnsureDispatch("Robot.Application")
        except:
            pass
            
    try:
        results = process_calculation(job_id, input_data)
        if not is_inspect:
            submit_result(job_id, "COMPLETED", result_data=results)
        else:
            submit_result(job_id, "PENDING", result_data=results)
            log_to_server(f"👀 Inspect mode: Results computed and saved to server. Job remains PENDING.")
    except JobRejectedException as e:
        log_to_server(f"❌ Job #{job_id} rejected: {e}")
        submit_result(job_id, "REJECTED", error_message=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        log_to_server(f"❌ Failed processing Job #{job_id}: {e}")
        
        # Take fallback screenshot on failure
        screenshot_path = None
        try:
            output_dir = os.path.join(os.getcwd(), "screenshots")
            os.makedirs(output_dir, exist_ok=True)
            screenshot_path = os.path.join(output_dir, f"job_{job_id}_failure.jpg")
            img = ImageGrab.grab()
            img.save(screenshot_path, "JPEG")
            log_to_server(f"📸 Saved fallback desktop screenshot to {screenshot_path}")
        except Exception as ss_e:
            log_to_server(f"⚠ Could not take fallback screenshot: {ss_e}")
            screenshot_path = None
            
        result_data = {"screenshot_path": screenshot_path} if screenshot_path else None
        submit_result(job_id, "FAILED", result_data=result_data, error_message=str(e))
    finally:
        if is_inspect:
            log_to_server("👀 Inspect mode active: Keeping Robot open until next job arrives...")
            new_job_event.clear()
            new_job_event.wait()
            
        robot_ref = None
        pythoncom.CoUninitialize()

def cleanup_temp_files():
    """Cleans up old Robot temp files to prevent disk space issues."""
    temp_dir = os.environ.get('TEMP', r'C:\Temp')
    pattern = os.path.join(temp_dir, "worker_temp_*.rtd")
    for f in glob.glob(pattern):
        try:
            # Only delete if older than 1 hour (3600 seconds)
            if os.path.getmtime(f) < time.time() - 3600:
                os.remove(f)
                log_to_server(f"🗑 Cleaned up old temp file: {f}")
        except Exception:
            pass

async def worker_loop():
    """Background task that pulls jobs from the queue and executes them safely."""
    global WORKER_STATUS, CURRENT_JOB_ID
    while True:
        job = await job_queue.get()
        WORKER_STATUS = "BUSY"
        CURRENT_JOB_ID = job.id
        log_to_server(f"▶️ Executing Job #{job.id} from queue...")
        
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(com_executor, run_job_sync, job.id, job.input_data)
        except Exception as e:
            log_to_server(f"❌ Worker loop error: {e}")
        finally:
            WORKER_STATUS = "IDLE"
            CURRENT_JOB_ID = None
            job_queue.task_done()
            cleanup_temp_files()

@app.on_event("startup")
async def startup_event():
    print("🚀 Starting Windows Robot SDK Worker via FastAPI...")
    
    # Simple check to verify connectivity inside the COM executor
    def init_check():
        pythoncom.CoInitialize()
        try:
            robot_check = connect_to_robot()
            if robot_check:
                log_to_server(f"✅ Connection test successful! Robot Version: {robot_check.Version}")
            else:
                log_to_server("⚠ Warning: Could not verify connection to Robot on startup.")
        finally:
            pythoncom.CoUninitialize()
            
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(com_executor, init_check)
    
    # Start the queue processor
    asyncio.create_task(worker_loop())

@app.get("/api/status")
def get_status():
    mem_usage = psutil.virtual_memory().percent
    robot_procs = [p for p in psutil.process_iter(['name', 'memory_info']) if p.info['name'] and 'robot.exe' in p.info['name'].lower()]
    robot_mem_mb = sum(p.info['memory_info'].rss for p in robot_procs) / (1024 * 1024) if robot_procs else 0
    
    return {
        "status": WORKER_STATUS,
        "current_job_id": CURRENT_JOB_ID,
        "queue_size": job_queue.qsize(),
        "system_memory_percent": mem_usage,
        "robot_memory_mb": round(robot_mem_mb, 2),
        "robot_processes_count": len(robot_procs)
    }

@app.post("/api/jobs")
async def receive_job(job: JobPayload):
    await job_queue.put(job)
    new_job_event.set()  # Wake up any waiting inspect mode thread
    log_to_server(f"📥 Received Job #{job.id}. Queue size: {job_queue.qsize()}")
    return {"message": "Job queued", "job_id": job.id, "queue_size": job_queue.qsize()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
