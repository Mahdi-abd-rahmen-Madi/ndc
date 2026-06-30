export interface AntennaSpec {
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

export interface CatalogueConfig {
  precalculated_building_heights: number[];
  recommended_mast_heights: number[];
  fh_weight_options: number[];
  standard_montages: MontageConfig[];
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
