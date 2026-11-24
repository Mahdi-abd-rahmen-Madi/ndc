import type { BaieReference } from '../components/regular-user/types';

export interface SimpleCatalogItem {
  id: string;
  name: string;
  reference: string;
  vendor?: string;
  supplier?: string;
  operator?: string;
  weight?: number;
  dimensions?: string;
  phase?: 'monophase' | 'tetraphase' | string;
}

export const RFM_MODELS = [
  { id: 'ARGA', vendor: 'NOKIA', reference: 'ARGA' },
  { id: 'ARDB', vendor: 'NOKIA', reference: 'ARDB' },
  { id: 'ARHA', vendor: 'NOKIA', reference: 'ARHA' },
  { id: 'AREA', vendor: 'NOKIA', reference: 'AREA' },
  { id: 'ARPA', vendor: 'NOKIA', reference: 'ARPA' },
] as const;

export const ALLOWED_BCUBE_OPTIONS: SimpleCatalogItem[] = [
  { id: 'bcube_actia_ae_eltek_9kw', name: 'AE ELTEK 9kw', reference: 'AE ELTEK 9kw', operator: 'bouygues', supplier: 'ACTIA' },
  { id: 'bcube_actia_ae_huawei_15kw', name: 'AE HUAWEI 15kw', reference: 'AE HUAWEI 15kw', operator: 'bouygues', supplier: 'ACTIA' },
  { id: 'bcube_tlti_ae_huawei_9kw', name: 'AE HUAWEI 9kw', reference: 'AE HUAWEI 9kw', operator: 'bouygues', supplier: 'TLTI' },
  { id: 'bcube_tlti_ae_huawei_15kw', name: 'AE HUAWEI 15kw', reference: 'AE HUAWEI 15kw', operator: 'bouygues', supplier: 'TLTI' },
];

export const DEFAULT_BCUBE_RADIO_OPTIONS: SimpleCatalogItem[] = [
  { id: 'bcube_radio_rp6647_5g_tdd', name: 'RP6647 5G TDD', reference: 'RP6647 5G TDD' },
  { id: 'bcube_radio_bb6631_4_5g', name: 'BB6631 4/5G', reference: 'BB6631 4/5G' },
  { id: 'bcube_radio_bb6631_2_3_4g', name: 'BB6631 2/3/4G', reference: 'BB6631 2/3/4G' },
  { id: 'bcube_radio_bb631_2_3_4g', name: 'BB631 2/3/4G', reference: 'BB631 2/3/4G' },
];

export const DEFAULT_TGBT_OPTIONS: SimpleCatalogItem[] = [
  { id: 'tgbt_actia', name: 'ACTIA', reference: 'ACTIA', vendor: 'ACTIA', operator: 'bouygues', dimensions: '500x400x230mm', weight: 15 },
  { id: 'tgbt_tlti', name: 'TLTI', reference: 'TLTI', vendor: 'TLTI', operator: 'bouygues', dimensions: '500x400x230mm', weight: 15 },
];

export const DEFAULT_BOITIER_LOVAGE_OPTIONS: SimpleCatalogItem[] = [
  { id: 'BLM-515709', name: 'Boîte de dérivation OPTIBOX IP55', reference: 'BLM-515709', operator: 'free' },
];

export const DEFAULT_TD_OPTIONS: SimpleCatalogItem[] = [
  { id: 'td_68236', name: '68236', vendor: 'FREE', operator: 'free', weight: 60.0, reference: '68236', phase: 'monophase', dimensions: '1055x850x350mm' },
  { id: 'td_68237', name: '68237', vendor: 'FREE', operator: 'free', weight: 60.0, reference: '68237', phase: 'tetraphase', dimensions: '1055x850x350mm' },
  { id: 'td_5g', name: 'TD 5G', vendor: 'FREE', operator: 'free', weight: 60.0, reference: 'TD 5G', phase: 'monophase', dimensions: '1055x850x350mm' },
  { id: 'td_3g_4g', name: 'TD 3G/4G', vendor: 'FREE', operator: 'free', weight: 50.0, reference: 'TD 3G/4G', phase: 'monophase', dimensions: '536x300x747mm' },
  { id: 'mini_td_700', name: 'Mini TD radio 700', vendor: 'FREE', operator: 'free', weight: 8.0, reference: 'Mini TD radio 700', phase: 'monophase', dimensions: '430x330x200mm' },
  { id: 'mini_td_5g', name: 'Mini TD 5G', vendor: 'FREE', operator: 'free', weight: 15.0, reference: 'Mini TD 5G', phase: 'monophase', dimensions: '530x430x200mm' },
];

export interface FHCatalogItem {
  id: string;
  name: string;
  reference: string;
  vendor: string;
  operator?: string;
  weight: number;
  diameter: number;
}

export const DEFAULT_FH_REFERENCES: FHCatalogItem[] = [
  { id: 'fh_ericsson_60', name: 'BFZ 622 32/3S03H Ø 600 mm', vendor: 'ERICSSON', operator: 'bouygues', weight: 7.6, diameter: 600, reference: 'BFZ 622 32/3S03H Ø 600 mm' },
  { id: 'fh_ericsson_90', name: 'BFZ 622 33/3S03H Ø 900 mm', vendor: 'ERICSSON', operator: 'bouygues', weight: 17, diameter: 900, reference: 'BFZ 622 33/3S03H Ø 900 mm' },
  { id: 'fh_ericsson_120', name: 'BFZ 622 34/3S03H Ø 1200 mm', vendor: 'ERICSSON', operator: 'bouygues', weight: 32, diameter: 1200, reference: 'BFZ 622 34/3S03H Ø 1200 mm' },
  { id: 'fh_huawei_30', name: '30cm Ø 300 mm', vendor: 'HUAWEI', operator: 'free', weight: 6, diameter: 300, reference: '30cm Ø 300 mm' },
  { id: 'fh_huawei_60', name: '60cm Ø 600 mm', vendor: 'HUAWEI', operator: 'free', weight: 14.5, diameter: 600, reference: '60cm Ø 600 mm' },
  { id: 'fh_commscope_30', name: '30cm Ø 300 mm', vendor: 'COMMSCOPE', operator: 'free', weight: 6, diameter: 300, reference: '30cm Ø 300 mm' },
  { id: 'fh_commscope_60', name: '60cm Ø 600 mm', vendor: 'COMMSCOPE', operator: 'free', weight: 14.5, diameter: 600, reference: '60cm Ø 600 mm' },
];

export const STATIC_EQUIPMENT_SPECS = {
  tgbt: { defaultRef: 'TGBT ACTIA', dimensions: '500x400x230mm', weightKg: 15 },
  mdea: { dimensions: '338*295*140mm', weightKg: 10 },
  transFo: { reference: 'TRANS_FO', label: 'TRANS FO', dimensions: '260x380x97mm', weightKg: 2.1 },
  boitierJonction: { marque: 'Aginode', dimensions: '427*380*127mm', dimensionsDisplay: '427 × 380 × 127 mm', weightKg: 0 },
  bcubeRadio: { defaultRef: 'RP6647 5G TDD' },
} as const;

export const DEFAULT_ORANGE_BAIES: BaieReference[] = [
  {
    id: 'orange_baie_radio_rb6120_outdoor',
    name: 'Baie radio RB6120 OUTDOOR',
    reference: 'RB6120 OUTDOOR',
    vendor: 'ERICSSON',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1540x700x700mm',
    height: 1540, width: 700, depth: 700, weight: 380,
    operator: 'orange'
  },
  {
    id: 'orange_baie_radio_rb6140',
    name: 'Baie radio RB6140',
    reference: 'RB6140',
    vendor: 'ERICSSON',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1650x650x700mm',
    height: 1650, width: 650, depth: 700, weight: 190,
    operator: 'orange'
  },
  {
    id: 'orange_baie_radio_rbs6330',
    name: 'Baie radio RBS6330',
    reference: 'RBS6330',
    vendor: 'ERICSSON',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '650x900x425mm',
    height: 650, width: 900, depth: 425, weight: 50,
    operator: 'orange'
  },
  {
    id: 'orange_baie_radio_rbs6201',
    name: 'Baie radio RBS 6201',
    reference: 'RBS 6201',
    vendor: 'ERICSSON',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1435x600x483mm',
    height: 1435, width: 600, depth: 483, weight: 70,
    operator: 'orange'
  },
  {
    id: 'orange_baie_radio_rbs6102',
    name: 'Baie radio RBS 6102',
    reference: 'RBS 6102',
    vendor: 'ERICSSON',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1450x1300x700mm',
    height: 1450, width: 1300, depth: 700, weight: 330,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_radio_trans',
    name: 'Baie TLTI FG2 RADIO /TRANS',
    reference: 'FG2 RADIO /TRANS',
    vendor: 'TLTI',
    category: 'radio_trans',
    category_label: 'Radio & Trans',
    dimensions: '1650x855x750mm',
    height: 1650, width: 855, depth: 750, weight: 93,
    operator: 'orange'
  },
  {
    id: 'orange_baie_energie_walkyrie_t3_18kw',
    name: 'Baie énergie Outdoor WALKYRIE T3 18kw',
    reference: 'WALKYRIE T3 18kw',
    vendor: 'WALKYRIE',
    category: 'energie',
    category_label: 'Énergie (-48V)',
    dimensions: '1550x700x770mm',
    height: 1550, width: 700, depth: 770, weight: 211,
    operator: 'orange'
  },
  {
    id: 'orange_baie_energie_t3_10_8kw',
    name: 'Baie énergie Outdoor T3 10.8kw',
    reference: 'T3 10.8kw',
    vendor: 'ELTEK',
    category: 'energie',
    category_label: 'Énergie (-48V)',
    dimensions: '1200x700x770mm',
    height: 1200, width: 700, depth: 770, weight: 150,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_tgbt_48v',
    name: 'Baie TLTI FG2 TGBT /48V',
    reference: 'FG2 TGBT /48V',
    vendor: 'TLTI',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1650x855x750mm',
    height: 1650, width: 855, depth: 750, weight: null,
    operator: 'orange'
  },
  {
    id: 'orange_baie_tlti_fg2_tgbt_trans',
    name: 'Baie TLTI FG2 TGBT /TRANS',
    reference: 'FG2 TGBT /TRANS',
    vendor: 'TLTI',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1650x855x750mm',
    height: 1650, width: 855, depth: 750, weight: 95,
    operator: 'orange'
  },
  {
    id: 'orange_baie_seifel',
    name: 'Baie SEIFEL',
    reference: 'SEIFEL',
    vendor: 'SEIFEL',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1485x885x540mm',
    height: 1485, width: 885, depth: 540, weight: 86,
    operator: 'orange'
  },
  {
    id: 'orange_coffret_outdoor_trans_tlti_2015',
    name: 'Coffret Outdoor Trans TLTI 2015',
    reference: 'Trans TLTI 2015',
    vendor: 'TLTI',
    category: 'energie',
    category_label: 'Énergie',
    dimensions: '1600x900x620mm',
    height: 1600, width: 900, depth: 620, weight: 65,
    operator: 'orange'
  }
];

