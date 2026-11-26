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
  fh_references: { id: string; vendor: string; name: string; diameter: number; weight: number; reference: string; operator?: string }[];
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
  bouygues_antennas?: Array<{
    id: string;
    type: '4G' | '5G' | string;
    operator: string;
    dimensions: string;
    height: number;
    width: number;
    thickness: number;
    weight: number;
    cf_front: number;
    cf_lat: number;
    surf_front: number;
    surf_lat: number;
    cx_front: number;
    cx_lat: number;
  }>;
  free_antennas?: Array<{
    id: string;
    type: '4G' | '5G' | string;
    vendor?: string;
    name?: string;
    model?: string;
    dimensions: string;
    height: number;
    width: number;
    thickness: number;
    weight: number;
    cf_front: number;
    cf_lat: number;
    surf_front: number;
    surf_lat: number;
    cx_front: number;
    cx_lat: number;
  }>;
  orange_antennas?: Array<{
    id: string;
    type: '4G' | '5G' | string;
    vendor?: string;
    name?: string;
    model?: string;
    dimensions: string;
    height: number;
    width: number;
    thickness: number;
    weight: number;
    cf_front: number;
    cf_lat: number;
    surf_front: number;
    surf_lat: number;
    cx_front: number;
    cx_lat: number;
  }>;
  wind_calculation_rules?: {
    cscd: number;
    fw_formula: string;
    surf_front_formula: string;
    surf_lat_formula: string;
    description?: string;
  };
}

export interface BaieReference {
  id: string;
  name: string;
  reference: string;
  vendor?: string;
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

export type StructureCase = 'cas1' | 'cas2' | 'cas3' | 'cas4';
export const DEFAULT_STRUCTURE_CASE: StructureCase = 'cas1';

const STRUCTURE_CASE_ALIASES: Record<string, StructureCase> = {
  cas1: 'cas1', 'cas 1': 'cas1', cas_1: 'cas1', 'cas-1': 'cas1', c1: 'cas1', a1: 'cas1', '1': 'cas1',
  cas2: 'cas2', 'cas 2': 'cas2', cas_2: 'cas2', 'cas-2': 'cas2', c2: 'cas2', a2: 'cas2', '2': 'cas2',
  cas3: 'cas3', 'cas 3': 'cas3', cas_3: 'cas3', 'cas-3': 'cas3', c3: 'cas3', a3: 'cas3', '3': 'cas3',
  cas4: 'cas4', 'cas 4': 'cas4', cas_4: 'cas4', 'cas-4': 'cas4', c4: 'cas4', a4: 'cas4', '4': 'cas4',
};

export function normalizeStructureCase(raw?: string | null): StructureCase {
  if (!raw) return DEFAULT_STRUCTURE_CASE;
  const cleaned = raw.trim().toLowerCase();
  return STRUCTURE_CASE_ALIASES[cleaned] || DEFAULT_STRUCTURE_CASE;
}

export function formatStructureCaseLabel(raw?: string | null): string {
  const normalized = normalizeStructureCase(raw);
  const num = normalized.replace('cas', '');
  return `Cas ${num}`;
}

export type ConfigMode = 'agile' | 'reference';
export type SimilarityMode = 'all_similar' | 'all_different' | 'none';

export interface EquipmentItem {
  id: string;
  reference: string;
  quantity: number;
  vendor?: string;
  diameter_mm?: number;
  weight_kg?: number;
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
  fhSansPlot?: boolean;
  fhDiameter?: number;
  fhReference?: string;
  fhQuantity?: number;
  fhWeight?: number;
  fhItems?: EquipmentItem[];
  fhFoundationType?: 'metallique' | 'beton' | 'dallettes';
  fhHauteurMatM?: number;
  fhEchelle?: string;
  hasRrhEquipment?: boolean;
  rrhSansPlot?: boolean;
  rrhItems?: EquipmentItem[];
  rrhFoundationType?: 'metallique' | 'beton' | 'dallettes';
  rrhHauteurMatM?: number;
  rrhEchelle?: string;
  hasRruEquipment?: boolean;
  rruSansPlot?: boolean;
  rruItems?: EquipmentItem[];
  rruFoundationType?: 'metallique' | 'beton' | 'dallettes';
  rruHauteurMatM?: number;
  rruEchelle?: string;
  hasCoffret?: boolean;
  coffretReference?: string;
  coffretFoundationType?: 'metallique' | 'beton' | 'dallettes';
  hasBoitierJonction?: boolean;
  boitierJonctionQuantity?: number;
  boitierJonctionFoundationType?: 'metallique' | 'beton' | 'dallettes';
  equipmentFoundationType?: 'metallique' | 'beton' | 'dallettes';
  // State for catalogue results specific to this sector
  lookupResult?: LookupResult | null;
  loading?: boolean;
  error?: string | null;
}

export interface ZoneTechniqueData {
  hasTdEquipment: boolean;
  tdType: 'tetraphase' | 'monophase';
  tdReference: string;
  tdFoundationType: 'metallique' | 'beton' | 'dallettes';
  tdHauteurMatM: number;
  tdEchelle: string;
  hasTgbt: boolean;
  tgbtReference: string;
  tgbtEmplacement?: 'integre_bcube' | 'integre_mat';
  tgbtFoundationType: 'metallique' | 'beton' | 'dallettes';
  tgbtHauteurMatM: number;
  tgbtEchelle: string;

  hasGps: boolean;
  gpsReference: string;
  gpsMarque: string;

  hasBoitierLovage: boolean;
  boitierLovageReference: string;
  boitierLovageQuantity: number;
  boitierLovageFoundationType: 'metallique' | 'beton' | 'dallettes';
  boitierLovageHauteurMatM: number;
  boitierLovageEchelle?: string;

  hasAtelierEnergie: boolean;
  bcubeReference: string;

  hasBcubeRadio: boolean;
  bcubeRadioReference: string;

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

  hasCoffretTransFo?: boolean;
  coffretTransFoQuantity?: number;
  coffretTransFoReference?: string;

  hasPileAmod: boolean;
  amodModules: Record<string, { enabled: boolean; quantity: number }>;
  freeConfigMode?: 'standard' | 'alternative';
}

export const defaultZoneTechniqueData: ZoneTechniqueData = {
  hasTdEquipment: false,
  tdType: 'tetraphase',
  tdReference: '',
  tdFoundationType: 'dallettes',
  tdHauteurMatM: 1.70,
  tdEchelle: "Pas d'échelle",
  hasTgbt: false,
  tgbtReference: '',
  tgbtEmplacement: 'integre_bcube',
  tgbtFoundationType: 'dallettes',
  tgbtHauteurMatM: 1.50,
  tgbtEchelle: "Pas d'échelle",

  hasGps: false,
  gpsReference: '',
  gpsMarque: 'NOKIA',

  hasBoitierLovage: false,
  boitierLovageReference: '',
  boitierLovageQuantity: 1,
  boitierLovageFoundationType: 'dallettes',
  boitierLovageHauteurMatM: 1.50,
  boitierLovageEchelle: "Pas d'échelle",

  hasAtelierEnergie: false,
  bcubeReference: '',

  hasBcubeRadio: false,
  bcubeRadioReference: '',

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

  hasCoffretTransFo: false,
  coffretTransFoQuantity: 1,
  coffretTransFoReference: 'TRANS_FO',

  hasPileAmod: false,
  amodModules: {},
  freeConfigMode: 'standard',
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
  foundationType?: 'metallique' | 'beton' | 'encastre' | 'dallettes';
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
  foundationType: 'metallique',
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
  fhItems: [{ id: crypto.randomUUID(), reference: '', quantity: 1 }],
  fhFoundationType: 'dallettes',
  fhHauteurMatM: 1.70,
  fhEchelle: "Pas d'échelle",
  fhSansPlot: false,
  hasRrhEquipment: false,
  rrhItems: [{ id: crypto.randomUUID(), reference: '', quantity: 1 }],
  rrhFoundationType: 'dallettes',
  rrhHauteurMatM: 1.50,
  hasRruEquipment: false,
  rruItems: [{ id: crypto.randomUUID(), reference: '', quantity: 1 }],
  rruFoundationType: 'dallettes',
  rruHauteurMatM: 1.50,
  hasCoffret: false,
  coffretReference: '',
  coffretFoundationType: 'dallettes',
  hasBoitierJonction: false,
  boitierJonctionQuantity: 1,
  boitierJonctionFoundationType: 'dallettes',
  equipmentFoundationType: 'dallettes',
  lookupResult: null,
  loading: false,
  error: null
});

