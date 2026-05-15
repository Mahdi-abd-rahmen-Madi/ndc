// CLC Code Color Mapping based on clc_legend_qgis.txt

export interface CLCColor {
  code: string;
  description: string;
  color: string;
  rgb: { r: number; g: number; b: number };
}

// Parse the CLC legend data
const CLC_LEGEND_DATA: CLCColor[] = [
  { code: '111', description: 'Continuous urban fabric', color: '#E6004D', rgb: { r: 230, g: 0, b: 77 } },
  { code: '112', description: 'Discontinuous urban fabric', color: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
  { code: '121', description: 'Industrial or commercial units', color: '#CC4DF2', rgb: { r: 204, g: 77, b: 242 } },
  { code: '122', description: 'Road and rail networks and associated land', color: '#CC0000', rgb: { r: 204, g: 0, b: 0 } },
  { code: '123', description: 'Port areas', color: '#E6CCCC', rgb: { r: 230, g: 204, b: 204 } },
  { code: '124', description: 'Airports', color: '#E6E6CC', rgb: { r: 230, g: 230, b: 204 } },
  { code: '131', description: 'Mineral extraction sites', color: '#A600CC', rgb: { r: 166, g: 0, b: 204 } },
  { code: '132', description: 'Dump sites', color: '#A64D00', rgb: { r: 166, g: 77, b: 0 } },
  { code: '133', description: 'Construction sites', color: '#FF4DFF', rgb: { r: 255, g: 77, b: 255 } },
  { code: '141', description: 'Green urban areas', color: '#FFA6FF', rgb: { r: 255, g: 166, b: 255 } },
  { code: '142', description: 'Sport and leisure facilities', color: '#FFE6FF', rgb: { r: 255, g: 230, b: 255 } },
  { code: '211', description: 'Non-irrigated arable land', color: '#FFFFA8', rgb: { r: 255, g: 255, b: 168 } },
  { code: '212', description: 'Permanently irrigated land', color: '#FFFF00', rgb: { r: 255, g: 255, b: 0 } },
  { code: '213', description: 'Rice fields', color: '#E6E600', rgb: { r: 230, g: 230, b: 0 } },
  { code: '221', description: 'Vineyards', color: '#E68000', rgb: { r: 230, g: 128, b: 0 } },
  { code: '222', description: 'Fruit trees and berry plantations', color: '#F2A64D', rgb: { r: 242, g: 166, b: 77 } },
  { code: '223', description: 'Olive groves', color: '#E6A600', rgb: { r: 230, g: 166, b: 0 } },
  { code: '231', description: 'Pastures', color: '#E6E64D', rgb: { r: 230, g: 230, b: 77 } },
  { code: '241', description: 'Annual crops associated with permanent crops', color: '#FFE6A6', rgb: { r: 255, g: 230, b: 166 } },
  { code: '242', description: 'Complex cultivation patterns', color: '#FFE64D', rgb: { r: 255, g: 230, b: 77 } },
  { code: '243', description: 'Land principally occupied by agriculture with significant areas of natural vegetation', color: '#E6CC4D', rgb: { r: 230, g: 204, b: 77 } },
  { code: '244', description: 'Agro-forestry areas', color: '#F2CCA6', rgb: { r: 242, g: 204, b: 166 } },
  { code: '311', description: 'Broad-leaved forest', color: '#80FF00', rgb: { r: 128, g: 255, b: 0 } },
  { code: '312', description: 'Coniferous forest', color: '#00A600', rgb: { r: 0, g: 166, b: 0 } },
  { code: '313', description: 'Mixed forest', color: '#4DFF00', rgb: { r: 77, g: 255, b: 0 } },
  { code: '321', description: 'Natural grasslands', color: '#CCF24D', rgb: { r: 204, g: 242, b: 77 } },
  { code: '322', description: 'Moors and heathland', color: '#A6FF80', rgb: { r: 166, g: 255, b: 128 } },
  { code: '323', description: 'Sclerophyllous vegetation', color: '#A6E64D', rgb: { r: 166, g: 230, b: 77 } },
  { code: '324', description: 'Transitional woodland-shrub', color: '#A6F200', rgb: { r: 166, g: 242, b: 0 } },
  { code: '331', description: 'Beaches - dunes - sands', color: '#E6E6E6', rgb: { r: 230, g: 230, b: 230 } },
  { code: '332', description: 'Bare rocks', color: '#CCCCCC', rgb: { r: 204, g: 204, b: 204 } },
  { code: '333', description: 'Sparsely vegetated areas', color: '#CCFFCC', rgb: { r: 204, g: 255, b: 204 } },
  { code: '334', description: 'Burnt areas', color: '#000000', rgb: { r: 0, g: 0, b: 0 } },
  { code: '335', description: 'Glaciers and perpetual snow', color: '#A6E6CC', rgb: { r: 166, g: 230, b: 204 } },
  { code: '411', description: 'Inland marshes', color: '#A6A6FF', rgb: { r: 166, g: 166, b: 255 } },
  { code: '412', description: 'Peat bogs', color: '#4D4DFF', rgb: { r: 77, g: 77, b: 255 } },
  { code: '421', description: 'Salt marshes', color: '#CCCCFF', rgb: { r: 204, g: 204, b: 255 } },
  { code: '422', description: 'Salines', color: '#E6E6FF', rgb: { r: 230, g: 230, b: 255 } },
  { code: '423', description: 'Intertidal flats', color: '#A6A6E6', rgb: { r: 166, g: 166, b: 230 } },
  { code: '511', description: 'Water courses', color: '#00CCF2', rgb: { r: 0, g: 204, b: 242 } },
  { code: '512', description: 'Water bodies', color: '#80F2E6', rgb: { r: 128, g: 242, b: 230 } },
  { code: '521', description: 'Coastal lagoons', color: '#00FFA6', rgb: { r: 0, g: 255, b: 166 } },
  { code: '522', description: 'Estuaries', color: '#A6FFE6', rgb: { r: 166, g: 255, b: 230 } },
  { code: '523', description: 'Sea and ocean', color: '#E6F2FF', rgb: { r: 230, g: 242, b: 255 } },
  { code: '999', description: 'NODATA', color: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
  { code: '990', description: 'UNCLASSIFIED LAND SURFACE', color: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
  { code: '995', description: 'UNCLASSIFIED WATER BODIES', color: '#E6F2FF', rgb: { r: 230, g: 242, b: 255 } },
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
  return clcColor ? clcColor.description : 'Unknown';
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
