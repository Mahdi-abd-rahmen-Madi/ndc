from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AntennaEquipmentViewSet, AntennaSpecificationViewSet, TerrainLoadCalculationViewSet, 
    TerrainClassificationViewSet, GeocodingSearchViewSet, TerrainConfigViewSet, RegionGeoJSONViewSet,
    HeightCalculationRequestViewSet, NotificationViewSet,
    terrain_map_view, terrain_classification_api, terrain_classification_fast_api, region_map_view,
    bdtopo_tile_proxy
)

router = DefaultRouter()
router.register(r'antenna-equipment', AntennaEquipmentViewSet)
router.register(r'antenna-specifications', AntennaSpecificationViewSet)
router.register(r'terrain-calculations', TerrainLoadCalculationViewSet)
router.register(r'terrain-classification', TerrainClassificationViewSet, basename='terrain-classification')
router.register(r'geocoding-search', GeocodingSearchViewSet, basename='geocoding-search')
router.register(r'terrain-config', TerrainConfigViewSet, basename='terrain-config')
router.register(r'regions', RegionGeoJSONViewSet, basename='regions')
router.register(r'height-requests', HeightCalculationRequestViewSet, basename='height-requests')
router.register(r'notifications', NotificationViewSet, basename='notifications')

app_name = 'geodata'

urlpatterns = [
    path('', include(router.urls)),
    path('terrain-map/', terrain_map_view, name='terrain-map'),
    path('region-map/', region_map_view, name='region-map'),
    path('terrain-classify/', terrain_classification_api, name='terrain-classify'),
    path('terrain-classify-fast/', terrain_classification_fast_api, name='terrain-classify-fast'),
    path('bdtopo-tiles/<int:z>/<int:x>/<int:y>/', bdtopo_tile_proxy, name='bdtopo-tile-proxy'),
]
