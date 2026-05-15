// Coordinate and Parameter Formatting Functions

import type { Coordinates, SpatialExtent } from './types';

// Format coordinates to decimal degrees
export function formatCoordinates(coords: Coordinates): string {
  return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
}

// Format coordinates to DMS (Degrees, Minutes, Seconds)
export function formatCoordinatesDMS(coords: Coordinates): string {
  const lat = coords.latitude;
  const lng = coords.longitude;
  
  const latD = Math.floor(Math.abs(lat));
  const latM = Math.floor((Math.abs(lat) - latD) * 60);
  const latS = ((Math.abs(lat) - latD) - latM / 60) * 3600;
  const latDir = lat >= 0 ? 'N' : 'S';
  
  const lngD = Math.floor(Math.abs(lng));
  const lngM = Math.floor((Math.abs(lng) - lngD) * 60);
  const lngS = ((Math.abs(lng) - lngD) - lngM / 60) * 3600;
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  return `${latD}°${latM}'${latS.toFixed(2)}"${latDir} ${lngD}°${lngM}'${lngS.toFixed(2)}"${lngDir}`;
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format distance in kilometers
export function formatDistanceKm(value: number): string {
  if (value < 1) {
    return `${(value * 1000).toFixed(0)} m`;
  }
  return `${value.toFixed(2)} km`;
}

// Format area in square kilometers
export function formatAreaSqKm(value: number): string {
  if (value < 1) {
    return `${(value * 1000000).toFixed(0)} m²`;
  }
  return `${value.toFixed(3)} km²`;
}

// Format spatial extent for display
export function formatSpatialExtent(extent: SpatialExtent): Record<string, string> {
  return {
    agriculture: formatPercentage(extent.agriculture),
    complex_agriculture: formatPercentage(extent.complex_agriculture),
    forest: formatPercentage(extent.forest),
    urban: formatPercentage(extent.urban),
    coastal: formatPercentage(extent.coastal),
  };
}

// Format building metrics
export function formatBuildingMetrics(metrics: {
  building_count: number;
  building_coverage_pct: number;
  average_height: number;
}): Record<string, string> {
  return {
    building_count: metrics.building_count.toString(),
    building_coverage_pct: formatPercentage(metrics.building_coverage_pct / 100),
    average_height: `${metrics.average_height.toFixed(1)} m`,
  };
}

// Format parameter value based on type
export function formatParameterValue(value: number, unit: string = ''): string {
  if (unit === 'km') {
    return formatDistanceKm(value);
  } else if (unit === '%') {
    return formatPercentage(value);
  } else if (unit === 'm') {
    return `${value.toFixed(1)} m`;
  }
  return value.toFixed(2);
}

// Parse coordinate string to Coordinates object
export function parseCoordinateString(coordStr: string): Coordinates | null {
  const parts = coordStr.split(',').map(s => s.trim());
  if (parts.length !== 2) return null;
  
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  
  return { latitude: lat, longitude: lng };
}

// Format rule priority
export function formatRulePriority(priority: number): string {
  return `P${priority}`;
}

// Format rule explanation
export function formatRuleExplanation(explanation: string | Record<string, any>): string {
  if (typeof explanation === 'string') {
    return explanation;
  }
  
  if (explanation && typeof explanation === 'object') {
    if ('explanation' in explanation) {
      return explanation.explanation as string;
    }
    return JSON.stringify(explanation, null, 2);
  }
  
  return '';
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Format number with thousands separator
export function formatNumber(num: number): string {
  return num.toLocaleString();
}
