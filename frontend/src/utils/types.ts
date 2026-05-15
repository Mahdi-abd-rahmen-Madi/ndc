// Terrain Types
export type TerrainType = '0' | 'II' | 'IIIa' | 'IIIb' | 'IV';

// CLC Code Types
export interface CLCCodeMapping {
  codes: string[];
  code_descriptions: Record<string, string>;
}

export interface TerrainMapping {
  terrain_0: CLCCodeMapping;
  terrain_II: CLCCodeMapping;
  terrain_IIIa: CLCCodeMapping;
  terrain_IIIb: CLCCodeMapping;
  terrain_IV: CLCCodeMapping;
}

// Classification Rule Types
export interface RuleCondition {
  [key: string]: boolean | number | string | string[];
}

export interface ClassificationRule {
  enabled: boolean;
  priority: number;
  description: string;
  conditions: RuleCondition;
}

export interface ClassificationRules {
  coastal_exposure: ClassificationRule;
  dense_urban: ClassificationRule;
  bocage_characteristics: ClassificationRule;
  open_countryside: ClassificationRule;
  transitional_zone: ClassificationRule;
  proximity_urban: ClassificationRule;
  proximity_forest: ClassificationRule;
}

// Spatial Analysis Types
export interface DistanceThresholds {
  coastal_proximity: number;
  coastal_exposure: number;
  urban_proximity: number;
  forest_proximity: number;
}

export interface AnalysisRadii {
  dispersed_habitat: number;
  transitional_zone: number;
  dense_urban: number;
  dense_urban_coastal: number;
  spatial_extent: number;
}

export interface DensityThresholds {
  dense_urban_fabric: number;
  total_urban_area: number;
  dense_urban_coastal: number;
  urban_dominance: number;
}

export interface SpatialAnalysis {
  distance_thresholds_km: DistanceThresholds;
  analysis_radii_km: AnalysisRadii;
  density_thresholds: DensityThresholds;
  spatial_extent_thresholds: Record<string, number>;
}

// Influence Percentage Types
export interface InfluenceCategory {
  description: string;
  default_weight: number;
  codes: string[];
}

export interface InfluencePercentages {
  spatial_extent_categories: Record<string, InfluenceCategory>;
}

// Configuration Types
export interface ConfigMetadata {
  version: string;
  last_updated: string;
}

export interface TerrainConfig {
  metadata: ConfigMetadata;
  clc_code_mappings: TerrainMapping;
  classification_rules: ClassificationRules;
  spatial_analysis: SpatialAnalysis;
  influence_percentages: InfluencePercentages;
}

// API Response Types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SpatialExtent {
  agriculture: number;
  complex_agriculture: number;
  forest: number;
  urban: number;
  coastal: number;
}

export interface ApplicableRule {
  name: string;
  priority: number;
}

export interface BuildingDensityVerification {
  building_count: number;
  building_coverage_pct: number;
  average_height: number;
  explanation: string;
}

export interface TerrainClassificationResponse {
  terrain_type: TerrainType;
  base_terrain_type: TerrainType;
  coordinates: Coordinates;
  spatial_extent: SpatialExtent;
  detected_clc_codes: string[];
  applicable_rules: ApplicableRule[];
  rule_explanations: Record<string, string | BuildingDensityVerification>;
  region?: {
    name: string;
    number: number;
  };
}

export interface FastClassificationResponse {
  terrain_type: TerrainType;
  latitude: number;
  longitude: number;
}

// Region Types
export interface RegionFeature {
  type: 'Feature';
  properties: {
    name: string;
    description: string;
    region_id: number;
  };
  geometry: GeoJSON.Geometry;
}

export interface RegionGeoJSON {
  type: 'FeatureCollection';
  features: RegionFeature[];
}

// BDTOPO Types
export interface BuildingLayer {
  id: string;
  type: 'fill';
  source: string;
  'source-layer': string;
  paint: {
    'fill-color': string;
    'fill-outline-color': string;
    'fill-opacity': number;
  };
  layout: {
    visibility: 'visible' | 'none';
  };
}

// Process Flow Types
export interface ProcessStep {
  number: number;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'current' | 'skipped';
  details?: string;
  result?: {
    type: 'success' | 'failure' | 'info';
    text: string;
  };
}

export interface DecisionBranch {
  condition: string;
  result: boolean;
  explanation: string;
}

// Component Props Types
export interface TerrainMapProps {
  onMapClick: (lat: number, lng: number) => void;
  onMapLoad?: (map: maplibregl.Map) => void;
}

export interface CLCLegendProps {
  detectedCodes: string[];
  config: TerrainConfig | null;
}

export interface InfoPanelProps {
  classificationResult: TerrainClassificationResponse | null;
  loading: boolean;
  error: string | null;
  currentAnalysisRadius: number;
}

export interface ConfigTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  classificationResult: TerrainClassificationResponse | null;
  config: TerrainConfig | null;
  currentAnalysisRadius: number;
  onRadiusChange: (radius: number) => void;
}

export interface BDTOPOControlsProps {
  visible: boolean;
  onToggle: () => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  showDensity: boolean;
  onDensityToggle: (show: boolean) => void;
  colorByHeight: boolean;
  onHeightColoringToggle: (color: boolean) => void;
}

export interface RegionControlProps {
  visible: boolean;
  onToggle: () => void;
}
