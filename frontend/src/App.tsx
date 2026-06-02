// App.tsx - Main application component

import { useState, useEffect, useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import TerrainMap from './components/TerrainMap';
import CLCLegend from './components/CLCLegend';
import InfoPanel from './components/InfoPanel';
import ConfigTabs from './components/ConfigTabs';
import BDTOPOControls from './components/BDTOPOControls';
import RegionControl from './components/RegionControl';
import AddressSearch from './components/AddressSearch';
import { useTerrainClassification } from './hooks/useTerrainClassification';
import { useTerrainConfig } from './hooks/useTerrainConfig';
import { useRegionBoundaries } from './hooks/useRegionBoundaries';
import { useBDTOPO } from './hooks/useBDTOPO';
import { useGeocoding } from './hooks/useGeocoding';
import type { GeocodingAddress } from './utils/types';

export default function App() {
  const [activeTab, setActiveTab] = useState('details');
  const [currentAnalysisRadius, setCurrentAnalysisRadius] = useState(0.5);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  const [regionsVisible, setRegionsVisible] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);

  const {
    classify,
    reset: resetClassification,
    loading: classificationLoading,
    error: classificationError,
    result: classificationResult,
  } = useTerrainClassification();

  const {
    config,
    fetchConfig,
  } = useTerrainConfig();

  const {
    fetchRegions,
    addRegionsToMap,
    removeRegionsFromMap,
  } = useRegionBoundaries();

  const {
    visible: bdtopoVisible,
    config: bdtopoConfig,
    toggleVisibility: toggleBDTOPO,
    setOpacity,
    setShowDensity,
    setColorByHeight,
    setAnalysisRadius,
    addBDTOPOLayer,
    removeBDTOPOLayer,
    updateLayerStyle,
  } = useBDTOPO();

  const { reverseGeocode } = useGeocoding();

  // Fetch initial data
  useEffect(() => {
    fetchConfig();
    fetchRegions();
  }, [fetchConfig, fetchRegions]);

  // Debounced classification
  const classificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      // Instantly place/update the marker on map click
      setSelectedCoords({ latitude: lat, longitude: lng });

      if (classificationTimeoutRef.current) {
        clearTimeout(classificationTimeoutRef.current);
      }

      classificationTimeoutRef.current = setTimeout(async () => {
        classify(lat, lng, config || undefined, currentAnalysisRadius);
        
        try {
          const address = await reverseGeocode(lat, lng);
          setSelectedAddress(address);
        } catch (e) {
          console.error('Failed to reverse geocode clicked point:', e);
        }
      }, 300);
    },
    [classify, config, currentAnalysisRadius, reverseGeocode]
  );

  const handleAddressSelect = useCallback(
    async (address: GeocodingAddress) => {
      setSelectedAddress(address);
      setSelectedCoords({ latitude: address.latitude, longitude: address.longitude });

      if (mapInstance) {
        mapInstance.flyTo({
          center: [address.longitude, address.latitude],
          zoom: 14,
          essential: true,
        });
      }

      if (classificationTimeoutRef.current) {
        clearTimeout(classificationTimeoutRef.current);
      }

      classificationTimeoutRef.current = setTimeout(async () => {
        classify(address.latitude, address.longitude, config || undefined, currentAnalysisRadius);
      }, 300);
    },
    [classify, config, currentAnalysisRadius, mapInstance]
  );

  const handleClearAddress = useCallback(() => {
    setSelectedAddress(null);
    setSelectedCoords(null);
    resetClassification();
  }, [resetClassification]);

  const handleMapLoad = useCallback((map: maplibregl.Map) => {
    setMapInstance(map);
  }, []);

  const handleRadiusChange = useCallback((radius: number) => {
    setCurrentAnalysisRadius(radius);
    setAnalysisRadius(radius);
  }, [setAnalysisRadius]);

  const handleBDTOPOStyleChange = useCallback(() => {
    if (mapInstance) {
      updateLayerStyle(mapInstance, 'bdtopo-buildings');
    }
  }, [mapInstance, updateLayerStyle]);

  const handleToggleRegions = useCallback(() => {
    if (!mapInstance) return;

    setRegionsVisible(prev => {
      const newState = !prev;
      if (newState) {
        addRegionsToMap(mapInstance, 'regions-source', 'regions-layer');
      } else {
        removeRegionsFromMap(mapInstance, 'regions-layer');
      }
      return newState;
    });
  }, [mapInstance, addRegionsToMap, removeRegionsFromMap]);

  const handleToggleBDTOPO = useCallback(() => {
    if (!mapInstance) return;

    toggleBDTOPO();
    if (!bdtopoVisible) {
      addBDTOPOLayer(mapInstance, 'bdtopo-source', 'bdtopo-buildings');
    } else {
      removeBDTOPOLayer(mapInstance, 'bdtopo-buildings');
    }
  }, [mapInstance, bdtopoVisible, toggleBDTOPO, addBDTOPOLayer, removeBDTOPOLayer]);

  // Update BDTOPO layer style when config changes
  useEffect(() => {
    if (bdtopoVisible && mapInstance) {
      handleBDTOPOStyleChange();
    }
  }, [bdtopoConfig, bdtopoVisible, mapInstance, handleBDTOPOStyleChange]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Header */}
      <header className="header bg-gradient-to-r from-primary to-secondary text-white p-4 px-8 shadow-lg flex-shrink-0">
        <h1 className="text-2xl font-semibold">Terrain Classification Map - France</h1>
        <p className="mt-1 opacity-90 text-sm">Click on the map to analyze terrain classification</p>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden w-full max-w-none">
        {/* CLC Legend Panel */}
        <CLCLegend
          detectedCodes={classificationResult?.detected_clc_codes || []}
          config={config}
        />

        {/* Map Container */}
        <div className="map-container flex-1 relative">
          <TerrainMap
            onMapClick={handleMapClick}
            onMapLoad={handleMapLoad}
            selectedCoordinates={selectedCoords}
            clcPolygons={classificationResult?.clc_polygons}
            transitionZones={classificationResult?.transition_zones}
            analysisRadius={currentAnalysisRadius}
          />
          
          {/* Address Search */}
          <AddressSearch
            onAddressSelect={handleAddressSelect}
            selectedAddress={selectedAddress}
            onClearAddress={handleClearAddress}
          />
          
          {/* BDTOPO Controls */}
          <BDTOPOControls
            visible={bdtopoVisible}
            onToggle={handleToggleBDTOPO}
            opacity={bdtopoConfig.opacity}
            onOpacityChange={setOpacity}
            showDensity={bdtopoConfig.showDensity}
            onDensityToggle={setShowDensity}
            colorByHeight={bdtopoConfig.colorByHeight}
            onHeightColoringToggle={setColorByHeight}
          />

          {/* Region Control */}
          <RegionControl visible={regionsVisible} onToggle={handleToggleRegions} />
        </div>

        {/* Info Panel */}
        <InfoPanel
          classificationResult={classificationResult}
          loading={classificationLoading}
          error={classificationError}
          currentAnalysisRadius={currentAnalysisRadius}
        />

        {/* Config Panel (when shown) */}
        {showConfigPanel && (
          <div className="fixed top-0 right-0 w-[500px] h-full bg-white shadow-2xl z-[1003] overflow-y-auto">
            <div className="p-4 bg-gradient-to-r from-primary to-secondary text-white flex justify-between items-center">
              <h2 className="text-xl font-semibold">Configuration</h2>
              <button
                onClick={() => setShowConfigPanel(false)}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <ConfigTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              classificationResult={classificationResult}
              config={config}
              currentAnalysisRadius={currentAnalysisRadius}
              onRadiusChange={handleRadiusChange}
            />
          </div>
        )}

        {/* Config Toggle Button */}
        {!showConfigPanel && (
          <button
            onClick={() => setShowConfigPanel(true)}
            className="config-toggle-btn fixed top-5 right-5 px-5 py-3 bg-gradient-to-r from-primary to-secondary text-white border-none rounded-lg cursor-pointer font-semibold shadow-lg transition-all hover:-translate-y-px hover:shadow-xl z-[1000]"
          >
            Configuration
          </button>
        )}
      </div>
    </div>
  );
}
