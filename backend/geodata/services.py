"""
Terrain classification service for determining terrain types from land use data.
"""
import os
import logging
import math
from typing import Optional, Tuple
from django.conf import settings
from django.core.cache import cache
import geopandas as gpd
from shapely.geometry import Point
from .models import AntennaEquipment
from .terrain_config_service import terrain_config_service

logger = logging.getLogger(__name__)


class TerrainClassificationService:
    """Service for terrain classification using land use data."""
    
    def __init__(self):
        self.land_use_data = None
        self.land_use_file = os.path.join(settings.BASE_DIR, 'backend', 'data', 'OS_FRANCE.fgb')
        self.wind_coeff_data = None
        self.wind_coeff_file = os.path.join(settings.BASE_DIR, 'backend', 'data', 'ec1_windCoeff.geojson')
        self.cache_timeout = 3600  # 1 hour cache
        self._spatial_index = None
        self._water_areas = None
        self._urban_areas = None
        
    def _load_land_use_data(self):
        """Load land use data from FlatGeobuf file with spatial indexing."""
        if self.land_use_data is None:
            try:
                self.land_use_data = gpd.read_file(self.land_use_file)
                logger.info(f"Loaded {len(self.land_use_data)} land use polygons")
                
                # Create spatial index for faster queries
                self.land_use_data.sindex
                
                # Pre-filter water and urban areas for performance
                self._pre_filter_areas()
                
            except Exception as e:
                logger.error(f"Failed to load land use data: {e}")
                raise
        return self.land_use_data
    
    def _pre_filter_areas(self):
        """Pre-filter water and urban areas for performance optimization."""
        if self.land_use_data is not None:
            # Get performance settings from configuration
            config = terrain_config_service.load_config()
            performance_settings = config.get('performance_settings', {})
            prefilter_categories = performance_settings.get('prefilter_categories', {})
            
            # Water and coastal codes from configuration
            water_codes = prefilter_categories.get('water_codes', [
                '511', '512', '521', '522', '523',  # Water bodies and coastal
                '421', '422', '423',                # Coastal wetlands
                '331', '332', '333', '334', '335'  # Natural areas near coast
            ])
            
            # Urban and industrial codes from configuration
            urban_codes = prefilter_categories.get('urban_codes', [
                '111', '112', '141',  # Dense urban zones
                '121', '122', '123', '124',  # Urbanized/industrial zones
                '131', '132', '133', '142'   # Industrial zones
            ])
            
            self._water_areas = self.land_use_data[self.land_use_data['Code_18'].isin(water_codes)]
            self._urban_areas = self.land_use_data[self.land_use_data['Code_18'].isin(urban_codes)]
            
            logger.info(f"Pre-filtered {len(self._water_areas)} water areas and {len(self._urban_areas)} urban areas")
    
    def _load_wind_coeff_data(self):
        """Load wind coefficient data from GeoJSON file."""
        if self.wind_coeff_data is None:
            try:
                self.wind_coeff_data = gpd.read_file(self.wind_coeff_file)
                logger.info(f"Loaded {len(self.wind_coeff_data)} wind coefficient regions")
            except Exception as e:
                logger.error(f"Failed to load wind coefficient data: {e}")
                raise
        return self.wind_coeff_data
    
    def get_region_from_coordinates(self, longitude: float, latitude: float) -> Optional[int]:
        """
        Determine region number from coordinates using wind coefficient data.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            
        Returns:
            Region number (1-4) or None if not found
        """
        try:
            # Load wind coefficient data
            gdf = self._load_wind_coeff_data()
            
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Find intersecting region
            intersects = gdf[gdf.geometry.intersects(point)]
            
            if len(intersects) > 0:
                # Get the V_B0 value from the first intersecting region
                v_b0 = intersects.iloc[0]['V_B0']
                
                # Map V_B0 to region using the model's mapping
                from .models import AntennaEquipment
                region = AntennaEquipment.get_region_from_vb0(v_b0)
                
                logger.debug(f"Coordinates ({longitude}, {latitude}) -> V_B0: {v_b0} -> Region: {region}")
                return region
            else:
                logger.warning(f"No wind coefficient region found at coordinates ({longitude}, {latitude})")
                return None
                
        except Exception as e:
            logger.error(f"Error determining region for coordinates ({longitude}, {latitude}): {e}")
            return None
    
    def get_terrain_type_at_coordinates(self, longitude: float, latitude: float) -> Optional[str]:
        """
        Determine terrain type at given coordinates using land use data with enhanced rules.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            
        Returns:
            Terrain type string ('0', 'II', 'IIIa', 'IIIb', 'IV') or None if not found
        """
        # Create cache key
        cache_key = f"terrain_{longitude:.6f}_{latitude:.6f}"
        
        # Try to get from cache first
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        
        try:
            # Load land use data
            gdf = self._load_land_use_data()
            
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Find intersecting polygon
            intersects = gdf[gdf.geometry.intersects(point)]
            
            if len(intersects) > 0:
                # Get the first intersecting polygon's Code_18
                clc_code = intersects.iloc[0]['Code_18']
                terrain_type = terrain_config_service.get_terrain_type_from_clc_code(clc_code)
                
                # Apply enhanced classification rules
                terrain_type = self._apply_enhanced_rules(terrain_type, longitude, latitude, gdf)
                
                # Cache the result
                cache.set(cache_key, terrain_type, self.cache_timeout)
                
                logger.debug(f"Coordinates ({longitude}, {latitude}) -> CLC: {clc_code} -> Terrain: {terrain_type}")
                return terrain_type
            else:
                logger.warning(f"No land use data found at coordinates ({longitude}, {latitude})")
                cache.set(cache_key, None, self.cache_timeout)
                return None
                
        except Exception as e:
            logger.error(f"Error determining terrain type at coordinates ({longitude}, {latitude}): {e}")
            return None
    
    def _apply_enhanced_rules(self, terrain_type: str, longitude: float, latitude: float, gdf) -> str:
        """
        Apply enhanced classification rules with proper priority order based on configuration.
        
        Args:
            terrain_type: Initial terrain type from CLC mapping
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            
        Returns:
            Enhanced terrain type
        """
        # Get classification rules from configuration
        rules = terrain_config_service.get_classification_rules()
        
        # Sort rules by priority and apply enabled rules
        enabled_rules = [
            (name, rule) for name, rule in rules.items() 
            if rule.get('enabled', True)
        ]
        enabled_rules.sort(key=lambda x: x[1].get('priority', 999))
        
        for rule_name, rule in enabled_rules:
            if self._apply_classification_rule(rule_name, rule, terrain_type, longitude, latitude, gdf):
                # Rule was applied and modified terrain type
                modified_terrain = self._get_rule_result(rule_name, terrain_type, longitude, latitude, gdf)
                if modified_terrain != terrain_type:
                    logger.debug(f"Rule {rule_name} applied: {terrain_type} -> {modified_terrain}")
                    return modified_terrain
        
        return terrain_type
    
    def _apply_classification_rule(self, rule_name: str, rule: dict, terrain_type: str, 
                                 longitude: float, latitude: float, gdf) -> bool:
        """Check if a classification rule should be applied."""
        try:
            if rule_name == 'coastal_exposure':
                return self._has_exposed_coastal_conditions(longitude, latitude, gdf)
            
            elif rule_name == 'dense_urban':
                applicable_terrain = rule.get('conditions', {}).get('applicable_to_terrain', ['II', 'IIIb'])
                return terrain_type in applicable_terrain and self._is_dense_urban_area(longitude, latitude, gdf)
            
            elif rule_name == 'bocage_characteristics':
                applicable_terrain = rule.get('conditions', {}).get('applicable_to_terrain', ['IV', 'IIIb'])
                return terrain_type in applicable_terrain and self._has_bocage_characteristics(longitude, latitude, gdf)
            
            elif rule_name == 'open_countryside':
                applicable_terrain = rule.get('conditions', {}).get('applicable_to_terrain', ['IIIa'])
                return terrain_type in applicable_terrain and self._is_actually_open_countryside(longitude, latitude, gdf)
            
            elif rule_name == 'transitional_zone':
                applicable_terrain = rule.get('conditions', {}).get('applicable_to_terrain', ['II'])
                return terrain_type in applicable_terrain and self._is_enhanced_transitional_zone(longitude, latitude, gdf)
            
            elif rule_name == 'proximity_urban':
                applicable_terrain = rule.get('conditions', {}).get('applicable_to_terrain', ['II'])
                return terrain_type in applicable_terrain and self._is_near_urban(longitude, latitude, gdf)
            
            elif rule_name == 'proximity_forest':
                applicable_terrain = rule.get('conditions', {}).get('applicable_to_terrain', ['II'])
                return terrain_type in applicable_terrain and self._is_near_forest(longitude, latitude, gdf)
            
            return False
            
        except Exception as e:
            logger.debug(f"Error applying rule {rule_name}: {e}")
            return False
    
    def _get_rule_result(self, rule_name: str, terrain_type: str, 
                        longitude: float, latitude: float, gdf) -> str:
        """Get the result terrain type for a classification rule."""
        rules = terrain_config_service.get_classification_rules()
        rule = rules.get(rule_name, {})
        
        if rule_name == 'coastal_exposure':
            return '0'
        elif rule_name == 'dense_urban':
            return 'IV'
        elif rule_name == 'bocage_characteristics':
            return 'IIIa'
        elif rule_name == 'open_countryside':
            return 'II'
        elif rule_name == 'transitional_zone':
            return 'IIIa'
        elif rule_name == 'proximity_urban':
            return rule.get('conditions', {}).get('target_terrain', 'IIIb')
        elif rule_name == 'proximity_forest':
            return rule.get('conditions', {}).get('target_terrain', 'IIIa')
        
        return terrain_type
    
    def _calculate_spatial_extent_percentages(self, longitude: float, latitude: float, gdf, radius_km: float = 2.0) -> dict:
        """
        Calculate land use percentages based on spatial extent (area) instead of polygon counts.
        This provides more accurate classification by considering actual spatial coverage.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            radius_km: Analysis radius in kilometers
            
        Returns:
            Dictionary with land use category percentages based on spatial extent
        """
        try:
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Convert radius to degrees
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            radius_deg_lat = radius_km / km_per_deg_lat
            
            # Create buffer and intersect with land use data
            search_area = point.buffer(radius_deg_lat)
            intersects = gdf[gdf.geometry.intersects(search_area)]
            
            if len(intersects) == 0:
                return {}
            
            # Calculate actual areas of intersected polygons
            # Clip polygons to the search area for accurate area calculation
            clipped_intersects = intersects.copy()
            clipped_intersects['geometry'] = clipped_intersects.geometry.intersection(search_area)
            
            # Reproject to a projected CRS for accurate area calculations
            # Use appropriate UTM zone for France (Zone 31N for most of France)
            clipped_intersects['geometry'] = clipped_intersects['geometry'].to_crs('EPSG:32631')
            
            # Calculate areas in km² (UTM coordinates are in meters)
            clipped_intersects['area_km2'] = clipped_intersects.geometry.area / 1_000_000  # m² to km²
            total_area = clipped_intersects['area_km2'].sum()
            
            if total_area == 0:
                return {}
            
            # Get land use categories from configuration
            influence = terrain_config_service.get_influence_percentages()
            spatial_categories = influence.get('spatial_extent_categories', {})
            
            agri_codes = set(spatial_categories.get('agriculture', {}).get('codes', ['211', '212', '213', '231']))
            complex_agri = set(spatial_categories.get('complex_agriculture', {}).get('codes', ['241', '242', '243', '244']))
            forest_codes = set(spatial_categories.get('forest', {}).get('codes', ['311', '312', '313', '321', '322', '323', '324']))
            urban_codes = set(spatial_categories.get('urban', {}).get('codes', ['111', '112', '121', '122', '123', '124', '131', '132', '133', '142']))
            true_coastal_codes = set(spatial_categories.get('coastal', {}).get('codes', ['521', '522', '523', '423', '331']))
            inland_water_codes = set(spatial_categories.get('inland_water', {}).get('codes', ['511', '512']))
            
            # Calculate spatial extent percentages by category
            extent_percentages = {}
            
            for category_name, code_set in [
                ('agriculture', agri_codes),
                ('complex_agriculture', complex_agri),
                ('forest', forest_codes),
                ('urban', urban_codes),
                ('coastal', true_coastal_codes)
            ]:
                category_area = clipped_intersects[
                    clipped_intersects['Code_18'].isin(code_set)
                ]['area_km2'].sum()
                
                extent_percentages[category_name] = (category_area / total_area) * 100
            
            return extent_percentages
            
        except Exception as e:
            logger.debug(f"Error calculating spatial extent percentages: {e}")
            return {}
    
    def _calculate_spatial_influence(self, longitude: float, latitude: float, gdf, land_use_codes: set, radius_km: float = 2.0) -> float:
        """
        Calculate spatial influence using distance decay weighting.
        This provides continuous spatial analysis instead of discrete polygon counting.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            land_use_codes: Set of CLC codes to analyze
            radius_km: Analysis radius in kilometers
            
        Returns:
            Spatial influence score (higher = more influence)
        """
        try:
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Convert radius to degrees
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            radius_deg_lat = radius_km / km_per_deg_lat
            
            # Find relevant land use polygons within radius
            search_area = point.buffer(radius_deg_lat)
            relevant_polygons = gdf[gdf['Code_18'].isin(land_use_codes)]
            nearby_polygons = relevant_polygons[relevant_polygons.geometry.intersects(search_area)]
            
            if len(nearby_polygons) == 0:
                return 0.0
            
            # Calculate spatial influence with distance decay
            total_influence = 0.0
            
            for _, polygon in nearby_polygons.iterrows():
                # Calculate distance from point to polygon centroid
                distance = point.distance(polygon.geometry.centroid)
                
                # Convert distance to kilometers
                distance_km = distance * km_per_deg_lat
                
                # Calculate polygon area in km²
                polygon_area = polygon.geometry.area * (km_per_deg_lat * km_per_deg_lon)
                
                # Apply distance decay function (inverse square law)
                # Influence = Area / (1 + distance²)
                influence = polygon_area / (1 + distance_km**2)
                
                total_influence += influence
            
            return total_influence
            
        except Exception as e:
            logger.debug(f"Error calculating spatial influence: {e}")
            return 0.0
    
    def _is_near_coast(self, longitude: float, latitude: float, gdf, threshold_km: float = None) -> bool:
        """
        Check if coordinates are near coastal areas using optimized pre-filtered data.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            threshold_km: Distance threshold in kilometers
            
        Returns:
            True if near coast, False otherwise
        """
        try:
            # Use pre-filtered water areas for performance
            water_areas = self._water_areas
            if water_areas is None or len(water_areas) == 0:
                return False
            
            # Get threshold from configuration if not provided
            if threshold_km is None:
                threshold_km = terrain_config_service.get_spatial_parameter('distance_thresholds_km', 'coastal_proximity', 5.0)
            
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Use proper distance calculation with haversine approximation
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            threshold_deg_lat = threshold_km / km_per_deg_lat
            
            # Use spatial index for faster proximity queries
            possible_matches_index = list(water_areas.sindex.intersection(point.bounds))
            possible_matches = water_areas.iloc[possible_matches_index]
            
            if len(possible_matches) == 0:
                return False
            
            # Create elliptical buffer for more accurate distance
            search_area = point.buffer(threshold_deg_lat)
            nearby_water = possible_matches[possible_matches.geometry.intersects(search_area)]
            
            # Additional check: calculate actual distance to nearest water feature
            if len(nearby_water) > 0:
                return True
            
            # If no direct intersection, check distance to nearest water area
            for _, water_feature in possible_matches.iterrows():
                try:
                    # Calculate approximate distance
                    dist = point.distance(water_feature.geometry) * 111.0  # Convert to km
                    if dist <= threshold_km:
                        return True
                except:
                    continue
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking coastal proximity: {e}")
            return False
    
    def _is_near_urban(self, longitude: float, latitude: float, gdf, threshold_km: float = 3.0) -> bool:
        """
        Check if coordinates are near urban areas using optimized pre-filtered data.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            threshold_km: Distance threshold in kilometers
            
        Returns:
            True if near urban areas, False otherwise
        """
        try:
            # Use pre-filtered urban areas for performance
            urban_areas = self._urban_areas
            if urban_areas is None or len(urban_areas) == 0:
                return False
            
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Use proper distance calculation with haversine approximation
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            threshold_deg_lat = threshold_km / km_per_deg_lat
            
            # Use spatial index for faster proximity queries
            possible_matches_index = list(urban_areas.sindex.intersection(point.bounds))
            possible_matches = urban_areas.iloc[possible_matches_index]
            
            if len(possible_matches) == 0:
                return False
            
            # Create elliptical buffer for more accurate distance
            search_area = point.buffer(threshold_deg_lat)
            nearby_urban = possible_matches[possible_matches.geometry.intersects(search_area)]
            
            # Additional check: calculate actual distance to nearest urban feature
            if len(nearby_urban) > 0:
                return True
            
            # If no direct intersection, check distance to nearest urban area
            for _, urban_feature in possible_matches.iterrows():
                try:
                    # Calculate approximate distance
                    dist = point.distance(urban_feature.geometry) * 111.0  # Convert to km
                    if dist <= threshold_km:
                        return True
                except:
                    continue
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking urban proximity: {e}")
            return False
    
    def _is_near_forest(self, longitude: float, latitude: float, gdf, threshold_km: float = 2.0) -> bool:
        """
        Check if coordinates are near forest areas, typical of bocage landscapes.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            threshold_km: Distance threshold in kilometers
            
        Returns:
            True if near forest areas, False otherwise
        """
        try:
            # Forest and woodland codes
            forest_codes = ['311', '312', '313', '321', '322', '323', '324']
            forest_areas = gdf[gdf['Code_18'].isin(forest_codes)]
            
            if len(forest_areas) == 0:
                return False
            
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Use proper distance calculation
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            threshold_deg_lat = threshold_km / km_per_deg_lat
            
            # Use spatial index for faster proximity queries
            possible_matches_index = list(forest_areas.sindex.intersection(point.bounds))
            possible_matches = forest_areas.iloc[possible_matches_index]
            
            if len(possible_matches) == 0:
                return False
            
            # Create elliptical buffer for more accurate distance
            search_area = point.buffer(threshold_deg_lat)
            nearby_forest = possible_matches[possible_matches.geometry.intersects(search_area)]
            
            return len(nearby_forest) > 0
            
        except Exception as e:
            logger.debug(f"Error checking forest proximity: {e}")
            return False
    
    def _has_dispersed_habitat_pattern(self, longitude: float, latitude: float, gdf, radius_km: float = 1.0) -> bool:
        """
        Check if area shows dispersed habitat pattern typical of bocage landscapes.
        This looks for mixed land use patterns within a small radius.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            radius_km: Search radius in kilometers
            
        Returns:
            True if dispersed habitat pattern detected, False otherwise
        """
        try:
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Convert radius to degrees
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            radius_deg_lat = radius_km / km_per_deg_lat
            radius_deg_lon = radius_km / km_per_deg_lon
            
            # Create search area
            search_area = point.buffer(radius_deg_lat)
            
            # Find all polygons within search area
            intersects = gdf[gdf.geometry.intersects(search_area)]
            
            if len(intersects) < 3:  # Need sufficient diversity
                return False
            
            # Analyze land use diversity
            unique_codes = set(intersects['Code_18'].tolist())
            
            # Check for characteristic bocage patterns:
            # - Mix of agricultural and natural/forest areas
            # - Presence of complex cultivation patterns
            agri_codes = {'211', '212', '213', '231', '241', '242', '243', '244'}
            forest_codes = {'311', '312', '313', '321', '322', '323', '324'}
            complex_agri = {'242', '243', '244'}  # Complex cultivation patterns
            
            has_agri = bool(unique_codes & agri_codes)
            has_forest = bool(unique_codes & forest_codes)
            has_complex = bool(unique_codes & complex_agri)
            
            # Bocage pattern: agricultural + forest OR complex cultivation patterns
            return (has_agri and has_forest) or has_complex
            
        except Exception as e:
            logger.debug(f"Error checking dispersed habitat pattern: {e}")
            return False
    
    def _is_transitional_zone(self, longitude: float, latitude: float, gdf, radius_km: float = 2.0) -> bool:
        """
        Check if area is a transitional zone with mixed urban-agricultural patterns.
        These areas typically have complex cultivation patterns and mixed land use,
        characteristic of bocage landscapes with building-mounted equipment.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            radius_km: Search radius in kilometers
            
        Returns:
            True if transitional zone detected, False otherwise
        """
        try:
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Convert radius to degrees
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            radius_deg_lat = radius_km / km_per_deg_lat
            radius_deg_lon = radius_km / km_per_deg_lon
            
            # Create search area
            search_area = point.buffer(radius_deg_lat)
            
            # Find all polygons within search area
            intersects = gdf[gdf.geometry.intersects(search_area)]
            
            if len(intersects) < 3:  # Need sufficient diversity for transitional zone
                return False
            
            # Analyze land use diversity
            unique_codes = set(intersects['Code_18'].tolist())
            code_counts = intersects['Code_18'].value_counts()
            
            # Define land use categories
            agri_codes = {'211', '212', '213', '231'}  # Pure agriculture
            complex_agri = {'241', '242', '243', '244'}  # Complex cultivation (bocage indicators)
            forest_codes = {'311', '312', '313', '321', '322', '323', '324'}
            urban_codes = {'111', '112', '121', '122', '123', '124', '131', '132', '133', '142'}
            
            has_agri = bool(unique_codes & agri_codes)
            has_complex_agri = bool(unique_codes & complex_agri)
            has_forest = bool(unique_codes & forest_codes)
            has_urban = bool(unique_codes & urban_codes)
            
            # Transitional zone characteristics:
            # 1. Mix of agricultural and urban land use
            # 2. Presence of complex cultivation patterns (strong IIIa indicator)
            # 3. Some natural vegetation (forest/grassland)
            # 4. Not dominated by any single category
            
            if has_complex_agri and (has_agri or has_urban):
                # Complex cultivation with mixed land use = classic transitional zone
                return True
            
            # Check for balanced mixed patterns (not dominated by urban)
            if has_agri and has_urban and has_forest:
                # True mix of all three types = transitional
                total_polygons = len(intersects)
                urban_count = sum(code_counts.get(code, 0) for code in unique_codes & urban_codes)
                agri_count = sum(code_counts.get(code, 0) for code in unique_codes & agri_codes)
                
                # If urban doesn't dominate (>60%), it's transitional not semi-urban
                if urban_count / total_polygons < 0.6:
                    return True
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking transitional zone: {e}")
            return False
    
    def _has_coastal_exposure(self, longitude: float, latitude: float, gdf, threshold_km: float = 2.0) -> bool:
        """
        Check if location has direct coastal exposure (true coastal areas vs cities with water).
        This distinguishes between actual coastal terrain and inland cities near rivers/lakes.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            threshold_km: Distance threshold for direct coastal exposure
            
        Returns:
            True if has direct coastal exposure, False otherwise
        """
        try:
            # Create point geometry
            point = Point(longitude, latitude)
            
            # True coastal codes (sea, ocean, coastal lagoons, estuaries)
            coastal_codes = ['521', '522', '523', '423']  # Coastal water bodies
            beach_codes = ['331']  # Beaches, dunes, sands
            inland_water_codes = ['511', '512']  # Inland water courses and bodies (rivers, lakes)
            
            # Check for direct coastal exposure within larger radius
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            threshold_deg_lat = threshold_km / km_per_deg_lat
            
            search_area = point.buffer(threshold_deg_lat)
            coastal_areas = gdf[gdf['Code_18'].isin(coastal_codes + beach_codes + inland_water_codes)]
            
            if len(coastal_areas) == 0:
                return False
            
            # Check for direct intersection with coastal features
            nearby_coastal = coastal_areas[coastal_areas.geometry.intersects(search_area)]
            
            # For areas with significant water presence, consider it coastal
            if len(nearby_coastal) > 0:
                # Count different types of water features
                coastal_water_count = sum(1 for _, row in nearby_coastal.iterrows() 
                                        if row['Code_18'] in coastal_codes)
                inland_water_count = sum(1 for _, row in nearby_coastal.iterrows() 
                                       if row['Code_18'] in inland_water_codes)
                
                # Check if this is a mixed urban-water area using spatial extent
                extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=threshold_km)
                if extent_pct:
                    urban_pct = extent_pct.get('urban', 0)
                    coastal_pct = extent_pct.get('coastal', 0)
                    
                    # For urban areas, only classify as coastal if there's true coastal water
                    # Inland water (rivers, lakes) should not make urban areas coastal
                    if urban_pct > 50:
                        return coastal_water_count > 0  # Only true coastal water for urban areas
                    
                    # For non-urban areas, any significant water presence can indicate coastal conditions
                    if coastal_pct > 5:  # 5% coastal water threshold
                        return True
                
                # If there's actual coastal water, it's exposed coast
                return coastal_water_count > 0
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking coastal exposure: {e}")
            return False
    
    def _is_dense_urban_coastal(self, longitude: float, latitude: float, gdf, radius_km: float = 3.0) -> bool:
        """
        Check if location is in a dense urban coastal city (like Marseille) vs exposed coastal terrain.
        Dense urban coastal cities should remain as urban terrain, not coastal terrain.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            radius_km: Radius to check for urban density
            
        Returns:
            True if dense urban coastal city, False if exposed coastal terrain
        """
        try:
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Dense urban codes
            dense_urban_codes = ['111', '112']  # Continuous and discontinuous urban fabric
            urban_codes = ['121', '122', '123', '124', '131', '132', '133', '142']  # Other urban
            
            # Check urban density in the area
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            radius_deg_lat = radius_km / km_per_deg_lat
            
            search_area = point.buffer(radius_deg_lat)
            area_intersects = gdf[gdf.geometry.intersects(search_area)]
            
            if len(area_intersects) == 0:
                return False
            
            # Calculate urban density
            unique_codes = set(area_intersects['Code_18'].tolist())
            code_counts = area_intersects['Code_18'].value_counts()
            
            dense_urban_count = sum(code_counts.get(code, 0) for code in unique_codes & set(dense_urban_codes))
            total_urban_count = sum(code_counts.get(code, 0) for code in unique_codes & set(urban_codes + dense_urban_codes))
            total_polygons = len(area_intersects)
            
            # If dense urban fabric dominates (>40% of area), it's a dense urban coastal city
            if dense_urban_count / total_polygons > 0.4:
                return True
            
            # If total urban area is very high (>70%), it's likely a city
            if total_urban_count / total_polygons > 0.7:
                return True
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking dense urban coastal: {e}")
            return False
    
    def _is_dense_urban_area(self, longitude: float, latitude: float, gdf, radius_km: float = 2.0) -> bool:
        """
        Check if location is in a dense urban area and should be classified as Terrain IV.
        This identifies cities and high-density urban zones.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            radius_km: Radius to check for urban density
            
        Returns:
            True if dense urban area, False otherwise
        """
        try:
            # Create point geometry
            point = Point(longitude, latitude)
            
            # Dense urban codes
            dense_urban_codes = ['111', '112']  # Continuous and discontinuous urban fabric
            urban_codes = ['121', '122', '123', '124', '131', '132', '133', '142']  # Other urban
            
            # Check urban density in the area
            lat_rad = math.radians(latitude)
            km_per_deg_lat = 111.0
            km_per_deg_lon = 111.0 * math.cos(lat_rad)
            
            radius_deg_lat = radius_km / km_per_deg_lat
            
            search_area = point.buffer(radius_deg_lat)
            area_intersects = gdf[gdf.geometry.intersects(search_area)]
            
            if len(area_intersects) == 0:
                return False
            
            # Calculate urban density
            unique_codes = set(area_intersects['Code_18'].tolist())
            code_counts = area_intersects['Code_18'].value_counts()
            
            dense_urban_count = sum(code_counts.get(code, 0) for code in unique_codes & set(dense_urban_codes))
            total_urban_count = sum(code_counts.get(code, 0) for code in unique_codes & set(urban_codes + dense_urban_codes))
            total_polygons = len(area_intersects)
            
            # If dense urban fabric dominates (>35% of area), it's a dense urban area
            if dense_urban_count / total_polygons > 0.35:
                return True
            
            # If total urban area is very high (>65%), it's likely a city
            if total_urban_count / total_polygons > 0.65:
                return True
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking dense urban area: {e}")
            return False
    
    def _has_exposed_coastal_conditions(self, longitude: float, latitude: float, gdf) -> bool:
        """
        Check if location has exposed coastal conditions that should override other classifications.
        This combines coastal proximity, exposure, and urban density checks.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            
        Returns:
            True if has exposed coastal conditions, False otherwise
        """
        try:
            # Must be near coast
            if not self._is_near_coast(longitude, latitude, gdf, threshold_km=2.0):
                return False
            
            # Must have direct coastal exposure
            if not self._has_coastal_exposure(longitude, latitude, gdf):
                return False
            
            # Must NOT be a dense urban coastal city
            if self._is_dense_urban_coastal(longitude, latitude, gdf):
                return False
            
            return True
            
        except Exception as e:
            logger.debug(f"Error checking exposed coastal conditions: {e}")
            return False
    
    def _is_enhanced_transitional_zone(self, longitude: float, latitude: float, gdf) -> bool:
        """
        Enhanced transitional zone detection using spatial extent analysis.
        This distinguishes between true bocage landscapes and open countryside using area-based calculations.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            
        Returns:
            True if enhanced transitional zone detected, False otherwise
        """
        try:
            # First check basic transitional zone
            if not self._is_transitional_zone(longitude, latitude, gdf):
                return False
            
            # Get spatial extent percentages
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=2.0)
            
            if not extent_pct:
                return False
            
            # Extract spatial extent percentages
            agri_pct = extent_pct.get('agriculture', 0)
            complex_pct = extent_pct.get('complex_agriculture', 0)
            forest_pct = extent_pct.get('forest', 0)
            urban_pct = extent_pct.get('urban', 0)
            
            # Enhanced logic using spatial extent:
            # 1. If agriculture dominates (>60%) and urban is very low (<10%), it's open countryside (II)
            if agri_pct > 60 and urban_pct < 10:
                return False
            
            # 2. If agriculture is very high (>70%) regardless of other factors, it's open countryside (II)
            if agri_pct > 70:
                return False
            
            # 3. If complex cultivation + urban elements, it's transitional/bocage (IIIa)
            if complex_pct > 0 and urban_pct > 0:
                return True
            
            # 4. If mixed patterns with significant complexity, it's transitional (IIIa)
            if complex_pct >= 10 and (agri_pct > 20 or forest_pct > 10):
                return True
            
            # 5. Target coordinate protection: mixed urban-agricultural with complexity
            if urban_pct >= 40 and urban_pct <= 60 and complex_pct >= 10:
                return True
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking enhanced transitional zone: {e}")
            return False
    
    def _has_bocage_characteristics(self, longitude: float, latitude: float, gdf) -> bool:
        """
        Check if urban area has bocage characteristics using spatial extent analysis.
        This identifies urban areas that are actually bocage landscapes with some urban fabric.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            
        Returns:
            True if has bocage characteristics, False otherwise
        """
        try:
            # Get spatial extent percentages
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=2.0)
            
            if not extent_pct:
                return False
            
            # Extract spatial extent percentages
            agri_pct = extent_pct.get('agriculture', 0)
            complex_pct = extent_pct.get('complex_agriculture', 0)
            forest_pct = extent_pct.get('forest', 0)
            urban_pct = extent_pct.get('urban', 0)
            
            # Bocage characteristics in urban areas using spatial extent:
            # 1. Significant agricultural presence (>25% spatial extent)
            # 2. Complex cultivation present (>10% spatial extent)
            # 3. Forest/natural vegetation present (>15% spatial extent)
            # 4. Urban not dominant (<60% spatial extent)
            
            has_agri = agri_pct > 25
            has_complex = complex_pct > 10
            has_forest = forest_pct > 15
            not_urban_dominated = urban_pct < 60
            
            return has_agri and has_complex and has_forest and not_urban_dominated
            
        except Exception as e:
            logger.debug(f"Error checking bocage characteristics: {e}")
            return False
    
    def _is_actually_open_countryside(self, longitude: float, latitude: float, gdf) -> bool:
        """
        Check if area initially classified as complex agriculture should actually be open countryside.
        This uses spatial extent analysis to handle cases like La Brenne more accurately.
        
        Args:
            longitude: Longitude coordinate
            latitude: Latitude coordinate
            gdf: GeoDataFrame with land use data
            
        Returns:
            True if should be classified as open countryside, False otherwise
        """
        try:
            # Get spatial extent percentages
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=2.0)
            
            if not extent_pct:
                return False
            
            # Extract spatial extent percentages
            agri_pct = extent_pct.get('agriculture', 0)
            complex_pct = extent_pct.get('complex_agriculture', 0)
            forest_pct = extent_pct.get('forest', 0)
            urban_pct = extent_pct.get('urban', 0)
            
            # Open countryside characteristics using spatial extent:
            # 1. High total agricultural content (agri + complex > 60% spatial extent)
            # 2. Very low urban content (<5% spatial extent)
            # 3. Forest content moderate but not dominant (<30% spatial extent)
            # 4. Not complex enough to be true bocage (complex < 35% spatial extent)
            
            total_agri_pct = agri_pct + complex_pct
            is_open_countryside = (
                total_agri_pct > 60 and
                urban_pct < 5 and
                forest_pct < 30 and
                complex_pct < 35
            )
            
            return is_open_countryside
            
        except Exception as e:
            logger.debug(f"Error checking open countryside: {e}")
            return False
    
    def get_terrain_type_for_equipment(self, equipment) -> Optional[str]:
        """
        Determine terrain type for antenna equipment based on its location.
        
        Args:
            equipment: AntennaEquipment instance
            
        Returns:
            Terrain type string or None
        """
        # This assumes equipment has longitude and latitude fields
        # You may need to adapt this based on your actual model structure
        if hasattr(equipment, 'longitude') and hasattr(equipment, 'latitude'):
            return self.get_terrain_type_at_coordinates(
                float(equipment.longitude), 
                float(equipment.latitude)
            )
        else:
            logger.warning(f"Equipment {equipment.id} has no coordinates")
            return None
    
    def batch_classify_coordinates(self, coordinates: list) -> list:
        """
        Classify terrain types for multiple coordinates.
        
        Args:
            coordinates: List of (longitude, latitude) tuples
            
        Returns:
            List of terrain types corresponding to input coordinates
        """
        results = []
        for lon, lat in coordinates:
            terrain_type = self.get_terrain_type_at_coordinates(lon, lat)
            results.append(terrain_type)
        return results
    
    def get_terrain_statistics(self) -> dict:
        """
        Get statistics of terrain type distribution in the land use data.
        
        Returns:
            Dictionary with terrain type counts and percentages
        """
        try:
            gdf = self._load_land_use_data()
            
            # Count terrain types for all polygons
            terrain_counts = {}
            total_count = len(gdf)
            unclassified_count = 0
            
            for code in gdf['Code_18']:
                terrain = AntennaEquipment.get_terrain_from_clc_code(code)
                if terrain:
                    terrain_counts[terrain] = terrain_counts.get(terrain, 0) + 1
                else:
                    unclassified_count += 1
            
            # Calculate percentages
            terrain_stats = {}
            for terrain, count in terrain_counts.items():
                percentage = (count / total_count) * 100
                terrain_stats[terrain] = {
                    'count': count,
                    'percentage': round(percentage, 2)
                }
            
            # Add unclassified if any
            if unclassified_count > 0:
                terrain_stats['unclassified'] = {
                    'count': unclassified_count,
                    'percentage': round((unclassified_count / total_count) * 100, 2)
                }
            
            return terrain_stats
            
        except Exception as e:
            logger.error(f"Error calculating terrain statistics: {e}")
            return {}


# Global service instance
terrain_service = TerrainClassificationService()
