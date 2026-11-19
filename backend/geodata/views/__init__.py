"""Modular geodata views package preserving 100% backward-compatible imports."""
from .equipment import (
    AntennaEquipmentViewSet,
    AntennaSpecificationViewSet,
    TerrainLoadCalculationViewSet,
)
from .terrain import (
    TerrainClassificationViewSet,
    TerrainConfigViewSet,
    terrain_classification_api,
    terrain_classification_fast_api,
)
from .regions import (
    RegionGeoJSONViewSet,
    compute_transition_zones_geojson,
    terrain_map_view,
    region_map_view,
    bdtopo_tile_proxy,
)
from .geocoding import GeocodingSearchViewSet
from .requests_notifications import (
    HeightCalculationRequestViewSet,
    NotificationViewSet,
    send_ws_notification,
)
from .catalogue import (
    preview_document_api,
    get_matching_catalogue_pdf,
    test_catalogue_equipment_view,
)

__all__ = [
    'AntennaEquipmentViewSet',
    'AntennaSpecificationViewSet',
    'TerrainLoadCalculationViewSet',
    'TerrainClassificationViewSet',
    'TerrainConfigViewSet',
    'terrain_classification_api',
    'terrain_classification_fast_api',
    'RegionGeoJSONViewSet',
    'compute_transition_zones_geojson',
    'terrain_map_view',
    'region_map_view',
    'bdtopo_tile_proxy',
    'GeocodingSearchViewSet',
    'HeightCalculationRequestViewSet',
    'NotificationViewSet',
    'send_ws_notification',
    'preview_document_api',
    'get_matching_catalogue_pdf',
    'test_catalogue_equipment_view',
]

