"""
PostGIS & GeoJSON data access layer for terrain classification.
Reuses Django's managed PostgreSQL connection pool (zero duplicate SQLAlchemy pools)
with PostGIS SQL pushdown for metric spatial-extent area aggregation, wind region lookup,
and coastline proximity checks.
"""
import logging
import math
from typing import Dict, Optional

import geopandas as gpd
from django.conf import settings
from django.db import connection
from shapely.geometry import Point

logger = logging.getLogger(__name__)


def _is_sqlite_backend() -> bool:
    db_engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
    return 'sqlite' in db_engine


def query_spatial_extent_code_areas_sql(
    longitude: float,
    latitude: float,
    radius_km: float = 2.0,
) -> Optional[Dict[str, float]]:
    """
    PostGIS SQL pushdown: compute exact intersected area (m^2 in EPSG:2154)
    grouped by CLC `"Code_18"` directly in PostgreSQL C/GEOS.

    Returns `{code_18: area_m2}` on success, or `None` if PostGIS is unavailable
    so callers can transparently fall back to local GeoDataFrame computation.
    """
    if _is_sqlite_backend():
        return None

    try:
        radius_m = float(radius_km) * 1000.0
        sql = """
            WITH search_circle AS (
                SELECT ST_Buffer(
                    ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2154),
                    %s
                ) AS geom_2154
            ),
            search_env AS (
                SELECT ST_Transform(geom_2154, 4326) AS geom_4326, geom_2154
                FROM search_circle
            )
            SELECT
                l."Code_18" AS code,
                SUM(ST_Area(ST_Intersection(ST_Transform(l.geometry, 2154), e.geom_2154))) AS area_m2
            FROM land_use_data l, search_env e
            WHERE l.geometry && e.geom_4326
              AND ST_Intersects(ST_Transform(l.geometry, 2154), e.geom_2154)
            GROUP BY l."Code_18"
        """
        with connection.cursor() as cursor:
            cursor.execute(sql, [float(longitude), float(latitude), radius_m])
            rows = cursor.fetchall()

        if not rows:
            return {}
        return {str(row[0]): float(row[1] or 0.0) for row in rows if row[0] is not None}
    except Exception as e:
        logger.debug("PostGIS spatial extent pushdown unavailable, falling back to GeoPandas: %s", e)
        return None


def query_wind_vb0_sql(longitude: float, latitude: float) -> Optional[float]:
    """
    Query EC1 wind region V_B0 at (longitude, latitude) directly from PostGIS `ec1_wind_coeff`.
    Returns None if PostGIS or the `ec1_wind_coeff` table is unavailable (caller falls back to GeoJSON).
    """
    if _is_sqlite_backend():
        return None

    try:
        sql = """
            SELECT v_b0
            FROM ec1_wind_coeff
            WHERE ST_Intersects(geometry, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
            LIMIT 1
        """
        with connection.cursor() as cursor:
            cursor.execute(sql, [float(longitude), float(latitude)])
            row = cursor.fetchone()
        if row and row[0] is not None:
            return float(row[0])
        return None
    except Exception as e:
        logger.debug("PostGIS wind region query unavailable, falling back to GeoJSON: %s", e)
        return None


def is_point_near_coastline_sql(
    longitude: float,
    latitude: float,
    threshold_km: float = 1.0,
) -> Optional[bool]:
    """
    Check coastline proximity using PostGIS `france_coastline` (metric EPSG:2154 ST_DWithin).
    Returns True/False on success, or None if PostGIS / table is unavailable (caller falls back to GeoJSON).
    """
    if _is_sqlite_backend():
        return None

    try:
        threshold_m = float(threshold_km) * 1000.0
        sql = """
            SELECT EXISTS (
                SELECT 1
                FROM france_coastline
                WHERE ST_DWithin(
                    ST_Transform(geometry, 2154),
                    ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2154),
                    %s
                )
            )
        """
        with connection.cursor() as cursor:
            cursor.execute(sql, [float(longitude), float(latitude), threshold_m])
            row = cursor.fetchone()
        return bool(row[0]) if row else False
    except Exception as e:
        logger.debug("PostGIS coastline proximity query unavailable, falling back to GeoJSON: %s", e)
        return None


def fetch_local_land_use_gdf(
    longitude: float,
    latitude: float,
    radius_km: float = 6.0,
) -> gpd.GeoDataFrame:
    """Load land use data from PostGIS within a bounding box for spatial querying."""
    lat_rad = math.radians(latitude)
    km_per_deg_lat = 111.0
    km_per_deg_lon = max(111.0 * math.cos(lat_rad), 1e-6)

    radius_deg_lat = radius_km / km_per_deg_lat
    radius_deg_lon = radius_km / km_per_deg_lon

    minx = float(longitude - radius_deg_lon)
    miny = float(latitude - radius_deg_lat)
    maxx = float(longitude + radius_deg_lon)
    maxy = float(latitude + radius_deg_lat)

    logger.debug("Querying local land use data within bbox: %s", (minx, miny, maxx, maxy))

    from shapely import wkb

    sql = (
        "SELECT *, ST_AsBinary(geometry) AS _geom_wkb FROM land_use_data "
        "WHERE geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
    )
    with connection.cursor() as cursor:
        cursor.execute(sql, [minx, miny, maxx, maxy])
        columns = [col[0] for col in (cursor.description or [])]
        rows = cursor.fetchall()

    if not rows:
        return gpd.GeoDataFrame(columns=['Code_18', 'geometry'], geometry='geometry', crs='EPSG:4326')

    geom_idx = columns.index('_geom_wkb')
    prop_indices = [(i, name) for i, name in enumerate(columns) if name not in ('geometry', '_geom_wkb')]

    records = []
    geometries = []
    for row in rows:
        raw_wkb = row[geom_idx]
        geometries.append(wkb.loads(bytes(raw_wkb)) if raw_wkb is not None else None)
        records.append({name: row[i] for i, name in prop_indices})

    gdf = gpd.GeoDataFrame(records, geometry=geometries, crs='EPSG:4326')
    if not gdf.empty:
        gdf.sindex
    return gdf


def load_geojson_with_sindex(file_path: str, ensure_wgs84: bool = False) -> gpd.GeoDataFrame:
    """Load a static GeoJSON file and build its spatial index."""
    gdf = gpd.read_file(file_path)
    if ensure_wgs84:
        if gdf.crs is None:
            gdf = gdf.set_crs(epsg=4326)
        else:
            gdf = gdf.to_crs(epsg=4326)
    gdf.sindex
    return gdf


def is_point_near_coastline_gdf(
    coastline: gpd.GeoDataFrame,
    longitude: float,
    latitude: float,
    threshold_km: float = 1.0,
) -> bool:
    """Check whether (longitude, latitude) is within `threshold_km` of the coastline GeoDataFrame."""
    if coastline is None or len(coastline) == 0:
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
    possible_matches_index = list(coastline.sindex.intersection(search_bounds))
    if not possible_matches_index:
        return False

    possible_matches = coastline.iloc[possible_matches_index]
    for _, feature in possible_matches.iterrows():
        try:
            dist = point.distance(feature.geometry) * 111.0
            if dist <= threshold_km:
                return True
        except Exception:
            continue
    return False

