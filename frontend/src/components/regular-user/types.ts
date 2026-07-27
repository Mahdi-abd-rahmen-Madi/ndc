export interface AntennaSpec {
  model?: string;
  height: number;
  width: number;
  thickness: number;
  weight: number;
}

export interface MontageConfig {
  id: string;
  name: string;
  abbreviation: string;
  ant4g: AntennaSpec;
  ant5g: AntennaSpec;
}

export interface RealWorldReference {
  id: string;
  name: string;
  montageId: string;
  ant4g: { model: string; height: number; width: number; thickness: number; weight: number; };
  ant5g: { model: string; height: number; width: number; thickness: number; weight: number; };
}

export interface CatalogueConfig {
  precalculated_building_heights: number[];
  recommended_mast_heights: number[];
  fh_weight_options: number[];
  standard_montages: MontageConfig[];
  real_world_references: RealWorldReference[];
  coffret_references: { id: string; name: string }[];
}

export interface DocumentInfo {
  filename: string;
  url: string;
  ext: string;
  localUrl?: string;
}

export interface TerrainDetails {
  terrain: string;
  material: string;
  docList: DocumentInfo[];
  matPrincipal?: string;
  plotMetallique?: string;
  brasDeDeport?: string;
  matSecondaire?: string;
}

export interface LookupResult {
  detected_terrain_type: string;
  detected_region: string;
  equipment: any[];
}

export interface AntennaConfigState {
  model: string;
  height: number;
  width: number;
  thickness: number;
  weight: number;
}

export interface RequestFormData {
  name: string;
  email: string;
  phone: string;
  description: string;
}

export interface PreviewDocState {
  url: string;
  filename: string;
  isConverting: boolean;
  originalUrl?: string;
  conversionFailed?: boolean;
}

export type ConfigMode = 'agile' | 'reference';
export type SimilarityMode = 'all_similar' | 'all_different' | 'none';

export interface SectorData {
  id: number;
  selectedHeight: number;
  selectedMontage4G: string;
  selectedMontage5G: string;
  configMode: ConfigMode;
  selectedReference4G: string;
  selectedReference5G: string;
  ant4gConfig: AntennaConfigState;
  ant5gConfig: AntennaConfigState;
  // Custom materials
  matPrincipal: string;
  plotMetallique: string;
  brasDeDeport: string;
  matSecondaire: string;
  // State for catalogue results specific to this sector
  lookupResult?: LookupResult | null;
  loading?: boolean;
  error?: string | null;
}

