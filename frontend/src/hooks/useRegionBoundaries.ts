// Custom hook for region boundaries

import { useState, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { RegionGeoJSON } from '../utils/types';

const API_BASE_URL = 'http://localhost:8000/api/geodata/regions';

interface UseRegionBoundariesReturn {
  regions: RegionGeoJSON | null;
  loading: boolean;
  error: string | null;
  fetchRegions: () => Promise<void>;
  addRegionsToMap: (map: maplibregl.Map, sourceId: string, layerId: string) => void;
  removeRegionsFromMap: (map: maplibregl.Map, layerId: string) => void;
}

export function useRegionBoundaries(): UseRegionBoundariesReturn {
  const [regions, setRegions] = useState<RegionGeoJSON | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const sourceIdRef = useRef<string>('');

  const fetchRegions = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/regions/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RegionGeoJSON = await response.json();
      setRegions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Fetch regions error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const addRegionsToMap = useCallback(
    (map: maplibregl.Map, sourceId: string, layerId: string): void => {
      if (!regions) return;

      sourceIdRef.current = sourceId;

      // Check if source already exists
      if (map.getSource(sourceId)) {
        // Remove existing source and add new one
        map.removeSource(sourceId);
      }
      
      map.addSource(sourceId, {
        type: 'geojson',
        data: regions,
      });

      // Add fill layer
      if (!map.getLayer(layerId)) {
        map.addLayer(
          {
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#667eea',
              'fill-opacity': 0.1,
            },
          },
          'waterway-label' // Add before water labels
        );

        // Add border layer
        map.addLayer(
          {
            id: `${layerId}-border`,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#667eea',
              'line-width': 2,
              'line-opacity': 0.5,
            },
          },
          'waterway-label'
        );
      }
    },
    [regions]
  );

  const removeRegionsFromMap = useCallback(
    (map: maplibregl.Map, layerId: string): void => {
      const sourceId = sourceIdRef.current;

      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getLayer(`${layerId}-border`)) {
        map.removeLayer(`${layerId}-border`);
      }
      if (sourceId && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    },
    []
  );

  return {
    regions,
    loading,
    error,
    fetchRegions,
    addRegionsToMap,
    removeRegionsFromMap,
  };
}
