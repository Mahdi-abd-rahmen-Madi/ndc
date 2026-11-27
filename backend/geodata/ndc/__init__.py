"""Modular Note de Calcul (NDC) generation package."""
from .wind_ec1 import (
    TERRAIN_Z0,
    Z0_II,
    RHO_AIR,
    _parse_section_dimensions,
    _parse_envelope_dims_m,
    compute_wind_z,
    calculate_wind_params,
    get_antenna_wind,
    get_support_wind,
    get_support_structure_params,
    resolve_antenna_wind_params,
    _resolve_support_wind_params,
)
from .rtf_converter import (
    sanitize_assemblage_rtf,
    _extract_images_from_pdf,
    _batch_convert_rtf_files,
    _convert_rtf_file_to_images,
)
from .artifact_locator import (
    _worker_screenshots_dir,
    _first_existing_file,
    find_job_note_de_calcul_path,
    find_job_assemblage_note_path,
    find_job_equipment_rtf_paths,
    find_job_rrh_rtf_paths,
    find_job_rru_rtf_paths,
    find_job_fh_rtf_paths,
    find_job_lovage_rtf_paths,
    collect_site_ndc_rtf_specs,
)
from .image_cropper import (
    _crop_tableau_charges_image,
    crop_verification_screenshot,
)
from .equipment_context import (
    clean_equipment_designation,
    extract_rrh_ndc_context,
    extract_rru_ndc_context,
    extract_fh_ndc_context,
    extract_lovage_ndc_context,
)
from .pdf_renderer import (
    generate_ndc_pdf,
    generate_ndc_pdf_task,
    generate_auxiliary_pdfs,
)

__all__ = [
    'TERRAIN_Z0',
    'Z0_II',
    'RHO_AIR',
    '_parse_section_dimensions',
    '_parse_envelope_dims_m',
    'compute_wind_z',
    'calculate_wind_params',
    'get_antenna_wind',
    'get_support_wind',
    'get_support_structure_params',
    'resolve_antenna_wind_params',
    '_resolve_support_wind_params',
    'sanitize_assemblage_rtf',
    '_extract_images_from_pdf',
    '_batch_convert_rtf_files',
    '_convert_rtf_file_to_images',
    '_worker_screenshots_dir',
    '_first_existing_file',
    'find_job_note_de_calcul_path',
    'find_job_assemblage_note_path',
    'find_job_equipment_rtf_paths',
    'find_job_rrh_rtf_paths',
    'find_job_rru_rtf_paths',
    'find_job_fh_rtf_paths',
    'find_job_lovage_rtf_paths',
    'collect_site_ndc_rtf_specs',
    '_crop_tableau_charges_image',
    'crop_verification_screenshot',
    'clean_equipment_designation',
    'extract_rrh_ndc_context',
    'extract_rru_ndc_context',
    'extract_fh_ndc_context',
    'extract_lovage_ndc_context',
    'generate_ndc_pdf',
    'generate_ndc_pdf_task',
    'generate_auxiliary_pdfs',
]

