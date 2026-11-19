// Custom hook for region boundaries

import { useState, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { apiClient } from '../services/apiClient';
import type { RegionGeoJSON } from '../utils/types';

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
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const handlersRef = useRef<{
    layerId: string;
    onMove: (e: any) => void;
    onLeave: () => void;
  } | null>(null);

  const fetchRegions = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<RegionGeoJSON>('/api/geodata/regions/regions/');
      setRegions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Fetch regions error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeRegionsFromMap = useCallback(
    (map: maplibregl.Map, layerId: string): void => {
      const sourceId = sourceIdRef.current;

      if (handlersRef.current && handlersRef.current.layerId === layerId) {
        map.off('mousemove', layerId, handlersRef.current.onMove);
        map.off('mouseleave', layerId, handlersRef.current.onLeave);
        handlersRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
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

  const addRegionsToMap = useCallback(
    (map: maplibregl.Map, sourceId: string, layerId: string): void => {
      if (!regions) return;

      sourceIdRef.current = sourceId;

      // Cleanly remove any previous layers, listeners, popup, and source
      removeRegionsFromMap(map, layerId);
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      
      // Ensure features have integer IDs for maplibre feature state
      const regionsWithIds = {
        ...regions,
        features: regions.features.map(f => ({
          ...f,
          id: f.properties.region_id
        }))
      };

      map.addSource(sourceId, {
        type: 'geojson',
        data: regionsWithIds as any,
      });

      const beforeId = map.getLayer('waterway-label') ? 'waterway-label' : undefined;

      // Add fill layer
      if (!map.getLayer(layerId)) {
        map.addLayer(
          {
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              // Color code the 4 wind regions beautifully
              'fill-color': [
                'match',
                ['get', 'region_id'],
                1, '#3b82f6', // Region 1: Beautiful Blue
                2, '#6366f1', // Region 2: Premium Indigo
                3, '#f59e0b', // Region 3: Vibrant Amber
                4, '#ec4899', // Region 4: Rose Pink
                '#667eea'     // Default: Slate Blue
              ],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.3,  // Opacity when hovered
                0.1   // Default opacity
              ]
            },
          },
          beforeId
        );

        // Add border layer
        map.addLayer(
          {
            id: `${layerId}-border`,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': [
                'match',
                ['get', 'region_id'],
                1, '#1d4ed8',
                2, '#4338ca',
                3, '#b45309',
                4, '#be185d',
                '#4f46e5'
              ],
              'line-width': 2,
              'line-opacity': 0.6,
            },
          },
          beforeId
        );

        // Create interactive hover popup for the regions
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'region-map-popup',
        });
        popupRef.current = popup;

        let hoveredFeatureId: number | undefined = undefined;

        const onMove = (e: any) => {
          if (!e.features || e.features.length === 0) return;
          map.getCanvas().style.cursor = 'pointer';

          const coordinates = e.lngLat;
          const properties = e.features[0].properties;
          const regionId = properties.region_id;
          const name = properties.name;
          const description = properties.description;
          const v_b0 = properties.v_b0_value;

          // Update hover state
          if (hoveredFeatureId !== undefined) {
            map.setFeatureState(
              { source: sourceId, id: hoveredFeatureId },
              { hover: false }
            );
          }
          hoveredFeatureId = regionId;
          map.setFeatureState(
            { source: sourceId, id: hoveredFeatureId },
            { hover: true }
          );

          popup
            .setLngLat(coordinates)
            .setHTML(`
              <div class="p-2.5 max-w-[240px] font-sans bg-white rounded shadow-md border-l-4 border-indigo-500">
                <strong class="text-sm text-indigo-600 block mb-1">${name}</strong>
                <div class="text-xs text-gray-700 leading-normal mb-1.5">${description}</div>
                <div class="text-xs font-semibold text-gray-600">Wind Speed (V_b0): <span class="text-indigo-600 font-bold">${v_b0} m/s</span></div>
              </div>
            `)
            .addTo(map);
        };

        const onLeave = () => {
          map.getCanvas().style.cursor = '';
          popup.remove();

          if (hoveredFeatureId !== undefined) {
            map.setFeatureState(
              { source: sourceId, id: hoveredFeatureId },
              { hover: false }
            );
            hoveredFeatureId = undefined;
          }
        };

        map.on('mousemove', layerId, onMove);
        map.on('mouseleave', layerId, onLeave);
        handlersRef.current = { layerId, onMove, onLeave };
      }
    },
    [regions, removeRegionsFromMap]
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

