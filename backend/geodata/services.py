"""
Backward-compatible façade re-exporting terrain classification and BDTOPO services
from the modular `geodata.terrain` package.
"""
from .terrain import (
    TerrainClassificationService,
    terrain_service,
    BDTOPOService,
    bdtopo_service,
)

__all__ = [
    'TerrainClassificationService',
    'terrain_service',
    'BDTOPOService',
    'bdtopo_service',
]
