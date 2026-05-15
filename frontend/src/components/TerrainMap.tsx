// TerrainMap component with MapLibre GL

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TerrainMapProps } from '../utils/types';

export default function TerrainMap({ onMapClick, onMapLoad }: TerrainMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [clickIndicator, setClickIndicator] = useState<{ x: number; y: number } | null>(null);

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
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    // Add scale control
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      if (onMapLoad) {
        onMapLoad(map);
      }
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      onMapClick(lat, lng);
      
      // Show click indicator
      setClickIndicator({ x: e.point.x, y: e.point.y });
      
      // Remove indicator after animation
      setTimeout(() => {
        setClickIndicator(null);
      }, 2000);
    });

    return () => {
      map.remove();
    };
  }, [onMapClick, onMapLoad]);

  return (
    <div className="map-container relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {clickIndicator && (
        <div
          className="click-indicator absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000]"
          style={{
            left: `${clickIndicator.x}px`,
            top: `${clickIndicator.y}px`,
          }}
        >
          <div className="relative">
            <div className="absolute w-24 h-24 bg-rose-500/30 rounded-full animate-ping" />
            <div className="absolute w-20 h-20 bg-rose-500/50 rounded-full animate-pulse" />
            <div className="relative w-12 h-12 bg-rose-600 border-4 border-white rounded-full shadow-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
