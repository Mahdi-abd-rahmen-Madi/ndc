"""Pure spatial-geometry metrics, proximity queries, and confidence scoring helpers."""
import logging
import math
from typing import Dict, Iterable, Optional

import geopandas as gpd
import numpy as np
from shapely.geometry import Point

from geodata.terrain_config_service import terrain_config_service

logger = logging.getLogger(__name__)


def get_spatial_category_code_sets() -> Dict[str, set]:
    """Read configured CLC spatial extent category code sets."""
    influence = terrain_config_service.get_influence_percentages()
    spatial_categories = influence.get('spatial_extent_categories', {})
    return {
        'agriculture': set(spatial_categories.get('agriculture', {}).get('codes', ['211', '212', '213', '231'])),
        'complex_agriculture': set(spatial_categories.get('complex_agriculture', {}).get('codes', ['241', '242', '243', '244'])),
        'forest': set(spatial_categories.get('forest', {}).get('codes', ['311', '312', '313', '321', '322', '323', '324'])),
        'urban': set(spatial_categories.get('urban', {}).get('codes', ['111', '112', '121', '122', '123', '124', '131', '132', '133', '142'])),
        'coastal': set(spatial_categories.get('coastal', {}).get('codes', ['521', '522', '523', '423', '331'])),
    }


def aggregate_code_areas_to_percentages(code_areas: Dict[str, float]) -> Dict[str, float]:
    """Convert `{clc_code: area}` into `{category_name: percentage}`."""
    if not code_areas:
        return {}
    total_area = sum(code_areas.values())
    if total_area <= 0:
        return {}

    category_sets = get_spatial_category_code_sets()
    extent_percentages = {}
    for category_name, code_set in category_sets.items():
        cat_area = sum(area for code, area in code_areas.items() if code in code_set)
        extent_percentages[category_name] = (cat_area / total_area) * 100.0
    return extent_percentages


def compute_spatial_extent_from_gdf(
    longitude: float,
    latitude: float,
    gdf: gpd.GeoDataFrame,
    radius_km: float = 2.0,
) -> Dict[str, float]:
    """Fallback GeoPandas computation of spatial extent percentages when SQL pushdown isn't used."""
    if gdf is None or len(gdf) == 0:
        return {}

    point = Point(longitude, latitude)
    radius_deg_lat = radius_km / 111.0
    search_area = point.buffer(radius_deg_lat)
    intersects = gdf[gdf.geometry.intersects(search_area)]

    if len(intersects) == 0:
        return {}

    clipped = intersects.copy()
    clipped['geometry'] = clipped.geometry.intersection(search_area)
    if clipped.crs is None:
        clipped = clipped.set_crs(epsg=4326)
    clipped['geometry'] = clipped['geometry'].to_crs('EPSG:32631')
    clipped['area_km2'] = clipped.geometry.area / 1_000_000.0
    total_area = clipped['area_km2'].sum()
    if total_area <= 0:
        return {}

    code_areas = clipped.groupby('Code_18')['area_km2'].sum().to_dict()
    return aggregate_code_areas_to_percentages({str(k): float(v) for k, v in code_areas.items()})


def is_near_codes(
    longitude: float,
    latitude: float,
    gdf: gpd.GeoDataFrame,
    codes: Iterable[str],
    threshold_km: float,
    check_exact_distance: bool = True,
) -> bool:
    """Unified spatial-index-accelerated proximity check for any set of CLC codes."""
    if gdf is None or len(gdf) == 0:
        return False

    matching = gdf[gdf['Code_18'].isin(codes)]
    if len(matching) == 0:
        return False

    point = Point(longitude, latitude)
    lat_rad = math.radians(latitude)
    km_per_deg_lat = 111.0
    km_per_deg_lon = max(111.0 * math.cos(lat_rad), 1e-6)
    threshold_deg_lat = threshold_km / km_per_deg_lat
    threshold_deg_lon = threshold_km / km_per_deg_lon

    search_bounds = (
        longitude - threshold_deg_lon,
        latitude - threshold_deg_lat,
        longitude + threshold_deg_lon,
        latitude + threshold_deg_lat,
    )
    possible_matches_index = list(matching.sindex.intersection(search_bounds))
    if not possible_matches_index:
        return False

    possible_matches = matching.iloc[possible_matches_index]
    search_area = point.buffer(threshold_deg_lat)
    if len(possible_matches[possible_matches.geometry.intersects(search_area)]) > 0:
        return True

    if check_exact_distance:
        for _, feature in possible_matches.iterrows():
            try:
                if point.distance(feature.geometry) * 111.0 <= threshold_km:
                    return True
            except Exception:
                continue
    return False


def calculate_distance_to_codes(
    longitude: float,
    latitude: float,
    gdf: gpd.GeoDataFrame,
    codes: Iterable[str],
) -> float:
    """Return approximate distance in km to nearest polygon matching `codes`."""
    if gdf is None or len(gdf) == 0 or not codes:
        return float('inf')

    matching = gdf[gdf['Code_18'].isin(codes)]
    if len(matching) == 0:
        return float('inf')

    point = Point(longitude, latitude)
    min_distance_deg = matching.geometry.distance(point).min()
    return float(min_distance_deg) * 111.0


def optimized_spatial_query(point: Point, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Indexed point-in-polygon query with safe fallback."""
    try:
        possible_matches_index = list(gdf.sindex.intersection(point.bounds))
        if not possible_matches_index:
            return gpd.GeoDataFrame()
        possible_matches = gdf.iloc[possible_matches_index]
        return possible_matches[possible_matches.geometry.intersects(point)]
    except Exception as e:
        logger.debug("Error in optimized spatial query: %s", e)
        return gdf[gdf.geometry.intersects(point)]


def calculate_data_consistency(multi_scale_data: Dict[float, dict]) -> float:
    """Calculate data consistency across different radii."""
    if len(multi_scale_data) < 2:
        return 0.5

    scales = sorted(multi_scale_data.keys())
    consistency_scores = []
    categories = ['agriculture', 'complex_agriculture', 'forest', 'urban', 'coastal']

    for i in range(len(scales) - 1):
        s1 = multi_scale_data[scales[i]]
        s2 = multi_scale_data[scales[i + 1]]
        values1 = [s1.get(cat, 0) for cat in categories]
        values2 = [s2.get(cat, 0) for cat in categories]
        if sum(values1) > 0 and sum(values2) > 0:
            corr = sum(min(v1, v2) for v1, v2 in zip(values1, values2)) / max(sum(values1), sum(values2))
            consistency_scores.append(corr)

    return float(np.mean(consistency_scores)) if consistency_scores else 0.5


def calculate_terrain_clarity(terrain_type: str, multi_scale_data: Dict[float, dict]) -> float:
    """Calculate how clearly the terrain type is expressed in the spatial data."""
    terrain_signatures = {
        '0': {'coastal': 60.0},
        'II': {'agriculture': 50.0},
        'IIIa': {'complex_agriculture': 15.0, 'forest': 20.0},
        'IIIb': {'urban': 40.0},
        'IV': {'urban': 70.0},
    }
    signature = terrain_signatures.get(terrain_type, {})
    if not signature:
        return 0.5

    clarity_scores = []
    for _, data in multi_scale_data.items():
        scale_clarity = 0.0
        for category, expected_threshold in signature.items():
            actual_pct = data.get(category, 0)
            scale_clarity += 1.0 if actual_pct >= expected_threshold else (actual_pct / expected_threshold)
        clarity_scores.append(scale_clarity / len(signature))

    return float(np.mean(clarity_scores)) if clarity_scores else 0.5


def calculate_spatial_homogeneity(multi_scale_data: Dict[float, dict]) -> float:
    """Calculate spatial homogeneity via normalized inverse Shannon entropy."""
    homogeneity_scores = []
    categories = ['agriculture', 'complex_agriculture', 'forest', 'urban', 'coastal']

    for _, data in multi_scale_data.items():
        values = [data.get(cat, 0) for cat in categories]
        total = sum(values)
        if total == 0:
            homogeneity_scores.append(0.5)
            continue

        probabilities = [v / total for v in values if v > 0]
        if len(probabilities) <= 1:
            homogeneity_scores.append(1.0)
            continue

        entropy = -sum(p * math.log(p) for p in probabilities)
        max_entropy = math.log(len(probabilities))
        homogeneity_scores.append(1.0 - (entropy / max_entropy))

    return float(np.mean(homogeneity_scores)) if homogeneity_scores else 0.5

