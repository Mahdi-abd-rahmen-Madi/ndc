"""
Vector Tile Parser for IGN BDTOPO Data

This module provides utilities for parsing Mapbox Vector Tiles (MVT) from IGN BDTOPO service
and extracting building features with geometry, properties, and metrics.
"""

import logging
import math
from typing import Dict, List, Any, Optional, Tuple
import mapbox_vector_tile
import requests
from shapely.geometry import Polygon, Point, shape
from shapely.ops import transform
from functools import partial
import pyproj

logger = logging.getLogger(__name__)

# BDTOPO configuration based on CAELUS implementation
BDTOPO_CONFIG = {
    'base_url': 'https://data.geopf.fr/tms/1.0.0/BDTOPO/{z}/{x}/{y}.pbf',
    'building_layers': ['batiment', 'construction_surfacique', 'construction_lineaire', 'construction_ponctuelle', 'building', 'buildings', 'bati', 'BATIMENT'],
    'min_zoom': 15,  # Buildings only appear at zoom 15+
    'max_zoom': 20,
    'attribution': '© IGN'
}

# Coordinate transformation from Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)
wgs84 = pyproj.CRS('EPSG:4326')
web_mercator = pyproj.CRS('EPSG:3857')
transform_to_wgs84 = pyproj.Transformer.from_crs(web_mercator, wgs84, always_xy=True).transform

def web_mercator_to_wgs84(x: float, y: float) -> Tuple[float, float]:
    """Convert Web Mercator coordinates to WGS84."""
    return transform_to_wgs84(x, y)


class VectorTileParser:
    """Parser for IGN BDTOPO vector tiles."""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or BDTOPO_CONFIG
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'NDC-BDTOPO-Service/1.0'
        })
    
    def fetch_tile(self, z: int, x: int, y: int) -> Optional[bytes]:
        """
        Fetch vector tile data from IGN BDTOPO service.
        
        Args:
            z: Zoom level
            x: Tile X coordinate
            y: Tile Y coordinate
            
        Returns:
            Raw tile data as bytes, or None if fetch failed
        """
        url = self.config['base_url'].format(z=z, x=x, y=y)
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            if response.content:
                logger.debug(f"Successfully fetched tile {z}/{x}/{y} ({len(response.content)} bytes)")
                return response.content
            else:
                logger.warning(f"Empty tile response for {z}/{x}/{y}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch tile {z}/{x}/{y}: {e}")
            return None
    
    def parse_vector_tile(self, tile_data: bytes) -> Dict[str, List[Dict]]:
        """
        Parse vector tile data and extract features by layer.
        
        Args:
            tile_data: Raw MVT tile data
            
        Returns:
            Dictionary mapping layer names to feature lists
        """
        try:
            # Decode the vector tile
            decoded = mapbox_vector_tile.decode(tile_data)
            
            layers_features = {}
            for layer_name, layer_data in decoded.items():
                features = []
                for feature in layer_data.get('features', []):
                    # Convert feature to GeoJSON-like format
                    geojson_feature = self._convert_feature_to_geojson(feature)
                    if geojson_feature:
                        features.append(geojson_feature)
                
                if features:
                    layers_features[layer_name] = features
                    logger.debug(f"Parsed {len(features)} features from layer '{layer_name}'")
            
            return layers_features
            
        except Exception as e:
            logger.error(f"Failed to parse vector tile: {e}")
            return {}
    
    def _convert_feature_to_geojson(self, feature: Dict) -> Optional[Dict]:
        """Convert vector tile feature to GeoJSON format."""
        try:
            # Extract geometry
            geometry = feature.get('geometry')
            if not geometry:
                return None
            
            # Convert vector tile coordinates to geographic coordinates
            # Vector tiles use Web Mercator, need to transform to WGS84
            transformed_geometry = self._transform_geometry(geometry)
            
            # Extract properties
            properties = feature.get('properties', {})
            
            return {
                'type': 'Feature',
                'geometry': transformed_geometry,
                'properties': properties
            }
            
        except Exception as e:
            logger.warning(f"Failed to convert feature to GeoJSON: {e}")
            return None
    
    def _transform_geometry(self, geometry: Dict) -> Optional[Dict]:
        """Transform geometry from Web Mercator to WGS84."""
        try:
            if geometry['type'] == 'Polygon':
                # Transform each coordinate in the polygon
                transformed_coords = []
                for ring in geometry['coordinates']:
                    transformed_ring = []
                    for coord in ring:
                        # Transform from Web Mercator to WGS84
                        lon, lat = web_mercator_to_wgs84(coord[0], coord[1])
                        transformed_ring.append([lon, lat])
                    transformed_coords.append(transformed_ring)
                
                return {
                    'type': 'Polygon',
                    'coordinates': transformed_coords
                }
            
            elif geometry['type'] == 'MultiPolygon':
                transformed_coords = []
                for polygon in geometry['coordinates']:
                    transformed_polygon = []
                    for ring in polygon:
                        transformed_ring = []
                        for coord in ring:
                            lon, lat = web_mercator_to_wgs84(coord[0], coord[1])
                            transformed_ring.append([lon, lat])
                        transformed_polygon.append(transformed_ring)
                    transformed_coords.append(transformed_polygon)
                
                return {
                    'type': 'MultiPolygon',
                    'coordinates': transformed_coords
                }
            
            elif geometry['type'] == 'LineString':
                # Transform each coordinate in the linestring
                transformed_coords = []
                for coord in geometry['coordinates']:
                    lon, lat = web_mercator_to_wgs84(coord[0], coord[1])
                    transformed_coords.append([lon, lat])
                
                return {
                    'type': 'LineString',
                    'coordinates': transformed_coords
                }
            
            elif geometry['type'] == 'MultiLineString':
                transformed_coords = []
                for line in geometry['coordinates']:
                    transformed_line = []
                    for coord in line:
                        lon, lat = web_mercator_to_wgs84(coord[0], coord[1])
                        transformed_line.append([lon, lat])
                    transformed_coords.append(transformed_line)
                
                return {
                    'type': 'MultiLineString',
                    'coordinates': transformed_coords
                }
            
            elif geometry['type'] == 'Point':
                # Transform point coordinate
                lon, lat = web_mercator_to_wgs84(geometry['coordinates'][0], geometry['coordinates'][1])
                return {
                    'type': 'Point',
                    'coordinates': [lon, lat]
                }
            
            elif geometry['type'] == 'MultiPoint':
                transformed_coords = []
                for coord in geometry['coordinates']:
                    lon, lat = web_mercator_to_wgs84(coord[0], coord[1])
                    transformed_coords.append([lon, lat])
                
                return {
                    'type': 'MultiPoint',
                    'coordinates': transformed_coords
                }
            
            else:
                logger.debug(f"Unsupported geometry type: {geometry['type']}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to transform geometry: {e}")
            return None
    
    def extract_building_features(self, layers_features: Dict) -> List[Dict]:
        """
        Extract building features from parsed layers.
        
        Args:
            layers_features: Dictionary of parsed features by layer
            
        Returns:
            List of building features with enhanced properties
        """
        building_features = []
        
        # Check each building layer name (with fallbacks like CAELUS)
        for layer_name in self.config['building_layers']:
            if layer_name in layers_features:
                features = layers_features[layer_name]
                logger.debug(f"Processing {len(features)} features from building layer '{layer_name}'")
                
                for feature in features:
                    enhanced_feature = self._enhance_building_feature(feature, layer_name)
                    if enhanced_feature:
                        building_features.append(enhanced_feature)
        
        logger.info(f"Extracted {len(building_features)} total building features")
        return building_features
    
    def _enhance_building_feature(self, feature: Dict, source_layer: str) -> Optional[Dict]:
        """Enhance building feature with calculated properties."""
        try:
            geometry = feature.get('geometry')
            properties = feature.get('properties', {})
            
            if not geometry:
                return None
            
            geom_type = geometry.get('type')
            
            # Initialize enhanced properties
            enhanced_properties = {
                **properties,  # Keep original properties
                'source_layer': source_layer,
            }
            
            # Handle different geometry types
            if geom_type == 'Polygon':
                # Create Shapely polygon for area calculation
                polygon = Polygon(geometry['coordinates'][0])
                if not polygon.is_valid:
                    return None
                
                # Calculate building area in square meters
                area_sqm = self._calculate_area_sqm(polygon)
                
                # Calculate centroid
                centroid = polygon.centroid
                
                enhanced_properties.update({
                    'area_sqm': area_sqm,
                    'height_m': self._extract_building_height(properties),
                    'centroid_lon': centroid.x,
                    'centroid_lat': centroid.y,
                    'geometry_type': 'polygon'
                })
                
            elif geom_type == 'LineString':
                # For LineString, calculate length and midpoint
                from shapely.geometry import LineString as ShapelyLineString
                line = ShapelyLineString(geometry['coordinates'])
                
                # Calculate length in meters (approximate)
                length_m = self._calculate_length_m(line)
                
                # Calculate midpoint
                midpoint = line.interpolate(0.5, normalized=True)
                
                enhanced_properties.update({
                    'length_m': length_m,
                    'height_m': self._extract_building_height(properties),
                    'centroid_lon': midpoint.x,
                    'centroid_lat': midpoint.y,
                    'geometry_type': 'linestring'
                })
                
            elif geom_type == 'Point':
                # For Point, just use the coordinates
                coords = geometry['coordinates']
                
                enhanced_properties.update({
                    'height_m': self._extract_building_height(properties),
                    'centroid_lon': coords[0],
                    'centroid_lat': coords[1],
                    'geometry_type': 'point'
                })
                
            else:
                # For other geometry types, skip enhancement but keep the feature
                enhanced_properties.update({
                    'geometry_type': geom_type.lower() if geom_type else 'unknown'
                })
            
            # Enhanced feature
            enhanced_feature = {
                'type': 'Feature',
                'geometry': geometry,
                'properties': enhanced_properties
            }
            
            return enhanced_feature
            
        except Exception as e:
            logger.warning(f"Failed to enhance building feature: {e}")
            return None
    
    def _calculate_area_sqm(self, polygon: Polygon) -> float:
        """Calculate polygon area in square meters."""
        try:
            # Polygon is already in WGS84, need to calculate area in meters
            # Use a local projection for accurate area calculation
            # For simplicity, we'll use an approximation
            lat = polygon.centroid.y
            # Meters per degree of latitude
            lat_meters = 111132.954
            # Meters per degree of longitude at this latitude
            lon_meters = 111132.954 * math.cos(math.radians(lat))
            
            # Approximate area calculation
            bounds = polygon.bounds
            width_deg = bounds[2] - bounds[0]
            height_deg = bounds[3] - bounds[1]
            
            # Convert to meters and calculate approximate area
            width_m = width_deg * lon_meters
            height_m = height_deg * lat_meters
            
            # This is an approximation - for production use, use proper projection
            return width_m * height_m * 0.8  # Adjustment factor for polygon shape
            
        except Exception as e:
            logger.warning(f"Failed to calculate area: {e}")
            return 0.0
    
    def _calculate_length_m(self, line) -> float:
        """Calculate line length in meters."""
        try:
            # Line is already in WGS84, need to calculate length in meters
            # Use a local projection for accurate length calculation
            # For simplicity, we'll use an approximation
            coords = list(line.coords)
            if len(coords) < 2:
                return 0.0
            
            total_length = 0.0
            for i in range(len(coords) - 1):
                p1 = coords[i]
                p2 = coords[i + 1]
                
                # Calculate approximate distance using Haversine formula
                lat1, lon1 = math.radians(p1[1]), math.radians(p1[0])
                lat2, lon2 = math.radians(p2[1]), math.radians(p2[0])
                
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                
                a = (math.sin(dlat/2)**2 + 
                     math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2)
                c = 2 * math.asin(math.sqrt(a))
                
                # Earth's radius in meters
                r = 6371000
                segment_length = r * c
                
                total_length += segment_length
            
            return total_length
            
        except Exception as e:
            logger.warning(f"Failed to calculate length: {e}")
            return 0.0
    
    def _extract_building_height(self, properties: Dict) -> Optional[float]:
        """
        Extract building height from various property names.
        
        BDTOPO data uses specific French property names for height information.
        """
        height_fields = [
            'altitude_minimale_toit', 'altitude_maximale_toit', 'hauteur', 'height', 
            'alti_sol', 'z_min', 'z_max', 'hauteur_moyenne', 'building_height', 'elevation'
        ]
        
        for field in height_fields:
            if field in properties:
                try:
                    height = float(properties[field])
                    if height > 0 and height < 1000:  # Reasonable height range
                        return height
                except (ValueError, TypeError):
                    continue
        
        # If no explicit height, try to calculate from min/max roof altitude
        if 'altitude_minimale_toit' in properties and 'altitude_maximale_toit' in properties:
            try:
                min_roof = float(properties['altitude_minimale_toit'])
                max_roof = float(properties['altitude_maximale_toit'])
                height = max_roof - min_roof
                if height > 0 and height < 1000:
                    return height
            except (ValueError, TypeError):
                pass
        
        # Try z_min/z_max as fallback
        if 'z_min' in properties and 'z_max' in properties:
            try:
                z_min = float(properties['z_min'])
                z_max = float(properties['z_max'])
                height = z_max - z_min
                if height > 0 and height < 1000:
                    return height
            except (ValueError, TypeError):
                pass
        
        return None
    
    def get_tiles_for_area(self, center_lon: float, center_lat: float, radius_km: float, zoom: int = 15) -> List[Tuple[int, int, int]]:
        """
        Get tile coordinates for a given area.
        
        Args:
            center_lon: Center longitude
            center_lat: Center latitude
            radius_km: Radius in kilometers
            zoom: Zoom level
            
        Returns:
            List of (z, x, y) tile coordinates
        """
        # Convert center to Web Mercator for tile calculation
        center_x, center_y = self._lonlat_to_web_mercator(center_lon, center_lat)
        
        # Calculate tile bounds for the area
        # Approximate: 1 degree ≈ 111 km
        radius_deg = radius_km / 111.0
        
        min_lon = center_lon - radius_deg
        max_lon = center_lon + radius_deg
        min_lat = center_lat - radius_deg
        max_lat = center_lat + radius_deg
        
        # Convert bounds to tile coordinates
        tiles = []
        for x in range(self._lon_to_tile_x(min_lon, zoom), self._lon_to_tile_x(max_lon, zoom) + 1):
            for y in range(self._lat_to_tile_y(max_lat, zoom), self._lat_to_tile_y(min_lat, zoom) + 1):
                tiles.append((zoom, x, y))
        
        logger.debug(f"Generated {len(tiles)} tiles for area ({radius_km}km radius at zoom {zoom})")
        return tiles
    
    def _lonlat_to_web_mercator(self, lon: float, lat: float) -> Tuple[float, float]:
        """Convert longitude/latitude to Web Mercator coordinates."""
        x = lon * 20037508.34 / 180
        y = math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.34 / math.pi
        return x, y
    
    def _lon_to_tile_x(self, lon: float, zoom: int) -> int:
        """Convert longitude to tile X coordinate."""
        return int((lon + 180) / 360 * (2 ** zoom))
    
    def _lat_to_tile_y(self, lat: float, zoom: int) -> int:
        """Convert latitude to tile Y coordinate."""
        return int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * (2 ** zoom))


def create_vector_tile_parser(config: Optional[Dict] = None) -> VectorTileParser:
    """Factory function to create VectorTileParser instance."""
    return VectorTileParser(config)
