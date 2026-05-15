// Terrain Type Descriptions and Icons

import type { TerrainType } from './types';

export interface TerrainTypeInfo {
  type: TerrainType;
  name: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
}

export const TERRAIN_TYPES: Record<TerrainType, TerrainTypeInfo> = {
  '0': {
    type: '0',
    name: 'Terrain 0',
    description: 'Open countryside with minimal urban development, suitable for standard wind turbine installations',
    icon: '🌾',
    color: '#0077be',
    gradient: 'linear-gradient(135deg, #0077be, #005a8b)',
  },
  'II': {
    type: 'II',
    name: 'Terrain II',
    description: 'Rural areas with some development, moderate wind conditions',
    icon: '🏞️',
    color: '#28a745',
    gradient: 'linear-gradient(135deg, #28a745, #1e7e34)',
  },
  'IIIa': {
    type: 'IIIa',
    name: 'Terrain IIIa',
    description: 'Transitional zones with mixed urban and rural characteristics',
    icon: '🏘️',
    color: '#ffc107',
    gradient: 'linear-gradient(135deg, #ffc107, #d39e00)',
  },
  'IIIb': {
    type: 'IIIb',
    name: 'Terrain IIIb',
    description: 'Areas with significant urban influence, complex terrain',
    icon: '🏙️',
    color: '#fd7e14',
    gradient: 'linear-gradient(135deg, #fd7e14, #dc6502)',
  },
  'IV': {
    type: 'IV',
    name: 'Terrain IV',
    description: 'Dense urban environments with complex wind patterns, requires special consideration',
    icon: '🌆',
    color: '#dc3545',
    gradient: 'linear-gradient(135deg, #dc3545, #a71d2a)',
  },
};

// Get terrain type info
export function getTerrainTypeInfo(type: TerrainType): TerrainTypeInfo {
  return TERRAIN_TYPES[type];
}

// Get terrain type name
export function getTerrainTypeName(type: TerrainType): string {
  return TERRAIN_TYPES[type].name;
}

// Get terrain type description
export function getTerrainTypeDescription(type: TerrainType): string {
  return TERRAIN_TYPES[type].description;
}

// Get terrain type icon
export function getTerrainTypeIcon(type: TerrainType): string {
  return TERRAIN_TYPES[type].icon;
}

// Get terrain type color
export function getTerrainTypeColor(type: TerrainType): string {
  return TERRAIN_TYPES[type].color;
}

// Get terrain type gradient
export function getTerrainTypeGradient(type: TerrainType): string {
  return TERRAIN_TYPES[type].gradient;
}

// Get all terrain types
export function getAllTerrainTypes(): TerrainTypeInfo[] {
  return Object.values(TERRAIN_TYPES);
}
