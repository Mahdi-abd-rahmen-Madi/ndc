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
import CatalogueManagement from './components/CatalogueManagement';
import { useTerrainClassification } from './hooks/useTerrainClassification';
import { useTerrainConfig } from './hooks/useTerrainConfig';
import { useRegionBoundaries } from './hooks/useRegionBoundaries';
import { useBDTOPO } from './hooks/useBDTOPO';
import { useGeocoding } from './hooks/useGeocoding';
import type { GeocodingAddress } from './utils/types';
import RegularUserView from './components/RegularUserView';

export default function App() {
  const [userMode, setUserMode] = useState<'engineer' | 'public'>('public');
  const [engineerSubTab, setEngineerSubTab] = useState<'map' | 'catalogue'>('map');
  const [activeTab, setActiveTab] = useState('details');
  const [currentAnalysisRadius, setCurrentAnalysisRadius] = useState(0.5);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  const [regionsVisible, setRegionsVisible] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);
  
  const [showMontageModal, setShowMontageModal] = useState(true);
  const [selectedCivilMontage, setSelectedCivilMontage] = useState<string | null>(null);

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

  const apiBaseUrl = import.meta.env.VITE_API_URL || '';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Header */}
      <header className="header bg-gradient-to-r from-primary to-secondary text-white p-4 px-8 shadow-lg flex-shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">
            {userMode === 'public' 
              ? "Catalogue de Conception d'Antennes" 
              : `Carte de Classification du Terrain - France (${selectedCivilMontage || 'Montage 1'})`}
          </h1>
          <p className="mt-1 opacity-90 text-sm">
            {userMode === 'public' 
              ? 'Trouvez les profils de mât requis et les documents de calcul technique' 
              : 'Cliquez sur la carte pour analyser la classification du terrain (Département Génie Civil)'}
          </p>
        </div>
        
        {/* Toggle Mode & Sub-tabs */}
        <div className="flex items-center gap-2">
          {userMode === 'engineer' && (
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setEngineerSubTab('map')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${engineerSubTab === 'map' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white'}`}
              >
                Carte
              </button>
              <button
                onClick={() => setEngineerSubTab('catalogue')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${engineerSubTab === 'catalogue' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white'}`}
              >
                Base de données
              </button>
            </div>
          )}
          {userMode === 'engineer' && engineerSubTab === 'map' && !showConfigPanel && (
            <button
              onClick={() => setShowConfigPanel(true)}
              className="px-4 py-2 bg-white text-primary hover:bg-white/90 active:bg-white/80 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm"
            >
              Configuration
            </button>
          )}
          <button
            onClick={() => {
              if (userMode === 'public') {
                setUserMode('engineer');
              } else {
                setUserMode('public');
                setShowMontageModal(true);
                setSelectedCivilMontage(null);
              }
            }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/30 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm"
          >
            {userMode === 'public' ? 'Passer au Mode Génie Civil' : 'Passer au Catalogue Public'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden w-full max-w-none">
        {userMode === 'public' ? (
          <RegularUserView apiBaseUrl={apiBaseUrl} initialMontage={selectedCivilMontage} />
        ) : engineerSubTab === 'catalogue' ? (
          <CatalogueManagement />
        ) : (
          <>
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

          </>
        )}
      </div>

      {/* Montage Selection Modal */}
      {showMontageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-100 transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Sélectionner un Montage</h3>
              <button
                onClick={() => setShowMontageModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold transition-colors"
              >
                ×
              </button>
            </div>
            
            <p className="text-slate-500 text-sm mb-6">
              Veuillez sélectionner l'un des 4 montages pour accéder aux outils de conception du Catalogue.
            </p>

            <div className="space-y-3 mb-6">
              {/* Montage 1 - Active */}
              <button
                onClick={() => {
                  setSelectedCivilMontage('A1');
                  setShowMontageModal(false);
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all duration-200 text-left group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold group-hover:scale-110 transition-transform">
                    M1
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">Montage 1</h4>
                    <p className="text-xs text-primary/80 font-medium">Montage en cours d'exploitation</p>
                  </div>
                </div>
                <span className="text-primary text-sm font-semibold flex items-center gap-1">
                  Sélectionner <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </button>

              {/* Montage 2 - Inactive */}
              <div className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 opacity-60 text-left select-none cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    M2
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-500">Montage 2</h4>
                    <p className="text-xs text-slate-400">Non disponible / En cours de développement</p>
                  </div>
                </div>
                <span className="text-xs bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                  Indisponible
                </span>
              </div>

              {/* Montage 3 - Inactive */}
              <div className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 opacity-60 text-left select-none cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    M3
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-500">Montage 3</h4>
                    <p className="text-xs text-slate-400">Non disponible / En cours de développement</p>
                  </div>
                </div>
                <span className="text-xs bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                  Indisponible
                </span>
              </div>

              {/* Montage 4 - Inactive */}
              <div className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 opacity-60 text-left select-none cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    M4
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-500">Montage 4</h4>
                    <p className="text-xs text-slate-400">Non disponible / En cours de développement</p>
                  </div>
                </div>
                <span className="text-xs bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                  Indisponible
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowMontageModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
