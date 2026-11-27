"""Per-stage calculation cache extraction, lookup, partial-job pruning, and merging."""
import copy
import os
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings

from utils.domain_constants import resolve_sans_plot
from utils.ndc_hash import compute_stage_hashes, detect_calculation_type


_AUX_STAGE_KEYS = {
    "rrh": (
        "rrh", "has_rrh", "rrh_items", "rrh_totals", "rrh_wind_params",
        "rrh_sans_plot", "rrh_echelle", "rrh_files",
    ),
    "rru": (
        "rru", "has_rru", "rru_items", "rru_totals", "rru_wind_params",
        "rru_sans_plot", "rru_echelle", "rru_files",
    ),
    "fh": (
        "fh", "has_fh", "is_fh", "fh_items", "fh_totals", "fh_wind_params",
        "fh_sans_plot", "fh_echelle", "fh_files",
    ),
    "lovage": (
        "lovage", "has_lovage", "is_lovage", "lovage_items", "lovage_totals",
        "lovage_wind_params", "lovage_sans_plot", "lovage_echelle",
        "lovage_gps", "lovage_mdea", "lovage_has_gps", "lovage_has_mdea", "lovage_files",
    ),
}

_ALL_STAGE_SPECIFIC_KEYS = {
    "active_equipments", "ndc_hash", "calculation_type", "progress", "ndc_pdf_url",
    *{k for keys in _AUX_STAGE_KEYS.values() for k in keys},
}

_ANTENNA_FILE_FIELDS = (
    "screenshot",
    "verification_screenshot",
    "note_de_calcul",
    "note_mat",
    "note_plot",
    "assemblage_note",
    "reactions_file",
)

_RRH_FILE_FIELDS_MAP = {
    "note_de_calcul": "note_de_calcul_rrh",
    "assemblage_note": "rrh_assemblage_note",
    "rrh_verification_screenshot": "rrh_verification_screenshot",
    "rrh_tableau_charges": "rrh_tableau_charges",
    "rrh_reactions_file": "rrh_reactions_file",
    "rrh_screenshot": "rrh_screenshot",
}

_FH_FILE_FIELDS_MAP = {
    "note_de_calcul": "note_de_calcul_fh",
    "note_mat": "fh_note_mat",
    "note_plot": "fh_note_plot",
    "assemblage_note": "fh_assemblage_note",
    "fh_verification_screenshot": "fh_verification_screenshot",
    "fh_tableau_charges": "fh_tableau_charges",
    "fh_reactions_file": "fh_reactions_file",
    "fh_screenshot": "fh_screenshot",
}


def _abs_media_path(rel_or_abs: Optional[str]) -> Optional[str]:
    if not rel_or_abs or not isinstance(rel_or_abs, str):
        return None
    if os.path.isabs(rel_or_abs):
        return rel_or_abs if os.path.exists(rel_or_abs) else None
    cand = os.path.join(settings.MEDIA_ROOT, rel_or_abs)
    return cand if os.path.exists(cand) else None


def _rel_media_path(abs_path: Optional[str]) -> Optional[str]:
    if not abs_path or not isinstance(abs_path, str):
        return None
    if not os.path.isabs(abs_path):
        return abs_path if _abs_media_path(abs_path) else None
    try:
        media_root = os.path.abspath(settings.MEDIA_ROOT)
        abs_norm = os.path.abspath(abs_path)
        if os.path.commonpath([media_root, abs_norm]) == media_root and os.path.exists(abs_norm):
            return os.path.relpath(abs_norm, media_root)
    except ValueError:
        pass
    return None


def _first_existing(candidates: List[Optional[str]]) -> Optional[str]:
    for c in candidates:
        if c and isinstance(c, str) and os.path.exists(c):
            return c
    return None


def _resolve_field_rel_path(job, field_name: str, fallback_rels: List[str], exclude_tokens: Tuple[str, ...] = ()) -> Optional[str]:
    field_val = getattr(job, field_name, None)
    if field_val and getattr(field_val, "name", None):
        name_low = field_val.name.lower()
        if not any(tok in name_low for tok in exclude_tokens):
            if _abs_media_path(field_val.name):
                return field_val.name
    for rel_p in fallback_rels:
        if _abs_media_path(rel_p):
            return rel_p
    return None


def extract_stage_cache_entry(job, stage: str) -> Optional[Dict[str, Any]]:
    """
    Extract verified `result_payload` and `artifact_paths` for a single stage
    from a completed CalculationJob. Returns None if mandatory artifacts are missing.
    """
    if not job:
        return None
    res_data = job.result_data if isinstance(getattr(job, "result_data", None), dict) else {}
    inp_data = job.input_data if isinstance(getattr(job, "input_data", None), dict) else {}
    calc_type = str(getattr(job, "calculation_type", "") or "").lower().strip()

    if stage == "antenna":
        model_fields: Dict[str, str] = {}
        fallback_map = {
            "screenshot": [f"screenshots/job_{job.id}_3d_view.jpg"],
            "verification_screenshot": [
                f"screenshots/verification/job_{job.id}_verification.jpg",
                f"screenshots/job_{job.id}_verification.jpg",
                f"screenshots/verification/job_{job.id}_antenna_verification.jpg",
                f"screenshots/job_{job.id}_antenna_verification.jpg",
            ],
            "note_de_calcul": [
                f"notes_de_calcul/job_{job.id}_note_de_calcul.rtf",
                f"notes_de_calcul/job_{job.id}_antenna_note_de_calcul.rtf",
            ],
            "note_mat": [f"notes_de_calcul/job_{job.id}_antenna_note_mat.rtf"],
            "note_plot": [f"notes_de_calcul/job_{job.id}_antenna_note_plot.rtf"],
            "assemblage_note": [
                f"assemblages/job_{job.id}_assemblage_note.rtf",
                f"assemblages/job_{job.id}_antenna_assemblage_note.rtf",
            ],
            "reactions_file": [f"reactions/job_{job.id}_reactions.txt"],
        }
        aux_tokens = ("_rrh_", "_rru_", "_fh_", "_lovage_", "notes_rrh", "notes_rru", "notes_fh", "notes_lovage")
        for fname in _ANTENNA_FILE_FIELDS:
            rel = _resolve_field_rel_path(
                job,
                fname,
                fallback_map[fname],
                exclude_tokens=aux_tokens if fname in ("note_mat", "note_plot") else (),
            )
            if rel:
                model_fields[fname] = rel

        for required in ("screenshot", "verification_screenshot", "note_de_calcul", "assemblage_note"):
            if required not in model_fields:
                return None

        result_payload = {
            k: copy.deepcopy(v)
            for k, v in res_data.items()
            if k not in _ALL_STAGE_SPECIFIC_KEYS
        }
        return {
            "result_payload": result_payload,
            "artifact_paths": {"model_fields": model_fields},
        }

    if stage not in _AUX_STAGE_KEYS:
        return None

    from geodata.ndc.artifact_locator import find_job_equipment_rtf_paths

    rtf_paths = find_job_equipment_rtf_paths(job, kind=stage)
    existing_files = res_data.get(f"{stage}_files") if isinstance(res_data.get(f"{stage}_files"), dict) else {}

    scr_key = f"{stage}_screenshot"
    verif_key = f"{stage}_verification_screenshot"
    charges_key = f"{stage}_tableau_charges"
    react_key = f"{stage}_reactions_file"

    stage_files: Dict[str, str] = {}
    for k, abs_cands in (
        ("note_de_calcul", [rtf_paths.get("note_de_calcul"), existing_files.get("note_de_calcul")]),
        ("note_mat", [rtf_paths.get("note_mat"), existing_files.get("note_mat")]),
        ("note_plot", [rtf_paths.get("note_plot"), existing_files.get("note_plot")]),
        ("assemblage_note", [rtf_paths.get("assemblage_note"), existing_files.get("assemblage_note")]),
        (
            scr_key,
            [
                existing_files.get(scr_key),
                getattr(getattr(job, scr_key, None), "path", None) if stage in ("rrh", "fh") else None,
                os.path.join(settings.MEDIA_ROOT, f"screenshots_{stage}", f"job_{job.id}_{stage}_3d_view.jpg"),
            ],
        ),
        (
            verif_key,
            [
                existing_files.get(verif_key),
                getattr(getattr(job, verif_key, None), "path", None) if stage in ("rrh", "fh") else None,
                os.path.join(settings.MEDIA_ROOT, f"verif_{stage}", f"job_{job.id}_{stage}_verification.jpg"),
            ],
        ),
        (
            charges_key,
            [
                existing_files.get(charges_key),
                getattr(getattr(job, charges_key, None), "path", None) if stage in ("rrh", "fh") else None,
                os.path.join(settings.MEDIA_ROOT, f"charges_{stage}", f"job_{job.id}_{stage}_tableau_charges.png"),
            ],
        ),
        (
            react_key,
            [
                existing_files.get(react_key),
                getattr(getattr(job, react_key, None), "path", None) if stage in ("rrh", "fh") else None,
                os.path.join(settings.MEDIA_ROOT, f"reactions_{stage}", f"job_{job.id}_{stage}_reactions.txt"),
            ],
        ),
    ):
        found = _first_existing(abs_cands)
        if found:
            stage_files[k] = found

    if scr_key not in stage_files or verif_key not in stage_files or charges_key not in stage_files:
        return None
    if "note_mat" not in stage_files and "note_de_calcul" not in stage_files:
        return None
    is_sp = resolve_sans_plot(inp_data, res_data, calc_type=calc_type, kind=stage)
    if not is_sp and "assemblage_note" not in stage_files:
        return None

    model_fields = {}
    fmap = _RRH_FILE_FIELDS_MAP if stage == "rrh" else (_FH_FILE_FIELDS_MAP if stage == "fh" else {})
    for file_key, model_field in fmap.items():
        rel = _rel_media_path(stage_files.get(file_key))
        if rel:
            model_fields[model_field] = rel

    result_payload: Dict[str, Any] = {}
    for k in _AUX_STAGE_KEYS[stage]:
        if k == f"{stage}_files":
            continue
        if k in res_data:
            result_payload[k] = copy.deepcopy(res_data[k])
    if f"{stage}_wind_params" not in result_payload and isinstance(res_data.get("wind_params"), dict):
        result_payload[f"{stage}_wind_params"] = copy.deepcopy(res_data["wind_params"])
    if isinstance(res_data.get("structure_params"), dict):
        stage_sub = result_payload.get(stage)
        if not isinstance(stage_sub, dict):
            stage_sub = {}
            result_payload[stage] = stage_sub
        if not isinstance(stage_sub.get("structure_params"), dict) or not stage_sub.get("structure_params"):
            stage_sub["structure_params"] = copy.deepcopy(res_data["structure_params"])
    result_payload[f"has_{stage}"] = True
    result_payload[f"{stage}_files"] = stage_files

    return {
        "result_payload": result_payload,
        "artifact_paths": {
            "model_fields": model_fields,
            "stage_files": stage_files,
        },
    }


def save_job_stages_to_cache(job) -> List[str]:
    """
    Persist each completed stage of `job` into `CalculationStageCache`.
    Returns the list of stage names cached.
    """
    if not job or getattr(job, "status", None) != "COMPLETED":
        return []
    from .models import CalculationStageCache

    inp_data = job.input_data if isinstance(getattr(job, "input_data", None), dict) else {}
    stage_hashes = getattr(job, "stage_hashes", None)
    if not isinstance(stage_hashes, dict) or not stage_hashes:
        stage_hashes = compute_stage_hashes(inp_data, getattr(job, "calculation_type", None))
        if stage_hashes:
            job.stage_hashes = stage_hashes
            job.save(update_fields=["stage_hashes"])

    cached_names: List[str] = []
    for stage, s_hash in stage_hashes.items():
        entry = extract_stage_cache_entry(job, stage)
        if not entry:
            continue
        CalculationStageCache.objects.update_or_create(
            stage_hash=s_hash,
            defaults={
                "stage": stage,
                "source_job": job,
                "result_payload": entry["result_payload"],
                "artifact_paths": entry["artifact_paths"],
            },
        )
        cached_names.append(stage)
    return cached_names


def _verify_cached_entry_files(stage: str, artifact_paths: Dict[str, Any], input_data: Dict[str, Any]) -> bool:
    if not isinstance(artifact_paths, dict):
        return False
    model_fields = artifact_paths.get("model_fields") or {}
    if stage == "antenna":
        return all(_abs_media_path(model_fields.get(req)) for req in ("screenshot", "verification_screenshot", "note_de_calcul", "assemblage_note"))

    stage_files = artifact_paths.get("stage_files") or {}
    if not _first_existing([stage_files.get(f"{stage}_screenshot")]):
        return False
    if not _first_existing([stage_files.get(f"{stage}_verification_screenshot")]):
        return False
    if not _first_existing([stage_files.get(f"{stage}_tableau_charges")]):
        return False
    if not _first_existing([stage_files.get("note_mat"), stage_files.get("note_de_calcul")]):
        return False
    if not resolve_sans_plot(input_data, kind=stage) and not _first_existing([stage_files.get("assemblage_note")]):
        return False
    return True


def lookup_cached_stages(stage_hashes: Dict[str, str], input_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Look up valid, artifact-complete `CalculationStageCache` entries for `stage_hashes`.
    Returns `{stage: {"stage_hash": ..., "source_job_id": ..., "result_payload": ..., "artifact_paths": ...}}`.
    """
    if not stage_hashes:
        return {}
    from .models import CalculationStageCache

    rows = CalculationStageCache.objects.filter(stage_hash__in=list(stage_hashes.values())).select_related("source_job")
    by_hash = {row.stage_hash: row for row in rows}
    hits: Dict[str, Dict[str, Any]] = {}
    for stage, s_hash in stage_hashes.items():
        row = by_hash.get(s_hash)
        if not row:
            continue
        if not _verify_cached_entry_files(stage, row.artifact_paths, input_data):
            continue
        hits[stage] = {
            "stage_hash": s_hash,
            "source_job_id": row.source_job_id,
            "source_job": row.source_job,
            "result_payload": copy.deepcopy(row.result_payload or {}),
            "artifact_paths": copy.deepcopy(row.artifact_paths or {}),
        }
    return hits


def apply_cached_stages_to_job_kwargs(cached_entries: Dict[str, Dict[str, Any]]) -> Tuple[Dict[str, str], Dict[str, Any]]:
    """
    Combine cached stage entries into `(model_field_kwargs, merged_result_data)`
    ready to apply on a `CalculationJob`.
    """
    field_kwargs: Dict[str, str] = {}
    merged_res: Dict[str, Any] = {}
    active_eqs: List[str] = []

    # Apply antenna first so auxiliary stages don't get overwritten or conflict
    ordered_stages = [s for s in ("antenna", "rrh", "rru", "fh", "lovage") if s in cached_entries]
    for stage in ordered_stages:
        entry = cached_entries[stage]
        art = entry.get("artifact_paths") or {}
        for mf, rel_path in (art.get("model_fields") or {}).items():
            if rel_path:
                field_kwargs[mf] = rel_path
        payload = entry.get("result_payload") or {}
        for k, v in payload.items():
            merged_res[k] = copy.deepcopy(v)
        if stage != "antenna":
            merged_res[f"has_{stage}"] = True
            if stage not in active_eqs:
                active_eqs.append(stage)

    if active_eqs:
        merged_res["active_equipments"] = active_eqs

    return field_kwargs, merged_res


def build_worker_input_for_missing_stages(
    full_input_data: Dict[str, Any],
    cached_stages: List[str],
    missing_stages: List[str],
) -> Dict[str, Any]:
    """
    Return a pruned copy of `full_input_data` containing ONLY `missing_stages`
    so the Robot worker computes only what missed the stage cache.
    """
    pruned = copy.deepcopy(full_input_data or {})
    cached_set = set(cached_stages or [])

    if "antenna" in cached_set:
        pruned.pop("antenna_4g", None)
        pruned.pop("antenna_5g", None)

    for aux_stage, block_keys in (
        ("rrh", ("rrh_equipment",)),
        ("rru", ("rru_equipment",)),
        ("fh", ("fh_equipment",)),
        ("lovage", ("boitier_lovage", "lovage_equipment")),
    ):
        if aux_stage in cached_set:
            pruned[f"is_{aux_stage}"] = False
            for bk in block_keys:
                if isinstance(pruned.get(bk), dict):
                    pruned[bk]["enabled"] = False
                    if "items" in pruned[bk]:
                        pruned[bk]["items"] = []

    pruned.pop("calculation_type", None)
    partial_calc_type = detect_calculation_type(pruned)
    pruned["calculation_type"] = partial_calc_type

    if len(missing_stages) == 1 and missing_stages[0] != "antenna":
        only_stage = missing_stages[0]
        pruned[f"is_{only_stage}"] = True
        sub_struct = pruned.get(f"structure_{only_stage}")
        if isinstance(sub_struct, dict):
            pruned["structure"] = copy.deepcopy(sub_struct)

    pruned["cached_stages"] = list(cached_stages)
    pruned["stages_to_compute"] = list(missing_stages)
    return pruned


def merge_worker_result_with_cached(
    existing_result_data: Optional[Dict[str, Any]],
    worker_result_data: Optional[Dict[str, Any]],
    cached_stages: List[str],
) -> Dict[str, Any]:
    """
    Merge newly computed worker `result_data` with pre-populated cached stage data,
    ensuring cached stages are preserved and `active_equipments` is unioned.
    """
    cached_res = copy.deepcopy(existing_result_data) if isinstance(existing_result_data, dict) else {}
    worker_res = copy.deepcopy(worker_result_data) if isinstance(worker_result_data, dict) else {}
    cached_set = set(cached_stages or [])

    preserved_keys: Dict[str, Any] = {}
    if "antenna" in cached_set:
        for k, v in cached_res.items():
            if k not in _ALL_STAGE_SPECIFIC_KEYS:
                preserved_keys[k] = v
    for st in cached_set:
        if st in _AUX_STAGE_KEYS:
            for k in _AUX_STAGE_KEYS[st]:
                if k in cached_res:
                    preserved_keys[k] = cached_res[k]

    merged = {**cached_res, **worker_res, **preserved_keys}

    eqs: List[str] = []
    for src in (cached_res.get("active_equipments"), worker_res.get("active_equipments")):
        if isinstance(src, list):
            for item in src:
                if item and item not in eqs:
                    eqs.append(item)
    for st in ("rrh", "rru", "fh", "lovage"):
        if merged.get(f"has_{st}") is True and st not in eqs:
            eqs.append(st)
    if eqs:
        merged["active_equipments"] = eqs

    for st in cached_set:
        if st != "antenna":
            merged[f"has_{st}"] = True

    return merged
