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
  operator?: string;
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
  coffret_references: { id: string; name: string; operator?: string }[];
  fh_references: { id: string; vendor: string; name: string; diameter: number; weight: number; reference: string }[];
  td_references: { id: string; vendor: string; name: string; reference: string; weight: number; dimensions: string; phase?: 'monophase' | 'tetraphase' | string }[];
  tgbt_references?: { id: string; vendor?: string; supplier?: string; name: string; reference: string; operator?: string; weight?: number; dimensions?: string }[];
  rru_references: {
    id: string;
    vendor: string;
    reference: string;
    operator?: string;
    dimensions?: string;
    height?: number;
    width?: number;
    thickness?: number;
    weight?: number;
    cf_front?: number;
    cf_lat?: number;
    surf_front?: number;
    surf_lat?: number;
    cx_front?: number;
    cx_lat?: number;
  }[];
  rrh_references: {
    id: string;
    vendor: string;
    reference: string;
    short_reference?: string;
    name?: string;
    operator?: string;
    dimensions?: string;
    height?: number;
    width?: number;
    thickness?: number;
    weight?: number;
    cscd?: number;
    cf_front?: number;
    cf_lat?: number;
    surf_front?: number;
    surf_lat?: number;
    cx_front?: number;
    cx_lat?: number;
    fw_formula?: string;
  }[];
  boitier_lovage_references?: { id: string; vendor: string; reference: string }[];
  atelier_energie_references?: { id: string; vendor?: string; supplier?: string; name: string; reference: string; operator?: string; power?: string; phase?: string; height?: number; width?: number; thickness?: number; weight?: number; dimensions?: string }[];
  baie_references?: BaieReference[];
}

export interface BaieReference {
  id: string;
  name: string;
  reference: string;
  category: 'radio_trans' | 'energie' | 'distribution' | 'raccordement' | string;
  category_label?: string;
  dimensions?: string;
  height?: number | null;
  width?: number | null;
  depth?: number | null;
  weight?: number | null;
  operator?: string;
}

export interface SelectedBaieItem {
  id: string;
  referenceId: string;
  quantity: number;
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

export interface EquipmentItem {
  id: string;
  reference: string;
  quantity: number;
  vendor?: string;
}

export interface SectorData {
  id: number;
  selectedHeight: number;
  selectedMontage4G: string;
  selectedMontage5G: string;
  configMode: ConfigMode;
  selectedVendor4G: string;
  selectedVendor5G: string;
  selectedReference4G: string;
  selectedReference5G: string;
  ant4gConfig: AntennaConfigState;
  ant5gConfig: AntennaConfigState;
  // Custom materials
  matPrincipal: string;
  plotMetallique: string;
  brasDeDeport: string;
  matSecondaire: string;
  // Equipment
  hasFhEquipment?: boolean;
  fhDiameter?: number;
  fhReference?: string;
  fhQuantity?: number;
  hasRrhEquipment?: boolean;
  rrhItems?: EquipmentItem[];
  hasRruEquipment?: boolean;
  rruItems?: EquipmentItem[];
  hasCoffret?: boolean;
  coffretReference?: string;
  // State for catalogue results specific to this sector
  lookupResult?: LookupResult | null;
  loading?: boolean;
  error?: string | null;
}

export interface ZoneTechniqueData {
  hasTdEquipment: boolean;
  tdType: 'tetraphase' | 'monophase';
  tdReference: string;
  hasTgbt: boolean;
  tgbtReference: string;

  hasGps: boolean;
  gpsReference: string;
  gpsMarque: string;

  hasBoitierLovage: boolean;
  boitierLovageReference: string;
  boitierLovageQuantity: number;

  hasAtelierEnergie: boolean;
  bcubeReference: string;

  hasBaie: boolean;
  baieItems: SelectedBaieItem[];
  baieRadio: boolean;
  baieEnergie: boolean;

  hasCab: boolean;
  cabOne: boolean;
  cabTwo: boolean;
  cabThree: boolean;
  cabSupport: string;

  atelierFprb: boolean;
  atelierFprbQuantity: number;
  atelierFpbc: boolean;
  atelierFpbcQuantity: number;

  hasConvertisseurMdea: boolean;
  convertisseurMdeaQuantity: number;
}

export const defaultZoneTechniqueData: ZoneTechniqueData = {
  hasTdEquipment: false,
  tdType: 'tetraphase',
  tdReference: '',
  hasTgbt: false,
  tgbtReference: '',

  hasGps: false,
  gpsReference: '',
  gpsMarque: 'NOKIA',

  hasBoitierLovage: false,
  boitierLovageReference: '',
  boitierLovageQuantity: 1,

  hasAtelierEnergie: false,
  bcubeReference: '',

  hasBaie: false,
  baieItems: [],
  baieRadio: false,
  baieEnergie: false,

  hasCab: false,
  cabOne: false,
  cabTwo: false,
  cabThree: false,
  cabSupport: 'plinthes',

  atelierFprb: false,
  atelierFprbQuantity: 1,
  atelierFpbc: false,
  atelierFpbcQuantity: 1,

  hasConvertisseurMdea: false,
  convertisseurMdeaQuantity: 1,
};

export interface ProjectData {
  siteName: string;
  clientName: string;
  codeSite: string;
  operator: string;
  siteImageUrl: string | null;
  buildingHeight: number | string;
  dalleThickness: number | string;
  etancheite: number | string;
  plotHeight: number;
  hasChauffageAuSol: boolean;
  fausseDalleThickness: number | string;
  selectedEchelle: string;
}

export const defaultProjectData: ProjectData = {
  siteName: '',
  clientName: '',
  codeSite: '',
  operator: '',
  siteImageUrl: null,
  buildingHeight: '',
  dalleThickness: '',
  etancheite: '',
  plotHeight: 0.5,
  hasChauffageAuSol: false,
  fausseDalleThickness: '',
  selectedEchelle: '',
};

export const defaultSectorData = (id: number): SectorData => ({
  id,
  selectedHeight: 3,
  selectedMontage4G: '',
  selectedMontage5G: '',
  configMode: 'agile',
  selectedVendor4G: '',
  selectedVendor5G: '',
  selectedReference4G: '',
  selectedReference5G: '',
  ant4gConfig: { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
  ant5gConfig: { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
  matPrincipal: '',
  plotMetallique: '',
  brasDeDeport: '',
  matSecondaire: '',
  hasFhEquipment: false,
  fhDiameter: 300,
  fhReference: '',
  fhQuantity: 1,
  hasRrhEquipment: false,
  rrhItems: [{ id: crypto.randomUUID(), reference: '', quantity: 1 }],
  hasRruEquipment: false,
  rruItems: [{ id: crypto.randomUUID(), reference: '', quantity: 1 }],
  hasCoffret: false,
  coffretReference: '',
  lookupResult: null,
  loading: false,
  error: null
});

