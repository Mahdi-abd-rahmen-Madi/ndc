// TerrainMap component with MapLibre GL

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TerrainMapProps } from '../utils/types';
import { getCLCColor, getCLCDescription } from '../utils/clcColors';

function createGeoJSONCircle(center: [number, number], radiusInKm: number, points: number = 64) {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusInKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInKm / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]); // Close the polygon

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: {},
  };
}

function ensureMapLayers(map: maplibregl.Map) {
  // 1. CLC Polygons Source & Layers
  if (!map.getSource('clc-polygons')) {
    map.addSource('clc-polygons', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'clc-polygons-fill',
      type: 'fill',
      source: 'clc-polygons',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.45,
      },
      layout: {
        visibility: 'none',
      },
    });

    map.addLayer({
      id: 'clc-polygons-outline',
      type: 'line',
      source: 'clc-polygons',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': 0.8,
      },
      layout: {
        visibility: 'none',
      },
    });

    // Hover popup
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'clc-map-popup',
    });

    map.on('mousemove', 'clc-polygons-fill', (e) => {
      if (!e.features || e.features.length === 0) return;
      map.getCanvas().style.cursor = 'pointer';

      const coordinates = e.lngLat;
      const properties = e.features[0].properties;
      const code = properties.Code_18;
      const color = properties.color;
      const description = properties.description;

      popup
        .setLngLat(coordinates)
        .setHTML(`
          <div class="p-2 max-w-[240px] font-sans">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="w-3.5 h-3.5 rounded border border-gray-300 flex-shrink-0" style="background-color: ${color}"></span>
              <strong class="text-sm text-gray-800">CLC Code ${code}</strong>
            </div>
            <div class="text-xs text-gray-600 leading-normal">${description}</div>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseleave', 'clc-polygons-fill', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });
  }

  // 2. Search Radius Source & Layer
  if (!map.getSource('search-radius')) {
    map.addSource('search-radius', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'search-radius-line',
      type: 'line',
      source: 'search-radius',
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-dasharray': [3, 3],
        'line-opacity': 0.8,
      },
      layout: {
        visibility: 'none',
      },
    });
  }

  // 3. Coastline Buffer Source & Layer
  if (!map.getSource('france-coastline-buffer')) {
    map.addSource('france-coastline-buffer', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'france-coastline-buffer-fill',
      type: 'fill',
      source: 'france-coastline-buffer',
      paint: {
        'fill-color': '#06b6d4',
        'fill-opacity': 0.15,
      },
      layout: {
        visibility: 'visible',
      },
    });

    map.addLayer({
      id: 'france-coastline-buffer-line',
      type: 'line',
      source: 'france-coastline-buffer',
      paint: {
        'line-color': '#06b6d4',
        'line-width': 1,
        'line-opacity': 0.3,
        'line-dasharray': [2, 2],
      },
      layout: {
        visibility: 'visible',
      },
    });
  }

  // 4. Coastline Source & Layer
  if (!map.getSource('france-coastline')) {
    map.addSource('france-coastline', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'france-coastline-line',
      type: 'line',
      source: 'france-coastline',
      paint: {
        'line-color': '#06b6d4', // Cyan-500: beautiful bright coastal blue
        'line-width': 2.5,
        'line-opacity': 0.9,
      },
      layout: {
        visibility: 'visible',
      },
    });
  }

  // 5. Transition Zones Source & Layer
  if (!map.getSource('transition-zones')) {
    map.addSource('transition-zones', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'transition-zones-fill',
      type: 'fill',
      source: 'transition-zones',
      paint: {
        'fill-color': '#f97316', // Orange-500
        'fill-opacity': 0.35,
      },
      layout: {
        visibility: 'none',
      },
    });

    map.addLayer({
      id: 'transition-zones-outline',
      type: 'line',
      source: 'transition-zones',
      paint: {
        'line-color': '#ea580c', // Orange-600
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.9,
      },
      layout: {
        visibility: 'none',
      },
    });

    // Hover popup for transition zones
    const transitionPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'transition-map-popup',
    });

    map.on('mousemove', 'transition-zones-fill', (e) => {
      if (!e.features || e.features.length === 0) return;
      map.getCanvas().style.cursor = 'pointer';

      const coordinates = e.lngLat;
      transitionPopup
        .setLngLat(coordinates)
        .setHTML(`
          <div class="p-2.5 max-w-[240px] font-sans bg-white rounded shadow-md border-l-4 border-orange-500">
            <strong class="text-sm text-orange-600 block mb-1">Transition Zone (50m)</strong>
            <div class="text-xs text-gray-700 leading-normal">
              Terrain IV (dense urban fabric) downgraded to <strong>Terrain IIIa</strong> due to proximity to rural/agricultural zones.
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseleave', 'transition-zones-fill', () => {
      map.getCanvas().style.cursor = '';
      transitionPopup.remove();
    });
  }
}

function updateMapLayers(
  map: maplibregl.Map,
  coords: { latitude: number; longitude: number } | null,
  clcPolygons: any,
  transitionZones: any,
  viewportTransitionZones: any,
  analysisRadius: number
) {
  // Update CLC Polygons Source
  const clcSource = map.getSource('clc-polygons') as maplibregl.GeoJSONSource | undefined;
  if (clcSource) {
    if (clcPolygons && clcPolygons.features && clcPolygons.features.length > 0) {
      // Add colors and descriptions to features
      const coloredFeatures = clcPolygons.features.map((feature: any) => {
        const code = feature.properties?.Code_18;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            color: getCLCColor(String(code)),
            description: getCLCDescription(String(code)),
          }
        };
      });
      clcSource.setData({
        ...clcPolygons,
        features: coloredFeatures
      });
      map.setLayoutProperty('clc-polygons-fill', 'visibility', 'visible');
      map.setLayoutProperty('clc-polygons-outline', 'visibility', 'visible');
    } else {
      clcSource.setData({ type: 'FeatureCollection', features: [] });
      map.setLayoutProperty('clc-polygons-fill', 'visibility', 'none');
      map.setLayoutProperty('clc-polygons-outline', 'visibility', 'none');
    }
  }

  // Update Transition Zones Source
  const transitionSource = map.getSource('transition-zones') as maplibregl.GeoJSONSource | undefined;
  if (transitionSource) {
    const hasClickedZones = transitionZones && transitionZones.features && transitionZones.features.length > 0;
    const hasViewportZones = viewportTransitionZones && viewportTransitionZones.features && viewportTransitionZones.features.length > 0;
    
    if (hasClickedZones || hasViewportZones) {
      // Combine features and deduplicate by geometry string representation
      const seen = new Set<string>();
      const uniqueFeatures: any[] = [];
      const addFeature = (f: any) => {
        const key = JSON.stringify(f.geometry);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFeatures.push(f);
        }
      };
      
      if (hasClickedZones) transitionZones.features.forEach(addFeature);
      if (hasViewportZones) viewportTransitionZones.features.forEach(addFeature);

      transitionSource.setData({
        type: 'FeatureCollection',
        features: uniqueFeatures
      });
      map.setLayoutProperty('transition-zones-fill', 'visibility', 'visible');
      map.setLayoutProperty('transition-zones-outline', 'visibility', 'visible');
    } else {
      transitionSource.setData({ type: 'FeatureCollection', features: [] });
      map.setLayoutProperty('transition-zones-fill', 'visibility', 'none');
      map.setLayoutProperty('transition-zones-outline', 'visibility', 'none');
    }
  }

  // Update Search Radius Source
  const radiusSource = map.getSource('search-radius') as maplibregl.GeoJSONSource | undefined;
  if (radiusSource) {
    if (coords && analysisRadius) {
      const circleGeoJSON = createGeoJSONCircle(
        [coords.longitude, coords.latitude],
        analysisRadius
      );
      radiusSource.setData(circleGeoJSON as any);
      map.setLayoutProperty('search-radius-line', 'visibility', 'visible');
    } else {
      radiusSource.setData({ type: 'FeatureCollection', features: [] } as any);
      map.setLayoutProperty('search-radius-line', 'visibility', 'none');
    }
  }
}

export default function TerrainMap({
  onMapClick,
  onMapLoad,
  selectedCoordinates,
  clcPolygons,
  transitionZones,
  analysisRadius = 0.5
}: TerrainMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [coastlineGeoJSON, setCoastlineGeoJSON] = useState<any>(null);
  const [coastlineBufferGeoJSON, setCoastlineBufferGeoJSON] = useState<any>(null);
  const [viewportTransitionZones, setViewportTransitionZones] = useState<any>(null);

  const fetchViewportTransitionZones = useCallback(async (map: maplibregl.Map) => {
    const zoom = map.getZoom();
    if (zoom < 11) {
      setViewportTransitionZones(null);
      return;
    }

    const bounds = map.getBounds();
    const minLon = bounds.getWest();
    const minLat = bounds.getSouth();
    const maxLon = bounds.getEast();
    const maxLat = bounds.getNorth();
    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

    const baseUrl = import.meta.env.VITE_API_URL || '';
    try {
      const response = await fetch(`${baseUrl}/api/geodata/regions/transition_zones/?bbox=${bbox}`);
      if (response.ok) {
        const data = await response.json();
        setViewportTransitionZones(data);
      }
    } catch (err) {
      console.error('Failed to fetch viewport transition zones:', err);
    }
  }, []);

  useEffect(() => {
    const fetchCoastlineData = async () => {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      try {
        const response = await fetch(`${baseUrl}/api/geodata/regions/coastline/`);
        if (response.ok) {
          const data = await response.json();
          setCoastlineGeoJSON(data);
        }
      } catch (err) {
        console.error('Failed to fetch coastline:', err);
      }

      try {
        const response = await fetch(`${baseUrl}/api/geodata/regions/coastline_buffer/`);
        if (response.ok) {
          const data = await response.json();
          setCoastlineBufferGeoJSON(data);
        }
      } catch (err) {
        console.error('Failed to fetch coastline buffer:', err);
      }
    };
    fetchCoastlineData();
  }, []);

  // Listen to map moveend/load events to fetch transition zones
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMove = () => {
      fetchViewportTransitionZones(map);
    };

    map.on('moveend', handleMove);
    
    // Fetch immediately if already loaded
    if (map.isStyleLoaded()) {
      handleMove();
    } else {
      map.once('load', handleMove);
    }

    return () => {
      map.off('moveend', handleMove);
    };
  }, [fetchViewportTransitionZones]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize the map
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'google-satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'google-satellite',
            type: 'raster',
            source: 'google-satellite',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: [2.3522, 48.8566], // Paris, France
      zoom: 6,
    });

    mapRef.current = map;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');

    // Add scale control
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      ensureMapLayers(map);
      if (onMapLoad) {
        onMapLoad(map);
      }
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      onMapClick(lat, lng);
    });

    // Handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
    };
  }, [onMapClick, onMapLoad]);

  // Manage CLC polygons, radius circle, and coastline reactively
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyUpdates = () => {
      ensureMapLayers(map);
      updateMapLayers(map, selectedCoordinates, clcPolygons, transitionZones, viewportTransitionZones, analysisRadius);

      // Update coastline source with fetched data
      const coastlineSource = map.getSource('france-coastline') as maplibregl.GeoJSONSource | undefined;
      if (coastlineSource && coastlineGeoJSON) {
        coastlineSource.setData(coastlineGeoJSON);
      }

      // Update coastline buffer source with fetched data
      const bufferSource = map.getSource('france-coastline-buffer') as maplibregl.GeoJSONSource | undefined;
      if (bufferSource && coastlineBufferGeoJSON) {
        bufferSource.setData(coastlineBufferGeoJSON);
      }
    };

    if (map.isStyleLoaded()) {
      applyUpdates();
    } else {
      map.once('load', applyUpdates);
    }
  }, [selectedCoordinates, clcPolygons, transitionZones, viewportTransitionZones, analysisRadius, coastlineGeoJSON, coastlineBufferGeoJSON]);

  // Manage marker reactively based on selectedCoordinates prop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedCoordinates) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const { latitude, longitude } = selectedCoordinates;

    if (!markerRef.current) {
      // Create custom element
      const el = document.createElement('div');
      el.className = 'custom-map-marker flex items-center justify-center relative w-12 h-12';
      
      // Large outer ripple ping animation
      const pulse = document.createElement('div');
      pulse.className = 'absolute w-12 h-12 bg-rose-500/40 rounded-full animate-ping pointer-events-none';
      
      // Persistent glow ring
      const glow = document.createElement('div');
      glow.className = 'absolute w-8 h-8 bg-rose-500/20 rounded-full animate-pulse border border-rose-500/30 pointer-events-none';
      
      // Core dot
      const core = document.createElement('div');
      core.className = 'w-5 h-5 bg-gradient-to-tr from-rose-500 to-rose-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center z-10 pointer-events-none';
      
      const innerDot = document.createElement('div');
      innerDot.className = 'w-1.5 h-1.5 bg-white rounded-full';
      core.appendChild(innerDot);
      
      el.appendChild(pulse);
      el.appendChild(glow);
      el.appendChild(core);
      
      markerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([longitude, latitude])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([longitude, latitude]);
      
      // Restart the ping animation
      const el = markerRef.current.getElement();
      const pulse = el.querySelector('.animate-ping');
      if (pulse) {
        pulse.classList.remove('animate-ping');
        void (pulse as HTMLElement).offsetWidth; // trigger reflow
        pulse.classList.add('animate-ping');
      }
    }
  }, [selectedCoordinates]);

  return (
    <div className="map-container relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
