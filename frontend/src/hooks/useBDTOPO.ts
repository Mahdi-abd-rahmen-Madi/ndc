// Custom hook for BDTOPO building layer management

import { useState, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface BDTOPOConfig {
  opacity: number;
  showDensity: boolean;
  colorByHeight: boolean;
  analysisRadius: number;
}

interface UseBDTOPOReturn {
  visible: boolean;
  config: BDTOPOConfig;
  toggleVisibility: () => void;
  setOpacity: (opacity: number) => void;
  setShowDensity: (show: boolean) => void;
  setColorByHeight: (color: boolean) => void;
  setAnalysisRadius: (radius: number) => void;
  addBDTOPOLayer: (map: maplibregl.Map, sourceId: string, layerId: string) => void;
  removeBDTOPOLayer: (map: maplibregl.Map, layerId: string) => void;
  updateLayerStyle: (map: maplibregl.Map, layerId: string) => void;
}

export function useBDTOPO(): UseBDTOPOReturn {
  const [visible, setVisible] = useState<boolean>(false);
  const [config, setConfig] = useState<BDTOPOConfig>({
    opacity: 0.7,
    showDensity: false,
    colorByHeight: false,
    analysisRadius: 0.5,
  });
  const sourceIdRef = useRef<string>('');

  const toggleVisibility = useCallback((): void => {
    setVisible(prev => !prev);
  }, []);

  const setOpacity = useCallback((opacity: number): void => {
    setConfig(prev => ({ ...prev, opacity }));
  }, []);

  const setShowDensity = useCallback((show: boolean): void => {
    setConfig(prev => ({ ...prev, showDensity: show }));
  }, []);

  const setColorByHeight = useCallback((color: boolean): void => {
    setConfig(prev => ({ ...prev, colorByHeight: color }));
  }, []);

  const setAnalysisRadius = useCallback((radius: number): void => {
    setConfig(prev => ({ ...prev, analysisRadius: radius }));
  }, []);

  const addBDTOPOLayer = useCallback(
    (map: maplibregl.Map, sourceId: string, layerId: string): void => {
      sourceIdRef.current = sourceId;

      // Add BDTOPO vector tile source (using IGN TMS endpoint directly)
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'vector',
          tiles: [
            'https://data.geopf.fr/tms/1.0.0/BDTOPO/{z}/{x}/{y}.pbf',
          ],
          minzoom: 10,
          maxzoom: 20,
          attribution: '© IGN',
        });
      }

      // Define building layers from BDTOPO (French layer names)
      const buildingLayers = ['batiment', 'construction_surfacique', 'construction_lineaire'];

      // Add building layers
      buildingLayers.forEach((layerName) => {
        const buildingLayerId = `${layerId}-${layerName}`;
        if (!map.getLayer(buildingLayerId)) {
          map.addLayer(
            {
              id: buildingLayerId,
              type: 'fill',
              source: sourceId,
              'source-layer': layerName,
              paint: {
                'fill-color': config.colorByHeight
                  ? [
                      'interpolate',
                      ['linear'],
                      ['get', 'height'],
                      0,
                      '#667eea',
                      10,
                      '#764ba2',
                      20,
                      '#dc3545',
                    ]
                  : '#667eea',
                'fill-opacity': config.opacity,
                'fill-outline-color': '#CC5555',
              },
            },
            'waterway-label'
          );

          // Add outline layer
          map.addLayer(
            {
              id: `${buildingLayerId}-outline`,
              type: 'line',
              source: sourceId,
              'source-layer': layerName,
              paint: {
                'line-color': '#333',
                'line-width': 0.5,
                'line-opacity': config.opacity * 0.5,
              },
            },
            'waterway-label'
          );
        }
      });
    },
    [config.colorByHeight, config.opacity]
  );

  const removeBDTOPOLayer = useCallback(
    (map: maplibregl.Map, layerId: string): void => {
      const sourceId = sourceIdRef.current;
      const buildingLayers = ['batiment', 'construction_surfacique', 'construction_lineaire'];

      // Remove all building layers
      buildingLayers.forEach((layerName) => {
        const buildingLayerId = `${layerId}-${layerName}`;
        if (map.getLayer(buildingLayerId)) {
          map.removeLayer(buildingLayerId);
        }
        if (map.getLayer(`${buildingLayerId}-outline`)) {
          map.removeLayer(`${buildingLayerId}-outline`);
        }
      });

      // Remove source
      if (sourceId && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    },
    []
  );

  const updateLayerStyle = useCallback(
    (map: maplibregl.Map, layerId: string): void => {
      const buildingLayers = ['batiment', 'construction_surfacique', 'construction_lineaire'];

      buildingLayers.forEach((layerName) => {
        const buildingLayerId = `${layerId}-${layerName}`;
        if (!map.getLayer(buildingLayerId)) return;

        map.setPaintProperty(
          buildingLayerId,
          'fill-color',
          config.colorByHeight
            ? [
                'interpolate',
                ['linear'],
                ['get', 'height'],
                0,
                '#667eea',
                10,
                '#764ba2',
                20,
                '#dc3545',
              ]
            : '#667eea'
        );

        map.setPaintProperty(buildingLayerId, 'fill-opacity', config.opacity);
        map.setPaintProperty(`${buildingLayerId}-outline`, 'line-opacity', config.opacity * 0.5);
      });
    },
    [config.colorByHeight, config.opacity]
  );

  return {
    visible,
    config,
    toggleVisibility,
    setOpacity,
    setShowDensity,
    setColorByHeight,
    setAnalysisRadius,
    addBDTOPOLayer,
    removeBDTOPOLayer,
    updateLayerStyle,
  };
}
