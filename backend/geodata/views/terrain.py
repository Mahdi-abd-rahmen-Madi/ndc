"""Terrain classification & configuration ViewSets and FBV endpoints."""
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from shapely.geometry import Point

from api.permissions import IsAdminOrEngineerPermission
from geodata.models import AntennaEquipment
from geodata.services import TerrainClassificationService, terrain_service
from geodata.terrain_config_service import terrain_config_service
from .regions import compute_transition_zones_geojson


class TerrainClassificationViewSet(viewsets.ViewSet):
    """ViewSet for terrain classification services."""

    permission_classes = [IsAdminOrEngineerPermission]

    @action(detail=False, methods=['get'])
    def classify_coordinates(self, request):
        longitude = request.query_params.get('longitude')
        latitude = request.query_params.get('latitude')

        if longitude is None or latitude is None or longitude == '' or latitude == '':
            return Response(
                {'error': 'Both longitude and latitude parameters are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lon = float(longitude)
            lat = float(latitude)
            if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
                return Response({'error': 'Invalid coordinate ranges'}, status=status.HTTP_400_BAD_REQUEST)

            terrain_type = terrain_service.get_terrain_type_at_coordinates(lon, lat)
            if terrain_type:
                return Response({
                    'terrain_type': terrain_type,
                    'coordinates': {'longitude': lon, 'latitude': lat},
                })
            return Response(
                {'error': 'No terrain classification found at these coordinates'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError:
            return Response({'error': 'Invalid coordinate format'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def batch_classify(self, request):
        coordinates = request.data if request.method == 'POST' else request.query_params
        if 'coordinates' not in coordinates:
            return Response(
                {'error': 'coordinates parameter is required (list of [longitude, latitude] pairs)'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            coords_list = coordinates['coordinates']
            if not isinstance(coords_list, list):
                raise ValueError('coordinates must be a list')

            results = []
            for i, coord_pair in enumerate(coords_list):
                if not isinstance(coord_pair, list) or len(coord_pair) != 2:
                    return Response(
                        {'error': f'Invalid coordinate format at index {i}. Expected [longitude, latitude]'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                lon, lat = coord_pair
                terrain_type = terrain_service.get_terrain_type_at_coordinates(float(lon), float(lat))
                results.append({
                    'coordinates': {'longitude': lon, 'latitude': lat},
                    'terrain_type': terrain_type,
                })

            return Response({'results': results})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def mappings(self, request):
        try:
            return Response(AntennaEquipment.get_all_terrain_mappings())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TerrainConfigViewSet(viewsets.ViewSet):
    """ViewSet for terrain configuration management."""

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def config(self, request):
        try:
            return Response(terrain_config_service.load_config())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrEngineerPermission])
    def summary(self, request):
        try:
            return Response(terrain_config_service.get_config_summary())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def clc_mappings(self, request):
        try:
            return Response(terrain_config_service.get_clc_code_mappings())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def classification_rules(self, request):
        try:
            return Response(terrain_config_service.get_classification_rules())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def spatial_analysis(self, request):
        try:
            return Response(terrain_config_service.get_spatial_analysis_config())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def influence_percentages(self, request):
        try:
            return Response(terrain_config_service.get_influence_percentages())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def update_config(self, request):
        try:
            if terrain_config_service.update_config(request.data):
                return Response({
                    'message': 'Configuration updated successfully',
                    'config': terrain_config_service.load_config(),
                })
            return Response({'error': 'Failed to update configuration'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def reset(self, request):
        try:
            if terrain_config_service.reset_to_defaults():
                return Response({
                    'message': 'Configuration reset successfully',
                    'config': terrain_config_service.load_config(),
                })
            return Response({'error': 'Failed to reset configuration'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def export(self, request):
        try:
            return Response({
                'config': terrain_config_service.export_config(),
                'filename': 'terrain_config.json',
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def import_config(self, request):
        try:
            config_json = request.data.get('config', '')
            if not config_json:
                return Response({'error': 'Configuration JSON is required'}, status=status.HTTP_400_BAD_REQUEST)
            if terrain_config_service.import_config(config_json):
                return Response({
                    'message': 'Configuration imported successfully',
                    'config': terrain_config_service.load_config(),
                })
            return Response({'error': 'Failed to import configuration'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def test_coordinates(self, request):
        """Test coordinates with current configuration."""
        try:
            longitude = float(request.data.get('longitude'))
            latitude = float(request.data.get('latitude'))
            analysis_radius_km = request.data.get('analysis_radius_km')
            analysis_radius_km = float(analysis_radius_km) if analysis_radius_km is not None else 1.0

            ts = TerrainClassificationService.get_instance()
            classification_details = ts.get_terrain_classification_details(longitude, latitude)
            region = ts.get_region_from_coordinates(longitude, latitude)

            gdf = ts._get_local_land_use_data(longitude, latitude, max(analysis_radius_km, 6.0))
            spatial_extent = ts._calculate_spatial_extent_percentages(
                longitude, latitude, gdf, radius_km=analysis_radius_km
            )

            search_area = Point(longitude, latitude).buffer(analysis_radius_km / 111.0)
            intersects = gdf[gdf.geometry.intersects(search_area)]

            if len(intersects) > 0:
                clc_geojson = json.loads(intersects[['Code_18', 'geometry']].copy().to_json())
            else:
                clc_geojson = {"type": "FeatureCollection", "features": []}

            transition_geojson = compute_transition_zones_geojson(intersects)

            cleaned_spatial_extent = {}
            if spatial_extent:
                for key, value in spatial_extent.items():
                    if isinstance(value, (float, int)):
                        cleaned_spatial_extent[key] = 0.0 if value != value else float(value)
                    else:
                        cleaned_spatial_extent[key] = value

            confidence_score = classification_details['confidence_score']
            if isinstance(confidence_score, (float, int)):
                confidence_score = 0.0 if confidence_score != confidence_score else float(confidence_score)

            return Response({
                'terrain_type': classification_details['terrain_type'],
                'base_terrain_type': classification_details['base_terrain_type'],
                'confidence_score': confidence_score,
                'detected_clc_codes': classification_details['detected_clc_codes'],
                'primary_clc_code': classification_details['primary_clc_code'],
                'region': {
                    'number': region,
                    'name': f"Region {region}" if region else "Unknown",
                },
                'coordinates': {
                    'longitude': float(longitude),
                    'latitude': float(latitude),
                },
                'spatial_extent': cleaned_spatial_extent,
                'applicable_rules': classification_details['applicable_rules'],
                'rule_explanations': classification_details['rule_explanations'],
                'clc_polygons': clc_geojson,
                'transition_zones': transition_geojson,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrEngineerPermission])
    def performance_metrics(self, request):
        try:
            return Response(terrain_service.get_performance_metrics())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def reset_metrics(self, request):
        try:
            terrain_service.reset_performance_metrics()
            return Response({'message': 'Performance metrics reset successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def clear_cache(self, request):
        try:
            terrain_service.clear_cache(request.data.get('pattern'))
            return Response({'message': 'Cache cleared successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], permission_classes=[IsAdminOrEngineerPermission])
    def optimize_memory(self, request):
        try:
            terrain_service.optimize_memory_usage()
            return Response({'message': 'Memory optimization completed'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrEngineerPermission])
    def edge_cases(self, request):
        try:
            config = terrain_config_service.load_config()
            edge_cases = terrain_config_service.detect_edge_cases(config)
            return Response({'edge_cases': edge_cases, 'edge_case_count': len(edge_cases)})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def terrain_confidence(self, request):
        try:
            longitude = float(request.query_params.get('longitude'))
            latitude = float(request.query_params.get('latitude'))
            confidence = terrain_service.get_terrain_confidence(longitude, latitude)
            return Response({
                'coordinates': {'longitude': longitude, 'latitude': latitude},
                'confidence_score': confidence,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@csrf_exempt
@require_http_methods(["POST"])
def terrain_classification_api(request):
    """API endpoint for terrain classification at coordinates."""
    try:
        data = json.loads(request.body)
        raw_lat = data.get('latitude')
        raw_lon = data.get('longitude')
        if raw_lat is None or raw_lon is None:
            return JsonResponse({'error': 'Latitude and longitude are required'}, status=400)

        latitude = float(raw_lat)
        longitude = float(raw_lon)

        ts = TerrainClassificationService.get_instance()
        terrain_type = ts.get_terrain_type_at_coordinates(longitude, latitude)

        if terrain_type is None:
            return JsonResponse({
                'terrain_type': None,
                'error': 'No terrain data found at these coordinates',
                'latitude': latitude,
                'longitude': longitude,
            })

        gdf = ts._get_local_land_use_data(longitude, latitude, 5.0)
        spatial_extent = ts._calculate_spatial_extent_percentages(longitude, latitude, gdf)

        return JsonResponse({
            'terrain_type': terrain_type,
            'spatial_extent': spatial_extent,
            'latitude': latitude,
            'longitude': longitude,
        })
    except (ValueError, TypeError) as e:
        return JsonResponse({'error': f'Invalid coordinates: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def terrain_classification_fast_api(request):
    """Fast API endpoint for basic terrain classification without detailed analysis."""
    try:
        data = json.loads(request.body)
        raw_lat = data.get('latitude')
        raw_lon = data.get('longitude')
        if raw_lat is None or raw_lon is None:
            return JsonResponse({'error': 'Latitude and longitude are required'}, status=400)

        latitude = float(raw_lat)
        longitude = float(raw_lon)

        ts = TerrainClassificationService.get_instance()
        terrain_type = ts.get_terrain_type_at_coordinates(longitude, latitude)

        return JsonResponse({
            'terrain_type': terrain_type,
            'latitude': latitude,
            'longitude': longitude,
            'fast_response': True,
        })
    except (ValueError, TypeError) as e:
        return JsonResponse({'error': f'Invalid coordinates: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Server error: {str(e)}'}, status=500)

