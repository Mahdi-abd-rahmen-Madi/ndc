// CLC Code Color Mapping based on clc_legend_qgis.txt

export interface CLCColor {
  code: string;
  description: string;
  color: string;
  rgb: { r: number; g: number; b: number };
}

// Parse the CLC legend data
const CLC_LEGEND_DATA: CLCColor[] = [
  { code: '111', description: 'Tissu urbain continu', color: '#E6004D', rgb: { r: 230, g: 0, b: 77 } },
  { code: '112', description: 'Tissu urbain discontinu', color: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
  { code: '121', description: 'Zones industrielles ou commerciales', color: '#CC4DF2', rgb: { r: 204, g: 77, b: 242 } },
  { code: '122', description: 'Réseaux routiers et ferroviaires et espaces associés', color: '#CC0000', rgb: { r: 204, g: 0, b: 0 } },
  { code: '123', description: 'Zones portuaires', color: '#E6CCCC', rgb: { r: 230, g: 204, b: 204 } },
  { code: '124', description: 'Aéroports', color: '#E6E6CC', rgb: { r: 230, g: 230, b: 204 } },
  { code: '131', description: 'Sites d\'extraction de minéraux', color: '#A600CC', rgb: { r: 166, g: 0, b: 204 } },
  { code: '132', description: 'Décharges', color: '#A64D00', rgb: { r: 166, g: 77, b: 0 } },
  { code: '133', description: 'Chantiers de construction', color: '#FF4DFF', rgb: { r: 255, g: 77, b: 255 } },
  { code: '141', description: 'Espaces verts urbains', color: '#FFA6FF', rgb: { r: 255, g: 166, b: 255 } },
  { code: '142', description: 'Équipements sportifs et de loisirs', color: '#FFE6FF', rgb: { r: 255, g: 230, b: 255 } },
  { code: '211', description: 'Terres arables non irriguées', color: '#FFFFA8', rgb: { r: 255, g: 255, b: 168 } },
  { code: '212', description: 'Terres irriguées en permanence', color: '#FFFF00', rgb: { r: 255, g: 255, b: 0 } },
  { code: '213', description: 'Rizières', color: '#E6E600', rgb: { r: 230, g: 230, b: 0 } },
  { code: '221', description: 'Vignobles', color: '#E68000', rgb: { r: 230, g: 128, b: 0 } },
  { code: '222', description: 'Vergers et petits fruits', color: '#F2A64D', rgb: { r: 242, g: 166, b: 77 } },
  { code: '223', description: 'Oliveraies', color: '#E6A600', rgb: { r: 230, g: 166, b: 0 } },
  { code: '231', description: 'Prairies', color: '#E6E64D', rgb: { r: 230, g: 230, b: 77 } },
  { code: '241', description: 'Cultures annuelles associées à des cultures permanentes', color: '#FFE6A6', rgb: { r: 255, g: 230, b: 166 } },
  { code: '242', description: 'Systèmes culturaux et parcellaires complexes', color: '#FFE64D', rgb: { r: 255, g: 230, b: 77 } },
  { code: '243', description: 'Surfaces principalement agricoles, interrompues par des espaces naturels importants', color: '#E6CC4D', rgb: { r: 230, g: 204, b: 77 } },
  { code: '244', description: 'Territoires agro-forestiers', color: '#F2CCA6', rgb: { r: 242, g: 204, b: 166 } },
  { code: '311', description: 'Forêts de feuillus', color: '#80FF00', rgb: { r: 128, g: 255, b: 0 } },
  { code: '312', description: 'Forêts de conifères', color: '#00A600', rgb: { r: 0, g: 166, b: 0 } },
  { code: '313', description: 'Forêts mélangées', color: '#4DFF00', rgb: { r: 77, g: 255, b: 0 } },
  { code: '321', description: 'Pelouses et pâturages naturels', color: '#CCF24D', rgb: { r: 204, g: 242, b: 77 } },
  { code: '322', description: 'Landes et broussailles', color: '#A6FF80', rgb: { r: 166, g: 255, b: 128 } },
  { code: '323', description: 'Végétation sclérophylle', color: '#A6E64D', rgb: { r: 166, g: 230, b: 77 } },
  { code: '324', description: 'Forêt et végétation arbustive en mutation', color: '#A6F200', rgb: { r: 166, g: 242, b: 0 } },
  { code: '331', description: 'Plages, dunes et sable', color: '#E6E6E6', rgb: { r: 230, g: 230, b: 230 } },
  { code: '332', description: 'Roches nues', color: '#CCCCCC', rgb: { r: 204, g: 204, b: 204 } },
  { code: '333', description: 'Végétation clairsemée', color: '#CCFFCC', rgb: { r: 204, g: 255, b: 204 } },
  { code: '334', description: 'Zones brûlées', color: '#000000', rgb: { r: 0, g: 0, b: 0 } },
  { code: '335', description: 'Glaciers et neiges éternelles', color: '#A6E6CC', rgb: { r: 166, g: 230, b: 204 } },
  { code: '411', description: 'Marais intérieurs', color: '#A6A6FF', rgb: { r: 166, g: 166, b: 255 } },
  { code: '412', description: 'Tourbières', color: '#4D4DFF', rgb: { r: 77, g: 77, b: 255 } },
  { code: '421', description: 'Marais maritimes', color: '#CCCCFF', rgb: { r: 204, g: 204, b: 255 } },
  { code: '422', description: 'Marais salants', color: '#E6E6FF', rgb: { r: 230, g: 230, b: 255 } },
  { code: '423', description: 'Zones intertidales', color: '#A6A6E6', rgb: { r: 166, g: 166, b: 230 } },
  { code: '511', description: 'Cours d\'eau', color: '#00CCF2', rgb: { r: 0, g: 204, b: 242 } },
  { code: '512', description: 'Plans d\'eau', color: '#80F2E6', rgb: { r: 128, g: 242, b: 230 } },
  { code: '521', description: 'Lagunes littorales', color: '#00FFA6', rgb: { r: 0, g: 255, b: 166 } },
  { code: '522', description: 'Estuaires', color: '#A6FFE6', rgb: { r: 166, g: 255, b: 230 } },
  { code: '523', description: 'Mers et océans', color: '#E6F2FF', rgb: { r: 230, g: 242, b: 255 } },
  { code: '999', description: 'PAS DE DONNÉES', color: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
  { code: '990', description: 'SURFACE TERRESTRE NON CLASSIFIÉE', color: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
  { code: '995', description: 'PLANS D\'EAU NON CLASSIFIÉS', color: '#E6F2FF', rgb: { r: 230, g: 242, b: 255 } },
];

// Get color by CLC code
export function getCLCColor(code: string): string {
  const clcColor = CLC_LEGEND_DATA.find(c => c.code === code);
  return clcColor ? clcColor.color : '#CCCCCC';
}

// Get CLC color object by code
export function getCLCColorObject(code: string): CLCColor | undefined {
  return CLC_LEGEND_DATA.find(c => c.code === code);
}

// Get description by CLC code
export function getCLCDescription(code: string): string {
  const clcColor = CLC_LEGEND_DATA.find(c => c.code === code);
  return clcColor ? clcColor.description : 'Inconnu';
}

// Get all CLC colors
export function getAllCLCColors(): CLCColor[] {
  return CLC_LEGEND_DATA;
}

// Search CLC colors by description
export function searchCLCColors(query: string): CLCColor[] {
  const lowerQuery = query.toLowerCase();
  return CLC_LEGEND_DATA.filter(c =>
    c.description.toLowerCase().includes(lowerQuery) ||
    c.code.includes(lowerQuery)
  );
}
