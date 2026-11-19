"""
PostGIS & GeoJSON data access layer for terrain classification.
Includes pooled SQLAlchemy engine management and PostGIS SQL pushdown for
metric spatial-extent area aggregation (EPSG:2154 Lambert-93).
"""
import logging
import math
import os
import threading
from typing import Dict, Optional

import geopandas as gpd
from django.conf import settings
from shapely.geometry import Point

logger = logging.getLogger(__name__)

_land_use_engine = None
_engine_lock = threading.Lock()


def _get_land_use_engine():
    """Return a shared pooled SQLAlchemy engine for PostGIS land_use_data queries."""
    global _land_use_engine
    if _land_use_engine is None:
        with _engine_lock:
            if _land_use_engine is None:
                from sqlalchemy import create_engine
                from sqlalchemy.engine import URL

                db_settings = settings.DATABASES['default']
                url = URL.create(
                    drivername="postgresql+psycopg",
                    username=db_settings.get('USER') or None,
                    password=db_settings.get('PASSWORD') or None,
                    host=db_settings.get('HOST') or 'localhost',
                    port=int(db_settings.get('PORT') or 5432),
                    database=db_settings.get('NAME') or None,
                )
                _land_use_engine = create_engine(
                    url,
                    pool_pre_ping=True,
                    pool_size=5,
                    max_overflow=10,
                )
    return _land_use_engine


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
    db_engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
    if 'sqlite' in db_engine:
        return None

    try:
        from sqlalchemy import text

        engine = _get_land_use_engine()
        radius_m = float(radius_km) * 1000.0
        sql = text(
            """
            WITH search_circle AS (
                SELECT ST_Buffer(
                    ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 2154),
                    :radius_m
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
        )
        with engine.connect() as conn:
            rows = conn.execute(
                sql,
                {"lon": float(longitude), "lat": float(latitude), "radius_m": radius_m},
            ).fetchall()

        if not rows:
            return {}
        return {str(row[0]): float(row[1] or 0.0) for row in rows if row[0] is not None}
    except Exception as e:
        logger.debug("PostGIS spatial extent pushdown unavailable, falling back to GeoPandas: %s", e)
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

    from sqlalchemy import text

    engine = _get_land_use_engine()
    sql = text(
        "SELECT * FROM land_use_data "
        "WHERE geometry && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)"
    )
    with engine.connect() as conn:
        gdf = gpd.read_postgis(
            sql,
            conn,
            params={"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy},
            geom_col='geometry',
        )

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

