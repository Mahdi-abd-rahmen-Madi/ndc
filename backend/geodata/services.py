"""
Backward-compatible façade re-exporting terrain classification and BDTOPO services
from the modular `geodata.terrain` package.
"""
from .terrain import (
    _get_land_use_engine,
    TerrainClassificationService,
    terrain_service,
    BDTOPOService,
    bdtopo_service,
)

__all__ = [
    '_get_land_use_engine',
    'TerrainClassificationService',
    'terrain_service',
    'BDTOPOService',
    'bdtopo_service',
]
