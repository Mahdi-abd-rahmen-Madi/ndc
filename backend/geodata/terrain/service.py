"""
Core TerrainClassificationService orchestrator composing:
- PostGIS & GeoJSON repository (`terrain.repository`)
- PostGIS SQL pushdown + GeoPandas fallback (`terrain.spatial_metrics`)
- Rule engine (`terrain.rules`)
"""
import gc
import logging
import os
import threading
import time
from collections import deque
from typing import Dict, List, Optional

import geopandas as gpd
import numpy as np
from django.conf import settings
from django.core.cache import cache
from shapely.geometry import Point

from geodata.models import AntennaEquipment
from geodata.terrain_config_service import terrain_config_service
from .repository import (
    fetch_local_land_use_gdf,
    is_point_near_coastline_gdf,
    is_point_near_coastline_sql,
    load_geojson_with_sindex,
    query_spatial_extent_code_areas_sql,
    query_wind_vb0_sql,
)
from .rules import TerrainRuleEngineMixin
from .spatial_metrics import (
    aggregate_code_areas_to_percentages,
    calculate_data_consistency,
    calculate_distance_to_codes,
    calculate_spatial_homogeneity,
    calculate_terrain_clarity,
    compute_spatial_extent_from_gdf,
    optimized_spatial_query,
)

logger = logging.getLogger(__name__)

_terrain_service_instance = None
_service_lock = threading.Lock()


class TerrainClassificationService(TerrainRuleEngineMixin):
    """Service for terrain classification using PostGIS land use data and EC1 rules."""

    def __init__(self):
        self.land_use_data = None
        self.land_use_file = os.path.join(settings.BASE_DIR, 'data', 'OS_FRANCE.fgb')
        self.wind_coeff_data = None
        self.wind_coeff_file = os.path.join(settings.BASE_DIR, 'data', 'ec1_windCoeff.geojson')
        self.coastline_data = None
        self.coastline_file = os.path.join(settings.BASE_DIR, 'data', 'france_coastline.geojson')
        self.cache_timeout = 3600
        self._thread_local = threading.local()
        self._data_lock = threading.Lock()
        self._performance_metrics = {
            'cache_hits': 0,
            'cache_misses': 0,
            'spatial_queries': 0,
            'sql_pushdown_hits': 0,
            'classification_time': deque(maxlen=1000),
        }

    @classmethod
    def get_instance(cls):
        global _terrain_service_instance
        if _terrain_service_instance is None:
            with _service_lock:
                if _terrain_service_instance is None:
                    _terrain_service_instance = cls()
                    logger.info("Created new TerrainClassificationService singleton instance")
        return _terrain_service_instance

    # ------------------------------------------------------------------
    # Data Loading
    # ------------------------------------------------------------------

    def _get_local_land_use_data(self, longitude: float, latitude: float, radius_km: float = 6.0) -> gpd.GeoDataFrame:
        try:
            return fetch_local_land_use_gdf(longitude, latitude, radius_km=radius_km)
        except Exception as e:
            logger.error("Failed to load local land use data: %s", e)
            raise

    def _load_wind_coeff_data(self):
        if self.wind_coeff_data is None:
            with self._data_lock:
                if self.wind_coeff_data is None:
                    try:
                        self.wind_coeff_data = load_geojson_with_sindex(self.wind_coeff_file, ensure_wgs84=False)
                        logger.info("Loaded %d wind coefficient regions", len(self.wind_coeff_data))
                    except Exception as e:
                        logger.error("Failed to load wind coefficient data: %s", e)
                        raise
        return self.wind_coeff_data

    def _load_coastline_data(self):
        if self.coastline_data is None:
            with self._data_lock:
                if self.coastline_data is None:
                    try:
                        self.coastline_data = load_geojson_with_sindex(self.coastline_file, ensure_wgs84=True)
                        logger.info("Loaded %d coastline features", len(self.coastline_data))
                    except Exception as e:
                        logger.error("Failed to load coastline data: %s", e)
                        raise
        return self.coastline_data

    def _is_near_physical_coastline(self, longitude: float, latitude: float, threshold_km: float = 1.0) -> bool:
        sql_hit = is_point_near_coastline_sql(longitude, latitude, threshold_km=threshold_km)
        if sql_hit is not None:
            return sql_hit
        try:
            coastline = self._load_coastline_data()
            return is_point_near_coastline_gdf(coastline, longitude, latitude, threshold_km=threshold_km)
        except Exception as e:
            logger.error("Error checking proximity to physical coastline: %s", e)
            return False

    # ------------------------------------------------------------------
    # Public Classification API
    # ------------------------------------------------------------------

    def get_region_from_coordinates(self, longitude: float, latitude: float) -> Optional[int]:
        try:
            sql_vb0 = query_wind_vb0_sql(longitude, latitude)
            if sql_vb0 is not None:
                region = AntennaEquipment.get_region_from_vb0(sql_vb0)
                if region is not None:
                    logger.debug("PostGIS region hit (%s, %s) -> V_B0: %s -> Region: %s", longitude, latitude, sql_vb0, region)
                    return region

            gdf = self._load_wind_coeff_data()
            point = Point(longitude, latitude)
            intersects = gdf[gdf.geometry.intersects(point)]
            if len(intersects) > 0:
                v_b0 = intersects.iloc[0]['V_B0']
                region = AntennaEquipment.get_region_from_vb0(v_b0)
                logger.debug("Coordinates (%s, %s) -> V_B0: %s -> Region: %s", longitude, latitude, v_b0, region)
                return region
            logger.warning("No wind coefficient region found at coordinates (%s, %s)", longitude, latitude)
            return None
        except Exception as e:
            logger.error("Error determining region for coordinates (%s, %s): %s", longitude, latitude, e)
            return None

    def get_terrain_type_at_coordinates(self, longitude: float, latitude: float) -> Optional[str]:
        start_time = time.time()
        self._thread_local.memo = {}
        self._performance_metrics['cache_misses'] += 1

        try:
            gdf = self._get_local_land_use_data(longitude, latitude)
            point = Point(longitude, latitude)
            intersects = self._optimized_spatial_query(point, gdf)

            if len(intersects) > 0:
                clc_code = intersects.iloc[0]['Code_18']
                terrain_type = terrain_config_service.get_terrain_type_from_clc_code(clc_code)
                terrain_type, confidence_score = self._apply_enhanced_rules_with_confidence(
                    terrain_type, longitude, latitude, gdf
                )
                self._performance_metrics['classification_time'].append(time.time() - start_time)
                logger.debug(
                    "Coordinates (%s, %s) -> CLC: %s -> Terrain: %s (Confidence: %.2f)",
                    longitude, latitude, clc_code, terrain_type, confidence_score,
                )
                return terrain_type

            if self._is_near_physical_coastline(longitude, latitude, threshold_km=1.0):
                self._performance_metrics['classification_time'].append(time.time() - start_time)
                return '0'

            logger.warning("No land use data found at coordinates (%s, %s)", longitude, latitude)
            self._performance_metrics['classification_time'].append(time.time() - start_time)
            return None
        except Exception as e:
            logger.error("Error determining terrain type at coordinates (%s, %s): %s", longitude, latitude, e)
            self._performance_metrics['classification_time'].append(time.time() - start_time)
            return None

    def get_terrain_confidence(self, longitude: float, latitude: float) -> float:
        confidence_cache_key = f"confidence_{longitude:.6f}_{latitude:.6f}"
        cached_confidence = cache.get(confidence_cache_key)
        if cached_confidence is not None:
            return cached_confidence
        self.get_terrain_type_at_coordinates(longitude, latitude)
        return cache.get(confidence_cache_key, 0.0)

    def get_terrain_classification_details(self, longitude: float, latitude: float) -> dict:
        try:
            self._thread_local.memo = {}
            gdf = self._get_local_land_use_data(longitude, latitude)
            point = Point(longitude, latitude)
            intersects = self._optimized_spatial_query(point, gdf)

            if len(intersects) > 0:
                clc_code = intersects.iloc[0]['Code_18']
                base_terrain_type = terrain_config_service.get_terrain_type_from_clc_code(clc_code)
                final_terrain_type, confidence_score = self._apply_enhanced_rules_with_confidence(
                    base_terrain_type, longitude, latitude, gdf
                )
                detected_clc_codes = intersects['Code_18'].unique().tolist()

                rule_scores = self._calculate_weighted_rule_scores(base_terrain_type, longitude, latitude, gdf)
                scored_rules = [
                    (name, rule, score)
                    for name, rule, score in rule_scores
                    if rule.get('enabled', True) and score > 0
                ]
                scored_rules.sort(key=lambda x: (x[1].get('priority', 999), -x[2]))

                applicable_rules = []
                rule_explanations = {}

                initial_terrain = base_terrain_type
                if scored_rules:
                    rule_name, rule, score = scored_rules[0]
                    initial_terrain = self._get_rule_result(rule_name, base_terrain_type, longitude, latitude, gdf)

                is_revert_override = (
                    initial_terrain == 'IV'
                    and final_terrain_type in ['II', 'IIIa']
                    and base_terrain_type == final_terrain_type
                )
                is_transition_override = (
                    initial_terrain == 'IV'
                    and final_terrain_type == 'IIIa'
                    and base_terrain_type != 'IIIa'
                )

                if is_revert_override:
                    applicable_rules.append({
                        'name': 'terrain_base_preservation',
                        'priority': 1.0,
                        'description': f'Preserve base terrain: Points inside base Terrain {base_terrain_type} polygons stay as Terrain {base_terrain_type} and are not elevated to Terrain IV',
                        'score': 100.0,
                    })
                    rule_explanations['terrain_base_preservation'] = (
                        f"Base preservation override applied: Location belongs to base Terrain {base_terrain_type} (CLC {clc_code}) and is preserved."
                    )
                elif is_transition_override:
                    clc_mappings = terrain_config_service.get_clc_code_mappings()
                    target_codes = (
                        list(clc_mappings.get('terrain_II', {}).get('codes', []))
                        + list(clc_mappings.get('terrain_IIIa', {}).get('codes', []))
                    )
                    min_dist_km = calculate_distance_to_codes(longitude, latitude, gdf, target_codes)
                    if min_dist_km == float('inf'):
                        min_dist_km = 0.0
                    applicable_rules.append({
                        'name': 'terrain_transition_penetration',
                        'priority': 1.0,
                        'description': 'Transition penetration override: Rural/agricultural terrains (II or IIIa) penetrate into Terrain IV up to 50m, converting it to Terrain IIIa',
                        'score': 100.0,
                    })
                    rule_explanations['terrain_transition_penetration'] = (
                        f"Transition override applied: classified as IIIa because the location is within 50m "
                        f"({min_dist_km * 1000.0:.1f}m) of a Terrain II/IIIa boundary, penetrating Terrain IV."
                    )
                elif scored_rules:
                    rule_name, rule, score = scored_rules[0]
                    applicable_rules.append({
                        'name': rule_name,
                        'priority': rule.get('priority', 999),
                        'description': rule.get('description', ''),
                        'score': score,
                    })
                    rule_explanations[rule_name] = self._generate_rule_explanation(
                        rule_name, rule, base_terrain_type, longitude, latitude, gdf
                    )

                return {
                    'base_terrain_type': base_terrain_type,
                    'terrain_type': final_terrain_type,
                    'confidence_score': confidence_score,
                    'detected_clc_codes': detected_clc_codes,
                    'primary_clc_code': clc_code,
                    'applicable_rules': applicable_rules,
                    'rule_explanations': rule_explanations,
                }

            if self._is_near_physical_coastline(longitude, latitude, threshold_km=1.0):
                rule = terrain_config_service.get_classification_rules().get('coastline_proximity_1km', {})
                return {
                    'base_terrain_type': '0',
                    'terrain_type': '0',
                    'confidence_score': 0.95,
                    'detected_clc_codes': [],
                    'primary_clc_code': None,
                    'applicable_rules': [{
                        'name': 'coastline_proximity_1km',
                        'priority': rule.get('priority', 1.5),
                        'description': rule.get('description', ''),
                        'score': 100.0,
                    }],
                    'rule_explanations': {
                        'coastline_proximity_1km': "Coastline proximity: Within 1.0km of the physical coastline",
                    },
                }

            return {
                'base_terrain_type': None,
                'terrain_type': None,
                'confidence_score': 0.0,
                'detected_clc_codes': [],
                'primary_clc_code': None,
                'applicable_rules': [],
                'rule_explanations': {},
            }
        except Exception as e:
            logger.error("Error getting terrain classification details at (%s, %s): %s", longitude, latitude, e)
            return {
                'base_terrain_type': None,
                'terrain_type': None,
                'confidence_score': 0.0,
                'detected_clc_codes': [],
                'primary_clc_code': None,
                'applicable_rules': [],
                'rule_explanations': {},
            }

    def detect_clc_codes_at_coordinates(self, longitude: float, latitude: float) -> List[str]:
        try:
            gdf = self._get_local_land_use_data(longitude, latitude)
            intersects = self._optimized_spatial_query(Point(longitude, latitude), gdf)
            return intersects['Code_18'].unique().tolist() if len(intersects) > 0 else []
        except Exception as e:
            logger.error("Error detecting CLC codes at (%s, %s): %s", longitude, latitude, e)
            return []

    def get_clc_codes_in_extent(self, longitude: float, latitude: float, radius_km: float = 2.0) -> List[str]:
        try:
            gdf = self._get_local_land_use_data(longitude, latitude, max(radius_km, 6.0))
            search_area = Point(longitude, latitude).buffer(radius_km / 111.0)
            intersects = gdf[gdf.geometry.intersects(search_area)]
            return intersects['Code_18'].unique().tolist() if len(intersects) > 0 else []
        except Exception as e:
            logger.error("Error detecting CLC codes in extent of (%s, %s): %s", longitude, latitude, e)
            return []

    def get_terrain_type_for_equipment(self, equipment) -> Optional[str]:
        if hasattr(equipment, 'longitude') and hasattr(equipment, 'latitude'):
            return self.get_terrain_type_at_coordinates(float(equipment.longitude), float(equipment.latitude))
        logger.warning("Equipment %s has no coordinates", getattr(equipment, 'id', '?'))
        return None

    def batch_classify_coordinates(self, coordinates: list) -> list:
        start_time = time.time()
        results = [self.get_terrain_type_at_coordinates(lon, lat) for lon, lat in coordinates]
        logger.info("Batch classified %d coordinates in %.3fs", len(coordinates), time.time() - start_time)
        return results

    # ------------------------------------------------------------------
    # Spatial Extent (PostGIS SQL Pushdown + GeoPandas Fallback)
    # ------------------------------------------------------------------

    def _optimized_spatial_query(self, point: Point, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        self._performance_metrics['spatial_queries'] += 1
        return optimized_spatial_query(point, gdf)

    def _multi_scale_analysis(self, longitude: float, latitude: float, gdf, scales: List[float] = None, memo: dict = None) -> Dict[float, dict]:
        if scales is None:
            scales = [0.5, 1.0, 2.0, 5.0]
        if not hasattr(self._thread_local, 'memo'):
            self._thread_local.memo = {}
        results = {}
        for scale in scales:
            if scale in self._thread_local.memo:
                results[scale] = self._thread_local.memo[scale]
            else:
                extent_data = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, scale)
                self._thread_local.memo[scale] = extent_data
                results[scale] = extent_data
        return results

    def _calculate_spatial_extent_percentages(self, longitude: float, latitude: float, gdf, radius_km: float = 1.0) -> dict:
        cache_key = f"spatial_extent_{longitude:.6f}_{latitude:.6f}_{radius_km:.1f}"
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            self._performance_metrics['cache_hits'] += 1
            return cached_result

        try:
            result = self._compute_spatial_extent_percentages(longitude, latitude, gdf, radius_km)
            cache.set(cache_key, result, 7200)
            return result
        except Exception as e:
            logger.debug("Error calculating spatial extent percentages: %s", e)
            return {}

    def _compute_spatial_extent_percentages(self, longitude: float, latitude: float, gdf, radius_km: float = 2.0) -> dict:
        # Fast path: PostGIS SQL pushdown computes exact metric area in C/GEOS
        code_areas = query_spatial_extent_code_areas_sql(longitude, latitude, radius_km=radius_km)
        if code_areas is not None:
            self._performance_metrics['sql_pushdown_hits'] += 1
            return aggregate_code_areas_to_percentages(code_areas)

        # Graceful fallback for SQLite/unit tests or synthetic GeoDataFrames
        return compute_spatial_extent_from_gdf(longitude, latitude, gdf, radius_km=radius_km)

    # ------------------------------------------------------------------
    # Confidence & Metrics
    # ------------------------------------------------------------------

    def _calculate_base_confidence(self, terrain_type: str, longitude: float, latitude: float, gdf) -> float:
        try:
            multi_scale_data = self._multi_scale_analysis(longitude, latitude, gdf, [1.0, 2.0])
            confidence = (
                self._calculate_data_consistency(multi_scale_data) * 0.4
                + self._calculate_terrain_clarity(terrain_type, multi_scale_data) * 0.4
                + self._calculate_spatial_homogeneity(multi_scale_data) * 0.2
            )
            return min(max(confidence, 0.1), 1.0)
        except Exception as e:
            logger.debug("Error calculating base confidence: %s", e)
            return 0.5

    def _calculate_data_consistency(self, multi_scale_data: Dict[float, dict]) -> float:
        return calculate_data_consistency(multi_scale_data)

    def _calculate_terrain_clarity(self, terrain_type: str, multi_scale_data: Dict[float, dict]) -> float:
        return calculate_terrain_clarity(terrain_type, multi_scale_data)

    def _calculate_spatial_homogeneity(self, multi_scale_data: Dict[float, dict]) -> float:
        return calculate_spatial_homogeneity(multi_scale_data)

    def _get_adaptive_cache_timeout(self, terrain_type: str) -> int:
        return {'0': 7200, 'IV': 3600, 'IIIb': 1800, 'IIIa': 1800, 'II': 3600}.get(terrain_type, self.cache_timeout)

    def get_performance_metrics(self) -> dict:
        metrics = {
            **self._performance_metrics,
            'classification_time': list(self._performance_metrics['classification_time']),
        }
        total_requests = metrics['cache_hits'] + metrics['cache_misses']
        cache_hit_rate = metrics['cache_hits'] / total_requests if total_requests > 0 else 0
        avg_classification_time = float(np.mean(metrics['classification_time'])) if metrics['classification_time'] else 0.0
        metrics.update({
            'cache_hit_rate': round(cache_hit_rate, 3),
            'avg_classification_time_ms': round(avg_classification_time * 1000, 2),
            'total_requests': total_requests,
            'spatial_index_count': int(self.wind_coeff_data is not None) + int(self.coastline_data is not None),
        })
        return metrics

    def reset_performance_metrics(self):
        self._performance_metrics = {
            'cache_hits': 0,
            'cache_misses': 0,
            'spatial_queries': 0,
            'sql_pushdown_hits': 0,
            'classification_time': deque(maxlen=1000),
        }

    def clear_cache(self, pattern: str = None):
        if hasattr(cache, 'keys'):
            if pattern:
                cache.delete_many([key for key in cache.keys(pattern) if key.startswith(pattern)])
            else:
                cache.delete_many([key for key in cache.keys('terrain_*')])
                cache.delete_many([key for key in cache.keys('spatial_*')])
        else:
            cache.clear()
        logger.info("Cleared cache%s", f" for pattern: {pattern}" if pattern else "")

    def optimize_memory_usage(self):
        gc.collect()
        logger.info("Memory usage optimization completed")


terrain_service = TerrainClassificationService.get_instance()

