"""Static & dynamic GeoJSON region/coastline/transition views and BDTOPO tile proxy."""
import json
import logging
import os
from collections import defaultdict

import geopandas as gpd
import requests
from requests.adapters import HTTPAdapter
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render
from django.views.decorators.cache import cache_page
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from shapely.geometry import box

from geodata.services import TerrainClassificationService
from geodata.terrain_config_service import terrain_config_service
from utils.domain_constants import V_B0_TO_REGION, WIND_REGION_VB0

logger = logging.getLogger(__name__)

_REGIONS_GEOJSON_CACHE = None
_WIND_COEFF_PARSED_CACHE = None
_COASTLINE_RAW = None
_COASTLINE_BUFFER_RAW = None

_TILE_PROXY_SESSION = requests.Session()
_TILE_PROXY_ADAPTER = HTTPAdapter(pool_connections=12, pool_maxsize=12)
_TILE_PROXY_SESSION.mount('https://', _TILE_PROXY_ADAPTER)
_TILE_PROXY_SESSION.mount('http://', _TILE_PROXY_ADAPTER)

REGION_DESCRIPTIONS = {
    1: "Northern France (V_B0: 22)",
    2: "Western France (V_B0: 24)",
    3: "Central France (V_B0: 26)",
    4: "Eastern France (V_B0: 28)",
}

MAX_TRANSITION_BBOX_DEG2 = 0.25


def _load_wind_coeff_raw() -> dict:
    """Load and cache ec1_windCoeff.geojson in memory once per process."""
    global _WIND_COEFF_PARSED_CACHE
    if _WIND_COEFF_PARSED_CACHE is None:
        geojson_path = os.path.join(settings.BASE_DIR, 'data', 'ec1_windCoeff.geojson')
        with open(geojson_path, 'r', encoding='utf-8') as f:
            _WIND_COEFF_PARSED_CACHE = json.load(f)
    return _WIND_COEFF_PARSED_CACHE


def compute_transition_zones_geojson(intersects_gdf) -> dict:
    """
    Shared helper: compute 50m penetration transition zones where rural Terrain II/IIIa
    polygons intrude into urban Terrain IV/IIIb polygons (EPSG:2154 metric buffer).
    """
    empty = {"type": "FeatureCollection", "features": []}
    if intersects_gdf is None or len(intersects_gdf) == 0:
        return empty

    try:
        intersects_projected = intersects_gdf.to_crs(epsg=2154)
        clc_mappings = terrain_config_service.get_clc_code_mappings()
        target_codes = (
            list(clc_mappings.get('terrain_II', {}).get('codes', []))
            + list(clc_mappings.get('terrain_IIIa', {}).get('codes', []))
        )
        urban_codes = (
            list(clc_mappings.get('terrain_IV', {}).get('codes', []))
            + list(clc_mappings.get('terrain_IIIb', {}).get('codes', []))
        )

        urban_polygons = intersects_projected[intersects_projected['Code_18'].isin(urban_codes)]
        target_polygons = intersects_projected[intersects_projected['Code_18'].isin(target_codes)]
        if len(urban_polygons) == 0 or len(target_polygons) == 0:
            return empty

        buffered_targets = target_polygons.geometry.buffer(50.0).unary_union
        transition_zones = urban_polygons.geometry.intersection(buffered_targets)

        transition_gdf = gpd.GeoDataFrame(geometry=transition_zones, crs="EPSG:2154").to_crs(epsg=4326)
        transition_gdf = transition_gdf[~transition_gdf.geometry.is_empty]
        if len(transition_gdf) == 0:
            return empty

        transition_gdf['type'] = 'transition_zone'
        return json.loads(transition_gdf[['geometry', 'type']].to_json())
    except Exception as e:
        logger.error("Error calculating transition zones for visualization: %s", e)
        return empty


def terrain_map_view(request):
    """Render the terrain classification map page."""
    return render(request, 'geodata/terrain_map.html')


def region_map_view(request):
    """Render the region visualization map page."""
    return render(request, 'geodata/region_map.html')


class RegionGeoJSONViewSet(viewsets.ViewSet):
    """ViewSet for serving region boundaries, coastline, and transition zones as GeoJSON."""

    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def regions(self, request):
        global _REGIONS_GEOJSON_CACHE
        if _REGIONS_GEOJSON_CACHE is not None:
            response = HttpResponse(_REGIONS_GEOJSON_CACHE, content_type='application/json')
            response['Cache-Control'] = 'public, max-age=86400, immutable'
            return response

        try:
            data = _load_wind_coeff_raw()
            regions = defaultdict(list)

            for feature in data.get('features', []):
                v_b0 = feature.get('properties', {}).get('V_B0')
                if v_b0 and v_b0 in V_B0_TO_REGION:
                    regions[V_B0_TO_REGION[v_b0]].append(feature.get('geometry'))

            combined_features = []
            for region_id in [1, 2, 3, 4]:
                if region_id in regions and regions[region_id]:
                    all_polygons = []
                    for geom in regions[region_id]:
                        if geom.get('type') == 'MultiPolygon':
                            all_polygons.extend(geom.get('coordinates', []))
                        elif geom.get('type') == 'Polygon':
                            all_polygons.append(geom.get('coordinates', []))

                    combined_features.append({
                        "type": "Feature",
                        "properties": {
                            "region_id": region_id,
                            "name": f"Region {region_id}",
                            "description": REGION_DESCRIPTIONS[region_id],
                            "v_b0_value": WIND_REGION_VB0[region_id],
                            "feature_count": len(all_polygons),
                        },
                        "geometry": {
                            "type": "MultiPolygon",
                            "coordinates": all_polygons,
                        },
                    })

            _REGIONS_GEOJSON_CACHE = json.dumps({
                "type": "FeatureCollection",
                "features": combined_features,
            }).encode('utf-8')

            response = HttpResponse(_REGIONS_GEOJSON_CACHE, content_type='application/json')
            response['Cache-Control'] = 'public, max-age=86400, immutable'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def coastline(self, request):
        global _COASTLINE_RAW
        try:
            if _COASTLINE_RAW is None:
                geojson_path = os.path.join(settings.BASE_DIR, 'data', 'france_coastline.geojson')
                if not os.path.exists(geojson_path):
                    return Response({'error': 'Coastline GeoJSON file not found'}, status=status.HTTP_404_NOT_FOUND)
                with open(geojson_path, 'rb') as f:
                    _COASTLINE_RAW = f.read()

            response = HttpResponse(_COASTLINE_RAW, content_type='application/json')
            response['Cache-Control'] = 'public, max-age=86400, immutable'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def coastline_buffer(self, request):
        global _COASTLINE_BUFFER_RAW
        try:
            if _COASTLINE_BUFFER_RAW is None:
                geojson_path = os.path.join(settings.BASE_DIR, 'data', 'france_coastline_buffer_1km.geojson')
                if not os.path.exists(geojson_path):
                    return Response({'error': 'Coastline buffer GeoJSON file not found'}, status=status.HTTP_404_NOT_FOUND)
                with open(geojson_path, 'rb') as f:
                    _COASTLINE_BUFFER_RAW = f.read()

            response = HttpResponse(_COASTLINE_BUFFER_RAW, content_type='application/json')
            response['Cache-Control'] = 'public, max-age=86400, immutable'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_name='transition-zones', url_path='transition_zones')
    def transition_zones(self, request):
        """Get transition zones within a bounded viewport bbox."""
        try:
            bbox_str = request.query_params.get('bbox')
            if not bbox_str:
                return Response(
                    {'error': 'bbox parameter is required (min_lon,min_lat,max_lon,max_lat)'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            coords = [float(x) for x in bbox_str.split(',')]
            if len(coords) != 4:
                return Response(
                    {'error': 'bbox parameter must contain exactly 4 coordinates'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            min_lon, min_lat, max_lon, max_lat = coords
            bbox_area = abs(max_lon - min_lon) * abs(max_lat - min_lat)
            if bbox_area > MAX_TRANSITION_BBOX_DEG2:
                return Response(
                    {'error': f'bbox area too large ({bbox_area:.3f} deg² > {MAX_TRANSITION_BBOX_DEG2} deg²). Zoom in further.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            bbox_geom = box(min_lon, min_lat, max_lon, max_lat)
            ts = TerrainClassificationService.get_instance()

            center_lon = (min_lon + max_lon) / 2.0
            center_lat = (min_lat + max_lat) / 2.0
            radius_km = max(abs(max_lon - min_lon) * 111.0, abs(max_lat - min_lat) * 111.0) / 2.0 + 1.0
            gdf = ts._get_local_land_use_data(center_lon, center_lat, radius_km)

            possible_matches_index = gdf.sindex.query(bbox_geom, predicate="intersects")
            intersects = gdf.iloc[possible_matches_index]
            transition_geojson = compute_transition_zones_geojson(intersects)
            return Response(transition_geojson)
        except ValueError:
            return Response({'error': 'Invalid bbox coordinate values'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def region(self, request):
        """Get specific region boundary as GeoJSON from cached wind coefficient data."""
        region_id_raw = request.query_params.get('region_id')
        if not region_id_raw:
            return Response({'error': 'region_id parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            region_id = int(region_id_raw)
            if region_id not in [1, 2, 3, 4]:
                return Response({'error': 'Invalid region_id. Must be 1, 2, 3, or 4'}, status=status.HTTP_400_BAD_REQUEST)

            data = _load_wind_coeff_raw()
            v_b0_value = WIND_REGION_VB0[region_id]

            all_polygons = []
            for feature in data.get('features', []):
                if feature.get('properties', {}).get('V_B0') == v_b0_value:
                    geom = feature.get('geometry')
                    if geom.get('type') == 'MultiPolygon':
                        all_polygons.extend(geom.get('coordinates', []))
                    elif geom.get('type') == 'Polygon':
                        all_polygons.append(geom.get('coordinates', []))

            return Response({
                "type": "Feature",
                "properties": {
                    "region_id": region_id,
                    "name": f"Region {region_id}",
                    "description": REGION_DESCRIPTIONS[region_id],
                    "v_b0_value": v_b0_value,
                    "feature_count": len(all_polygons),
                },
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": all_polygons,
                },
            })
        except ValueError:
            return Response({'error': 'Invalid region_id format'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@cache_page(60 * 60)
def bdtopo_tile_proxy(request, z, x, y):
    """Proxy endpoint for IGN BDTOPO vector tiles using a pooled HTTP session."""
    try:
        ign_url = f'https://data.geopf.fr/tms/1.0.0/BDTOPO/{z}/{x}/{y}.pbf'
        response = _TILE_PROXY_SESSION.get(ign_url, timeout=10)
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', 'application/x-protobuf')
            return HttpResponse(response.content, content_type=content_type, status=response.status_code)
        return HttpResponse(b'', status=response.status_code)
    except requests.exceptions.RequestException as e:
        return HttpResponse(f'Error fetching tile: {str(e)}', status=502)
    except Exception as e:
        return HttpResponse(f'Server error: {str(e)}', status=500)

