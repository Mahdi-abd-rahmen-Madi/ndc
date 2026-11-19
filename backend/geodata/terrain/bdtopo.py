"""
IGN BDTOPO building footprint & density analysis service.
Uses batched cache lookup + concurrent ThreadPoolExecutor tile fetching
to eliminate sequential HTTP round-trip bottlenecks.
"""
import logging
import math
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple

import numpy as np
from django.core.cache import cache

from geodata.vector_tile_parser import create_vector_tile_parser

logger = logging.getLogger(__name__)


class BDTOPOService:
    """Service for analyzing building footprints using IGN BDTOPO vector tiles."""

    MAX_TILE_WORKERS = 6

    def __init__(self):
        self.cache_timeout = 3600  # 1 hour cache
        self._metrics_lock = threading.Lock()
        self._performance_metrics = {
            'cache_hits': 0,
            'cache_misses': 0,
            'tile_requests': 0,
            'building_analysis_time': deque(maxlen=1000),
        }
        self.parser = create_vector_tile_parser()

    def _fetch_and_parse_tile(self, tile: Tuple[int, int, int]) -> Tuple[str, List[dict]]:
        zoom, tile_x, tile_y = tile
        cache_key = f"bdtopo_buildings_{zoom}_{tile_x}_{tile_y}"
        tile_data = self.parser.fetch_tile(zoom, tile_x, tile_y)
        if not tile_data:
            return cache_key, []
        layers_features = self.parser.parse_vector_tile(tile_data, zoom, tile_x, tile_y)
        buildings = self.parser.extract_building_features(layers_features) or []
        return cache_key, buildings

    def get_building_footprints(self, longitude: float, latitude: float, radius_km: float = 2.0) -> List[dict]:
        """Get building footprints within `radius_km` of coordinates using concurrent tile fetching."""
        try:
            start_time = time.time()
            tiles = self.parser.get_tiles_for_area(longitude, latitude, radius_km)
            if not tiles:
                return []

            key_to_tile = {
                f"bdtopo_buildings_{z}_{x}_{y}": (z, x, y)
                for (z, x, y) in tiles
            }
            cached_map = cache.get_many(list(key_to_tile.keys()))

            all_buildings: List[dict] = []
            missing_tiles: List[Tuple[int, int, int]] = []

            for cache_key, tile in key_to_tile.items():
                if cache_key in cached_map and cached_map[cache_key] is not None:
                    with self._metrics_lock:
                        self._performance_metrics['cache_hits'] += 1
                    all_buildings.extend(cached_map[cache_key])
                else:
                    missing_tiles.append(tile)

            if missing_tiles:
                with self._metrics_lock:
                    self._performance_metrics['cache_misses'] += len(missing_tiles)
                    self._performance_metrics['tile_requests'] += len(missing_tiles)

                to_cache: Dict[str, List[dict]] = {}
                max_workers = min(self.MAX_TILE_WORKERS, len(missing_tiles))
                if max_workers <= 1:
                    for tile in missing_tiles:
                        c_key, buildings = self._fetch_and_parse_tile(tile)
                        if buildings:
                            to_cache[c_key] = buildings
                            all_buildings.extend(buildings)
                else:
                    with ThreadPoolExecutor(max_workers=max_workers) as pool:
                        futures = [pool.submit(self._fetch_and_parse_tile, tile) for tile in missing_tiles]
                        for fut in as_completed(futures):
                            try:
                                c_key, buildings = fut.result()
                                if buildings:
                                    to_cache[c_key] = buildings
                                    all_buildings.extend(buildings)
                            except Exception as tile_err:
                                logger.warning("Concurrent BDTOPO tile worker failed: %s", tile_err)

                if to_cache:
                    cache.set_many(to_cache, self.cache_timeout)

            filtered_buildings = self._filter_buildings_by_distance(
                all_buildings, longitude, latitude, radius_km
            )

            analysis_time = time.time() - start_time
            with self._metrics_lock:
                self._performance_metrics['building_analysis_time'].append(analysis_time)

            logger.debug(
                "Found %d buildings within %.1fkm of (%s, %s) in %.2fs (%d tiles fetched concurrently)",
                len(filtered_buildings),
                radius_km,
                longitude,
                latitude,
                analysis_time,
                len(missing_tiles),
            )
            return filtered_buildings

        except Exception as e:
            logger.error("Error getting building footprints: %s", e)
            return []

    def calculate_building_density(self, longitude: float, latitude: float, radius_km: float = 2.0) -> dict:
        """Calculate building density metrics for the specified area."""
        try:
            start_time = time.time()
            buildings = self.get_building_footprints(longitude, latitude, radius_km)
            if not buildings:
                return {
                    'building_count': 0,
                    'building_coverage_pct': 0.0,
                    'average_height': 0.0,
                    'max_height': 0.0,
                    'building_density_score': 0.0,
                }

            total_building_area = 0.0
            heights = []
            for building in buildings:
                props = building.get('properties', {})
                total_building_area += props.get('area_sqm', 0.0)
                height = props.get('height_m')
                if height is not None and height > 0:
                    heights.append(height)

            analysis_area_sqm = math.pi * (radius_km * 1000) ** 2
            building_coverage_pct = (total_building_area / analysis_area_sqm) * 100
            average_height = float(np.mean(heights)) if heights else 0.0
            max_height = float(max(heights)) if heights else 0.0

            coverage_score = min(building_coverage_pct * 2, 50)
            height_score = min(average_height / 15 * 50, 50)
            building_density_score = coverage_score + height_score

            result = {
                'building_count': len(buildings),
                'building_coverage_pct': building_coverage_pct,
                'average_height': average_height,
                'max_height': max_height,
                'building_density_score': building_density_score,
                'analysis_area_sqm': analysis_area_sqm,
                'total_building_area_sqm': total_building_area,
            }

            with self._metrics_lock:
                self._performance_metrics['building_analysis_time'].append(time.time() - start_time)

            logger.debug(
                "Building density metrics for (%s, %s): %d buildings, %.1f%% coverage, avg height %.1fm",
                longitude,
                latitude,
                len(buildings),
                building_coverage_pct,
                average_height,
            )
            return result

        except Exception as e:
            logger.error("Error calculating building density: %s", e)
            return {
                'building_count': 0,
                'building_coverage_pct': 0.0,
                'average_height': 0.0,
                'max_height': 0.0,
                'building_density_score': 0.0,
            }

    def analyze_building_heights(self, building_features: List[dict]) -> dict:
        """Analyze height distribution of building features."""
        try:
            heights = [
                b.get('properties', {}).get('height_m')
                for b in building_features
                if b.get('properties', {}).get('height_m') is not None
                and b.get('properties', {}).get('height_m') > 0
            ]
            if not heights:
                return {'count': 0, 'average': 0.0, 'median': 0.0, 'min': 0.0, 'max': 0.0, 'std_dev': 0.0}
            return {
                'count': len(heights),
                'average': float(np.mean(heights)),
                'median': float(np.median(heights)),
                'min': float(min(heights)),
                'max': float(max(heights)),
                'std_dev': float(np.std(heights)),
            }
        except Exception as e:
            logger.error("Error analyzing building heights: %s", e)
            return {'count': 0, 'average': 0.0, 'median': 0.0, 'min': 0.0, 'max': 0.0, 'std_dev': 0.0}

    def get_urban_density_score(self, longitude: float, latitude: float, radius_km: float = 2.0) -> float:
        """Get overall urban density score based on building analysis."""
        try:
            return self.calculate_building_density(longitude, latitude, radius_km).get('building_density_score', 0.0)
        except Exception as e:
            logger.error("Error getting urban density score: %s", e)
            return 0.0

    def _filter_buildings_by_distance(
        self,
        buildings: List[dict],
        longitude: float,
        latitude: float,
        radius_km: float,
    ) -> List[dict]:
        filtered = []
        for building in buildings:
            props = building.get('properties', {})
            centroid_lon = props.get('centroid_lon')
            centroid_lat = props.get('centroid_lat')
            if centroid_lon is not None and centroid_lat is not None:
                if self._calculate_distance(longitude, latitude, centroid_lon, centroid_lat) <= radius_km:
                    filtered.append(building)
        return filtered

    def _calculate_distance(self, lon1: float, lat1: float, lon2: float, lat2: float) -> float:
        """Haversine distance between two WGS84 points in kilometers."""
        R = 6371.0
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


bdtopo_service = BDTOPOService()

