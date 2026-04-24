from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AntennaEquipmentViewSet, AntennaSpecificationViewSet, TerrainLoadCalculationViewSet, TerrainClassificationViewSet, GeocodingSearchViewSet

router = DefaultRouter()
router.register(r'antenna-equipment', AntennaEquipmentViewSet)
router.register(r'antenna-specifications', AntennaSpecificationViewSet)
router.register(r'terrain-calculations', TerrainLoadCalculationViewSet)
router.register(r'terrain-classification', TerrainClassificationViewSet, basename='terrain-classification')
router.register(r'geocoding-search', GeocodingSearchViewSet, basename='geocoding-search')

app_name = 'geodata'

urlpatterns = [
    path('', include(router.urls)),
]
