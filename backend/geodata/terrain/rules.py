"""
Terrain classification rule evaluation, weighted scoring, and explanations.
Mixed into `TerrainClassificationService` to separate domain rule logic
from PostGIS/GeoJSON data access and caching orchestration.
"""
import logging
import math
from typing import List, Optional, Tuple

from shapely.geometry import Point

from geodata.terrain_config_service import terrain_config_service
from .bdtopo import bdtopo_service
from .spatial_metrics import calculate_distance_to_codes, is_near_codes

logger = logging.getLogger(__name__)


class TerrainRuleEngineMixin:
    """Mixin implementing weighted rule scoring, application, and explanations."""

    def _apply_enhanced_rules_with_confidence(self, terrain_type: str, longitude: float, latitude: float, gdf) -> Tuple[str, float]:
        rule_scores = self._calculate_weighted_rule_scores(terrain_type, longitude, latitude, gdf)
        scored_rules = [
            (name, rule, score)
            for name, rule, score in rule_scores
            if rule.get('enabled', True) and score > 0
        ]
        scored_rules.sort(key=lambda x: (x[1].get('priority', 999), -x[2]))

        base_confidence = self._calculate_base_confidence(terrain_type, longitude, latitude, gdf)
        final_terrain = terrain_type
        final_confidence = base_confidence

        if scored_rules:
            rule_name, rule, score = scored_rules[0]
            modified_terrain = self._get_rule_result(rule_name, terrain_type, longitude, latitude, gdf)
            if modified_terrain != terrain_type:
                rule_confidence = min(score / 100.0, 1.0)
                final_confidence = (base_confidence + rule_confidence) / 2.0
                final_terrain = modified_terrain
                logger.debug(
                    "Rule %s applied with score %.2f: %s -> %s (Confidence: %.2f)",
                    rule_name, score, terrain_type, modified_terrain, final_confidence,
                )

        # Base preservation override: points inside base Terrain II / IIIa stay at base terrain
        if final_terrain == 'IV' and terrain_type in ['II', 'IIIa']:
            final_terrain = terrain_type
            logger.debug("Transition override: base terrain %s preserved from IV", terrain_type)
        elif final_terrain == 'IV':
            clc_mappings = terrain_config_service.get_clc_code_mappings()
            target_codes = (
                list(clc_mappings.get('terrain_II', {}).get('codes', []))
                + list(clc_mappings.get('terrain_IIIa', {}).get('codes', []))
            )
            min_dist_km = calculate_distance_to_codes(longitude, latitude, gdf, target_codes)
            if min_dist_km <= 0.05:  # Within 50m
                final_terrain = 'IIIa'
                final_confidence = max(final_confidence, 0.8)
                logger.debug(
                    "Transition penetration override applied: Terrain IV -> IIIa (Distance to II/IIIa: %.3f km)",
                    min_dist_km,
                )

        return final_terrain, final_confidence

    def _apply_enhanced_rules(self, terrain_type: str, longitude: float, latitude: float, gdf) -> str:
        rule_scores = self._calculate_weighted_rule_scores(terrain_type, longitude, latitude, gdf)
        scored_rules = [
            (name, rule, score)
            for name, rule, score in rule_scores
            if rule.get('enabled', True) and score > 0
        ]
        scored_rules.sort(key=lambda x: (x[1].get('priority', 999), -x[2]))

        for rule_name, rule, score in scored_rules:
            modified_terrain = self._get_rule_result(rule_name, terrain_type, longitude, latitude, gdf)
            if modified_terrain != terrain_type:
                logger.debug("Rule %s applied with score %.2f: %s -> %s", rule_name, score, terrain_type, modified_terrain)
                return modified_terrain
        return terrain_type

    def _calculate_weighted_rule_scores(self, terrain_type: str, longitude: float, latitude: float, gdf) -> List[Tuple[str, dict, float]]:
        rules = terrain_config_service.get_classification_rules()
        scored_rules = []
        for rule_name, rule in rules.items():
            if not rule.get('enabled', True):
                continue
            score = self._calculate_rule_score(rule_name, rule, terrain_type, longitude, latitude, gdf)
            scored_rules.append((rule_name, rule, score))
        return scored_rules

    def _calculate_rule_score(
        self,
        rule_name: str,
        rule: dict,
        terrain_type: str,
        longitude: float,
        latitude: float,
        gdf,
    ) -> float:
        try:
            conditions = rule.get('conditions', {})
            if rule_name == 'forest_gaps_in_urban':
                if terrain_type not in conditions.get('applicable_to_terrain', ['IV']):
                    return 0.0
                return self._score_forest_gaps_in_urban(longitude, latitude, gdf)

            if rule_name == 'coastline_proximity_1km':
                threshold = conditions.get('distance_threshold_km', 1.0)
                return 100.0 if self._is_near_physical_coastline(longitude, latitude, threshold_km=threshold) else 0.0

            if rule_name == 'coastal_exposure':
                return self._score_coastal_exposure(longitude, latitude, gdf)

            if rule_name == 'dense_urban':
                if terrain_type not in conditions.get('applicable_to_terrain', ['II', 'IIIb']):
                    return 0.0
                return self._score_dense_urban(longitude, latitude, gdf)

            if rule_name == 'building_density_verification':
                if terrain_type not in conditions.get('applicable_to_terrain', ['IIIb']):
                    return 0.0
                return self._score_building_density_verification(longitude, latitude, gdf)

            if rule_name == 'bocage_characteristics':
                if terrain_type not in conditions.get('applicable_to_terrain', ['IV', 'IIIb']):
                    return 0.0
                return self._score_bocage_characteristics(longitude, latitude, gdf)

            if rule_name == 'open_countryside':
                if terrain_type not in conditions.get('applicable_to_terrain', ['IIIa']):
                    return 0.0
                return self._score_open_countryside(longitude, latitude, gdf)

            if rule_name == 'transitional_zone':
                if terrain_type not in conditions.get('applicable_to_terrain', ['II']):
                    return 0.0
                return self._score_transitional_zone(longitude, latitude, gdf)

            if rule_name == 'proximity_urban':
                if terrain_type not in conditions.get('applicable_to_terrain', ['II']):
                    return 0.0
                return self._score_proximity_urban(longitude, latitude, gdf)

            if rule_name == 'proximity_forest':
                if terrain_type not in conditions.get('applicable_to_terrain', ['II']):
                    return 0.0
                return self._score_proximity_forest(longitude, latitude, gdf)

            return 0.0
        except Exception as e:
            logger.debug("Error calculating score for rule %s: %s", rule_name, e)
            return 0.0

    def _score_coastal_exposure(self, longitude: float, latitude: float, gdf) -> float:
        multi_scale_data = self._multi_scale_analysis(longitude, latitude, gdf, [1.0, 2.0, 5.0])
        score = 0.0
        for scale, data in multi_scale_data.items():
            coastal_pct = data.get('coastal', 0)
            urban_pct = data.get('urban', 0)
            scale_weight = scale / 5.0
            if urban_pct > 50:
                if coastal_pct > 10:
                    score += 25.0 * scale_weight
            else:
                if coastal_pct > 5:
                    score += 30.0 * scale_weight
        return min(score, 100.0)

    def _score_dense_urban(self, longitude: float, latitude: float, gdf) -> float:
        if not self._is_dense_urban_area(longitude, latitude, gdf):
            return 0.0
        extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
        if not extent_pct:
            return 0.0

        urban_pct = extent_pct.get('urban', 0)
        thresholds = terrain_config_service.get_spatial_analysis_config()
        total_urban_threshold = thresholds.get('density_thresholds', {}).get('total_urban_area', 0.65)

        score = 50.0
        if urban_pct > (total_urban_threshold * 100):
            excess = urban_pct - (total_urban_threshold * 100)
            score += min(excess / 10.0, 1.0) * 50.0
        return min(score, 100.0)

    def _score_building_density_verification(self, longitude: float, latitude: float, gdf) -> float:
        try:
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
            if not extent_pct:
                return 0.0
            urban_pct = extent_pct.get('urban', 0)
            config = terrain_config_service.load_config()
            conditions = config.get('building_density_analysis', {}).get('conditions', {})
            min_urban = conditions.get('clc_urban_range_min', 30.0)
            max_urban = conditions.get('clc_urban_range_max', 60.0)
            if not (min_urban <= urban_pct <= max_urban):
                return 0.0

            building_metrics = bdtopo_service.calculate_building_density(longitude, latitude)
            if building_metrics.get('building_count', 0) == 0:
                return 0.0

            coverage = building_metrics.get('building_coverage_pct', 0.0)
            avg_height = building_metrics.get('average_height', 0.0)
            density_score = building_metrics.get('building_density_score', 0.0)

            score = min(density_score, 80.0)
            if coverage > 40.0 or coverage < 20.0:
                score += 10.0
            if avg_height > 15.0:
                score += 10.0
            return min(score, 100.0)
        except Exception as e:
            logger.debug("Error scoring building density verification: %s", e)
            return 0.0

    def _score_bocage_characteristics(self, longitude: float, latitude: float, gdf) -> float:
        if not self._has_bocage_characteristics(longitude, latitude, gdf):
            return 0.0
        extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
        if not extent_pct:
            return 0.0

        agri_pct = extent_pct.get('agriculture', 0)
        complex_pct = extent_pct.get('complex_agriculture', 0)
        forest_pct = extent_pct.get('forest', 0)
        urban_pct = extent_pct.get('urban', 0)

        score = 0.0
        if agri_pct > 25:
            score += min((agri_pct - 25) / 25.0, 1.0) * 25.0
        if complex_pct > 10:
            score += min((complex_pct - 10) / 10.0, 1.0) * 30.0
        if forest_pct > 15:
            score += min((forest_pct - 15) / 15.0, 1.0) * 25.0
        if urban_pct < 60:
            score += (60 - urban_pct) / 60.0 * 20.0
        return min(score, 100.0)

    def _score_open_countryside(self, longitude: float, latitude: float, gdf) -> float:
        multi_scale_data = self._multi_scale_analysis(longitude, latitude, gdf, [1.0, 2.0])
        score = 0.0
        for scale, data in multi_scale_data.items():
            agri_pct = data.get('agriculture', 0)
            complex_pct = data.get('complex_agriculture', 0)
            forest_pct = data.get('forest', 0)
            urban_pct = data.get('urban', 0)
            total_agri = agri_pct + complex_pct

            agri_score = min(total_agri / 60.0, 1.0) * 40.0
            urban_penalty = max(0, urban_pct / 5.0) * 30.0
            forest_penalty = max(0, (forest_pct - 30.0) / 30.0) * 20.0
            complex_penalty = max(0, (complex_pct - 35.0) / 35.0) * 10.0
            scale_score = agri_score - urban_penalty - forest_penalty - complex_penalty
            scale_weight = 0.6 if scale == 2.0 else 0.4
            score += max(0, scale_score) * scale_weight
        return min(score, 100.0)

    def _score_transitional_zone(self, longitude: float, latitude: float, gdf) -> float:
        if not self._is_enhanced_transitional_zone(longitude, latitude, gdf):
            return 0.0
        extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
        if not extent_pct:
            return 0.0

        agri_pct = extent_pct.get('agriculture', 0)
        complex_pct = extent_pct.get('complex_agriculture', 0)
        forest_pct = extent_pct.get('forest', 0)
        urban_pct = extent_pct.get('urban', 0)

        score = 0.0
        if complex_pct >= 10 and urban_pct >= 5:
            score += 40.0
        if complex_pct >= 10 and (agri_pct > 20 or forest_pct > 10):
            score += 30.0
        if 40 <= urban_pct <= 60 and complex_pct >= 10:
            score += 30.0
        return min(score, 100.0)

    def _score_proximity_urban(self, longitude: float, latitude: float, gdf) -> float:
        threshold_km = terrain_config_service.get_spatial_parameter('distance_thresholds_km', 'urban_proximity', 3.0)
        if self._is_near_urban(longitude, latitude, gdf, threshold_km):
            return self._calculate_distance_score(longitude, latitude, 'urban', threshold_km, gdf=gdf)
        return 0.0

    def _score_proximity_forest(self, longitude: float, latitude: float, gdf) -> float:
        threshold_km = terrain_config_service.get_spatial_parameter('distance_thresholds_km', 'forest_proximity', 2.0)
        if self._is_near_forest(longitude, latitude, gdf, threshold_km) and self._has_meaningful_forest_agriculture_mix(longitude, latitude, gdf):
            return self._calculate_distance_score(longitude, latitude, 'forest', threshold_km, gdf=gdf)
        return 0.0

    def _calculate_distance_score(self, longitude: float, latitude: float, category: str, threshold_km: float, gdf=None) -> float:
        try:
            if gdf is None or len(gdf) == 0:
                return 0.0
            if category == 'urban':
                codes = ['111', '112', '141', '121', '122', '123', '124', '131', '132', '133', '142']
            elif category == 'forest':
                codes = ['311', '312', '313', '321', '322', '323', '324']
            else:
                return 0.0

            nearest_distance = calculate_distance_to_codes(longitude, latitude, gdf, codes)
            if nearest_distance <= threshold_km:
                return (1.0 - nearest_distance / threshold_km) * 100.0
            return 0.0
        except Exception as e:
            logger.debug("Error calculating distance score for %s: %s", category, e)
            return 0.0

    def _apply_classification_rule(
        self,
        rule_name: str,
        rule: dict,
        terrain_type: str,
        longitude: float,
        latitude: float,
        gdf,
    ) -> bool:
        try:
            conditions = rule.get('conditions', {})
            if rule_name == 'forest_gaps_in_urban':
                return terrain_type in conditions.get('applicable_to_terrain', ['IV']) and self._score_forest_gaps_in_urban(longitude, latitude, gdf) > 0.0
            if rule_name == 'coastline_proximity_1km':
                return self._is_near_physical_coastline(longitude, latitude, threshold_km=conditions.get('distance_threshold_km', 1.0))
            if rule_name == 'coastal_exposure':
                return self._has_exposed_coastal_conditions(longitude, latitude, gdf)
            if rule_name == 'dense_urban':
                return terrain_type in conditions.get('applicable_to_terrain', ['II', 'IIIb']) and self._is_dense_urban_area(longitude, latitude, gdf)
            if rule_name == 'bocage_characteristics':
                return terrain_type in conditions.get('applicable_to_terrain', ['IV', 'IIIb']) and self._has_bocage_characteristics(longitude, latitude, gdf)
            if rule_name == 'open_countryside':
                return terrain_type in conditions.get('applicable_to_terrain', ['IIIa']) and self._is_actually_open_countryside(longitude, latitude, gdf)
            if rule_name == 'transitional_zone':
                return terrain_type in conditions.get('applicable_to_terrain', ['II']) and self._is_enhanced_transitional_zone(longitude, latitude, gdf)
            if rule_name == 'proximity_urban':
                return terrain_type in conditions.get('applicable_to_terrain', ['II']) and self._is_near_urban(longitude, latitude, gdf)
            if rule_name == 'proximity_forest':
                return (
                    terrain_type in conditions.get('applicable_to_terrain', ['II'])
                    and self._is_near_forest(longitude, latitude, gdf)
                    and self._has_meaningful_forest_agriculture_mix(longitude, latitude, gdf)
                )
            return False
        except Exception as e:
            logger.debug("Error applying rule %s: %s", rule_name, e)
            return False

    def _get_rule_result(self, rule_name: str, terrain_type: str, longitude: float, latitude: float, gdf) -> str:
        rules = terrain_config_service.get_classification_rules()
        rule = rules.get(rule_name, {})
        if rule_name == 'forest_gaps_in_urban':
            return rule.get('conditions', {}).get('target_terrain', 'IIIa')
        if rule_name in ('coastline_proximity_1km', 'coastal_exposure'):
            return '0'
        if rule_name == 'dense_urban':
            return 'IV'
        if rule_name == 'building_density_verification':
            building_result = self._verify_dense_urban_with_buildings(longitude, latitude, 0.0)
            if building_result is True:
                return 'IV'
            if building_result is False:
                return 'IIIb'
            return terrain_type
        if rule_name in ('bocage_characteristics', 'transitional_zone'):
            return 'IIIa'
        if rule_name == 'open_countryside':
            return 'II'
        if rule_name == 'proximity_urban':
            return rule.get('conditions', {}).get('target_terrain', 'IIIb')
        if rule_name == 'proximity_forest':
            return rule.get('conditions', {}).get('target_terrain', 'IIIa')
        return terrain_type

    def _generate_rule_explanation(
        self,
        rule_name: str,
        rule: dict,
        terrain_type: str,
        longitude: float,
        latitude: float,
        gdf,
    ) -> str:
        try:
            if rule_name == 'forest_gaps_in_urban':
                from django.contrib.gis.geos import Point as GISPoint
                from django.contrib.gis.db.models.functions import Distance
                from django.contrib.gis.measure import D
                from geodata.models import BuildingBlock

                p = GISPoint(longitude, latitude, srid=4326)
                nearest = (
                    BuildingBlock.objects.filter(geometry__distance_lte=(p, D(m=5000)))
                    .annotate(distance=Distance('geometry', p))
                    .order_by('distance')
                    .first()
                )
                distance_m = nearest.distance.m if nearest else 0.0
                return f"Forest gap in urban zone: Point is in CLC 111 (continuous urban fabric) but nearest building is {distance_m:.1f}m away (demoted to IIIa)"

            if rule_name == 'coastline_proximity_1km':
                threshold = rule.get('conditions', {}).get('distance_threshold_km', 1.0)
                return f"Coastline proximity: Within {threshold:.1f}km of the physical coastline"

            if rule_name == 'coastal_exposure':
                extent_data = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
                return f"Coastal exposure detected: {extent_data.get('coastal', 0):.1f}% coastal, {extent_data.get('urban', 0):.1f}% urban in 2km radius"

            if rule_name == 'dense_urban':
                extent_data = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
                return f"Dense urban area: {extent_data.get('urban', 0):.1f}% urban coverage exceeds threshold"

            if rule_name == 'building_density_verification':
                extent_data = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
                building_metrics = bdtopo_service.calculate_building_density(longitude, latitude)
                return (
                    f"Building density verification: {extent_data.get('urban', 0):.1f}% CLC urban, "
                    f"{building_metrics.get('building_coverage_pct', 0.0):.1f}% building coverage, "
                    f"{building_metrics.get('average_height', 0.0):.1f}m avg height"
                )

            if rule_name == 'bocage_characteristics':
                extent_data = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
                agri_pct = extent_data.get('agriculture', 0) + extent_data.get('complex_agriculture', 0)
                return f"Bocage pattern: {agri_pct:.1f}% agriculture, {extent_data.get('forest', 0):.1f}% forest indicates rural character"

            if rule_name == 'open_countryside':
                extent_data = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
                total_agri = extent_data.get('agriculture', 0) + extent_data.get('complex_agriculture', 0)
                return f"Open countryside: {total_agri:.1f}% total agriculture indicates open terrain"

            if rule_name == 'transitional_zone':
                extent_data = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
                return f"Transitional zone: {extent_data.get('urban', 0):.1f}% urban, {extent_data.get('complex_agriculture', 0):.1f}% complex agriculture"

            if rule_name == 'proximity_urban':
                distance = self._calculate_distance_to_category(longitude, latitude, 'urban', gdf)
                return f"Urban proximity: {distance:.1f}km to nearest urban area"

            if rule_name == 'proximity_forest':
                distance = self._calculate_distance_to_category(longitude, latitude, 'forest', gdf)
                return f"Forest proximity: {distance:.1f}km to nearest forest area"

            return f"Rule '{rule_name}' applied based on spatial analysis"
        except Exception as e:
            logger.debug("Error generating explanation for rule %s: %s", rule_name, e)
            return f"Rule '{rule_name}' applied"

    def _calculate_distance_to_category(self, longitude: float, latitude: float, category: str, gdf) -> float:
        try:
            spatial_categories = terrain_config_service.get_influence_percentages().get('spatial_extent_categories', {})
            codes = spatial_categories.get(category, {}).get('codes', [])
            return calculate_distance_to_codes(longitude, latitude, gdf, codes)
        except Exception as e:
            logger.debug("Error calculating distance to %s: %s", category, e)
            return float('inf')

    def _is_near_coast(self, longitude: float, latitude: float, gdf, threshold_km: float = None) -> bool:
        try:
            config = terrain_config_service.load_config()
            water_codes = config.get('performance_settings', {}).get('prefilter_categories', {}).get(
                'water_codes',
                ['511', '512', '521', '522', '523', '421', '422', '423', '331', '332', '333', '334', '335'],
            )
            if threshold_km is None:
                threshold_km = terrain_config_service.get_spatial_parameter('distance_thresholds_km', 'coastal_proximity', 5.0)
            return is_near_codes(longitude, latitude, gdf, water_codes, threshold_km, check_exact_distance=True)
        except Exception as e:
            logger.debug("Error checking coastal proximity: %s", e)
            return False

    def _is_near_urban(self, longitude: float, latitude: float, gdf, threshold_km: float = 3.0) -> bool:
        try:
            config = terrain_config_service.load_config()
            urban_codes = config.get('performance_settings', {}).get('prefilter_categories', {}).get(
                'urban_codes',
                ['111', '112', '141', '121', '122', '123', '124', '131', '132', '133', '142'],
            )
            return is_near_codes(longitude, latitude, gdf, urban_codes, threshold_km, check_exact_distance=True)
        except Exception as e:
            logger.debug("Error checking urban proximity: %s", e)
            return False

    def _is_near_forest(self, longitude: float, latitude: float, gdf, threshold_km: float = 2.0) -> bool:
        try:
            forest_codes = ['311', '312', '313', '321', '322', '323', '324']
            return is_near_codes(longitude, latitude, gdf, forest_codes, threshold_km, check_exact_distance=False)
        except Exception as e:
            logger.debug("Error checking forest proximity: %s", e)
            return False

    def _has_meaningful_forest_agriculture_mix(self, longitude: float, latitude: float, gdf) -> bool:
        try:
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, 2.0)
            if not extent_pct:
                return False
            forest_pct = extent_pct.get('forest', 0)
            total_agri = extent_pct.get('agriculture', 0) + extent_pct.get('complex_agriculture', 0)
            return forest_pct >= 45.0 and total_agri >= 40.0
        except Exception as e:
            logger.debug("Error checking forest-agriculture mix: %s", e)
            return False

    def _has_dispersed_habitat_pattern(self, longitude: float, latitude: float, gdf, radius_km: float = 1.0) -> bool:
        try:
            point = Point(longitude, latitude)
            search_area = point.buffer(radius_km / 111.0)
            intersects = gdf[gdf.geometry.intersects(search_area)]
            if len(intersects) < 3:
                return False
            unique_codes = set(intersects['Code_18'].tolist())
            has_agri = bool(unique_codes & {'211', '212', '213', '231', '241', '242', '243', '244'})
            has_forest = bool(unique_codes & {'311', '312', '313', '321', '322', '323', '324'})
            has_complex = bool(unique_codes & {'242', '243', '244'})
            return (has_agri and has_forest) or has_complex
        except Exception as e:
            logger.debug("Error checking dispersed habitat pattern: %s", e)
            return False

    def _is_transitional_zone(self, longitude: float, latitude: float, gdf, radius_km: float = 2.0) -> bool:
        try:
            point = Point(longitude, latitude)
            search_area = point.buffer(radius_km / 111.0)
            intersects = gdf[gdf.geometry.intersects(search_area)]
            if len(intersects) < 3:
                return False

            unique_codes = set(intersects['Code_18'].tolist())
            code_counts = intersects['Code_18'].value_counts()

            agri_codes = {'211', '212', '213', '231'}
            complex_agri = {'241', '242', '243', '244'}
            forest_codes = {'311', '312', '313', '321', '322', '323', '324'}
            urban_codes = {'111', '112', '121', '122', '123', '124', '131', '132', '133', '142'}

            has_agri = bool(unique_codes & agri_codes)
            has_complex_agri = bool(unique_codes & complex_agri)
            has_forest = bool(unique_codes & forest_codes)
            has_urban = bool(unique_codes & urban_codes)

            if has_complex_agri and (has_agri or has_urban):
                return True
            if has_agri and has_urban and has_forest:
                urban_count = sum(code_counts.get(code, 0) for code in unique_codes & urban_codes)
                if urban_count / len(intersects) < 0.6:
                    return True
            return False
        except Exception as e:
            logger.debug("Error checking transitional zone: %s", e)
            return False

    def _has_coastal_exposure(self, longitude: float, latitude: float, gdf, threshold_km: float = 2.0) -> bool:
        try:
            point = Point(longitude, latitude)
            coastal_codes = ['521', '522', '523', '423']
            beach_codes = ['331']
            inland_water_codes = ['511', '512']

            search_area = point.buffer(threshold_km / 111.0)
            coastal_areas = gdf[gdf['Code_18'].isin(coastal_codes + beach_codes + inland_water_codes)]
            if len(coastal_areas) == 0:
                return False

            nearby_coastal = coastal_areas[coastal_areas.geometry.intersects(search_area)]
            if len(nearby_coastal) > 0:
                coastal_water_count = int(nearby_coastal['Code_18'].isin(coastal_codes).sum())
                extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=threshold_km)
                if extent_pct:
                    if extent_pct.get('urban', 0) > 50:
                        return coastal_water_count > 0
                    if extent_pct.get('coastal', 0) > 5:
                        return True
                return coastal_water_count > 0
            return False
        except Exception as e:
            logger.debug("Error checking coastal exposure: %s", e)
            return False

    def _is_dense_urban_coastal(self, longitude: float, latitude: float, gdf, radius_km: float = 3.0) -> bool:
        try:
            point = Point(longitude, latitude)
            dense_urban_codes = {'111', '112'}
            urban_codes = {'121', '122', '123', '124', '131', '132', '133', '142'}

            search_area = point.buffer(radius_km / 111.0)
            area_intersects = gdf[gdf.geometry.intersects(search_area)]
            if len(area_intersects) == 0:
                return False

            unique_codes = set(area_intersects['Code_18'].tolist())
            code_counts = area_intersects['Code_18'].value_counts()
            total_polygons = len(area_intersects)

            dense_urban_count = sum(code_counts.get(code, 0) for code in unique_codes & dense_urban_codes)
            total_urban_count = sum(code_counts.get(code, 0) for code in unique_codes & (urban_codes | dense_urban_codes))

            return (dense_urban_count / total_polygons > 0.4) or (total_urban_count / total_polygons > 0.7)
        except Exception as e:
            logger.debug("Error checking dense urban coastal: %s", e)
            return False

    def _is_dense_urban_area(self, longitude: float, latitude: float, gdf, radius_km: float = 2.0) -> bool:
        try:
            point = Point(longitude, latitude)
            intersects = self._optimized_spatial_query(point, gdf)
            if len(intersects) > 0 and intersects.iloc[0]['Code_18'] in ['121', '142']:
                return False

            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km)
            if not extent_pct:
                return False

            thresholds = terrain_config_service.get_spatial_analysis_config()
            dense_urban_threshold = thresholds.get('density_thresholds', {}).get('dense_urban_fabric', 0.35)
            total_urban_threshold = thresholds.get('density_thresholds', {}).get('total_urban_area', 0.65)

            urban_pct = extent_pct.get('urban', 0)
            agri_pct = extent_pct.get('agriculture', 0)

            building_config = terrain_config_service.load_config().get('building_density_analysis', {})
            cond = building_config.get('conditions', {})
            if (
                building_config.get('enabled', True)
                and cond.get('clc_urban_range_min', 30.0) <= urban_pct <= cond.get('clc_urban_range_max', 60.0)
            ):
                building_result = self._verify_dense_urban_with_buildings(longitude, latitude, urban_pct)
                if building_result is not None:
                    return building_result

            if agri_pct > 40.0 and urban_pct < 60.0:
                return False
            if urban_pct > (total_urban_threshold * 100):
                return True
            if agri_pct > 20.0:
                return urban_pct > (dense_urban_threshold * 1.4 * 100)
            return urban_pct > (dense_urban_threshold * 100)
        except Exception as e:
            logger.debug("Error checking dense urban area: %s", e)
            return False

    def _verify_dense_urban_with_buildings(self, longitude: float, latitude: float, clc_urban_pct: float) -> Optional[bool]:
        try:
            building_metrics = bdtopo_service.calculate_building_density(longitude, latitude)
            if building_metrics.get('building_count', 0) == 0:
                return None

            building_config = terrain_config_service.load_config().get('building_density_analysis', {})
            decision_matrix = building_config.get('decision_matrix', {})
            coverage = building_metrics.get('building_coverage_pct', 0.0)
            avg_height = building_metrics.get('average_height', 0.0)

            for case_name, criteria in decision_matrix.items():
                if self._matches_building_criteria(coverage, avg_height, criteria):
                    return criteria.get('result') == 'IV'

            density_score = building_metrics.get('building_density_score', 0.0)
            score_threshold = building_config.get('thresholds', {}).get('density_score_threshold', 50.0)
            return density_score >= score_threshold
        except Exception as e:
            logger.debug("Error in building density verification: %s", e)
            return None

    def _score_forest_gaps_in_urban(self, longitude: float, latitude: float, gdf) -> float:
        try:
            point = Point(longitude, latitude)
            intersects = self._optimized_spatial_query(point, gdf)
            if len(intersects) == 0 or intersects.iloc[0]['Code_18'] != '111':
                return 0.0

            from geodata.models import BuildingBlock
            from django.contrib.gis.measure import D
            from django.contrib.gis.geos import Point as GISPoint

            p = GISPoint(longitude, latitude, srid=4326)
            if not BuildingBlock.objects.filter(geometry__distance_lte=(p, D(m=5000))).exists():
                return 0.0

            config = terrain_config_service.load_config()
            threshold_m = (
                config.get('classification_rules', {})
                .get('forest_gaps_in_urban', {})
                .get('conditions', {})
                .get('search_radius_m', 50.0)
            )
            if not BuildingBlock.objects.filter(geometry__distance_lte=(p, D(m=threshold_m))).exists():
                return 100.0
            return 0.0
        except Exception as e:
            logger.error("Error checking forest gaps in urban zone: %s", e)
            return 0.0

    def _matches_building_criteria(self, coverage: float, height: float, criteria: dict) -> bool:
        try:
            if 'coverage_min' in criteria and coverage < criteria['coverage_min']:
                return False
            if 'coverage_max' in criteria and coverage > criteria['coverage_max']:
                return False
            if 'height_min' in criteria and height < criteria['height_min']:
                return False
            if 'height_max' in criteria and height > criteria['height_max']:
                return False
            return True
        except Exception:
            return False

    def _has_exposed_coastal_conditions(self, longitude: float, latitude: float, gdf) -> bool:
        try:
            return (
                self._is_near_coast(longitude, latitude, gdf, threshold_km=2.0)
                and self._has_coastal_exposure(longitude, latitude, gdf)
                and not self._is_dense_urban_coastal(longitude, latitude, gdf)
            )
        except Exception as e:
            logger.debug("Error checking exposed coastal conditions: %s", e)
            return False

    def _is_enhanced_transitional_zone(self, longitude: float, latitude: float, gdf) -> bool:
        try:
            if not self._is_transitional_zone(longitude, latitude, gdf):
                return False
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=2.0)
            if not extent_pct:
                return False

            agri_pct = extent_pct.get('agriculture', 0)
            complex_pct = extent_pct.get('complex_agriculture', 0)
            forest_pct = extent_pct.get('forest', 0)
            urban_pct = extent_pct.get('urban', 0)

            if (agri_pct > 60 and urban_pct < 10) or agri_pct > 70:
                return False
            if complex_pct >= 10 and urban_pct >= 5:
                return True
            if complex_pct >= 10 and (agri_pct > 20 or forest_pct > 10):
                return True
            if 40 <= urban_pct <= 60 and complex_pct >= 10:
                return True
            return False
        except Exception as e:
            logger.debug("Error checking enhanced transitional zone: %s", e)
            return False

    def _has_bocage_characteristics(self, longitude: float, latitude: float, gdf) -> bool:
        try:
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=2.0)
            if not extent_pct:
                return False
            return (
                extent_pct.get('agriculture', 0) > 25
                and extent_pct.get('complex_agriculture', 0) > 10
                and extent_pct.get('forest', 0) > 15
                and extent_pct.get('urban', 0) < 60
            )
        except Exception as e:
            logger.debug("Error checking bocage characteristics: %s", e)
            return False

    def _is_actually_open_countryside(self, longitude: float, latitude: float, gdf) -> bool:
        try:
            extent_pct = self._calculate_spatial_extent_percentages(longitude, latitude, gdf, radius_km=2.0)
            if not extent_pct:
                return False
            agri_pct = extent_pct.get('agriculture', 0)
            complex_pct = extent_pct.get('complex_agriculture', 0)
            forest_pct = extent_pct.get('forest', 0)
            urban_pct = extent_pct.get('urban', 0)
            return (
                (agri_pct + complex_pct) > 60
                and urban_pct < 5
                and forest_pct < 30
                and complex_pct < 35
            )
        except Exception as e:
            logger.debug("Error checking open countryside: %s", e)
            return False

