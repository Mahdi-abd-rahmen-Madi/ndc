// App.tsx - Main application component

import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { AlertCircle } from 'lucide-react';
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
  return (
    <Routes>
      <Route path="/" element={<MainApp key="public" initialMode="public" />} />
      <Route path="/engineer" element={<MainApp key="engineer" initialMode="engineer" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function MainApp({ initialMode }: { initialMode: 'engineer' | 'public' }) {
  const [userMode] = useState<'engineer' | 'public'>(initialMode);
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
  const [selectedSiteType, setSelectedSiteType] = useState<'nouveau' | 'existant' | null>(null);
  const [selectedFoundationType, setSelectedFoundationType] = useState<'metallique' | 'beton' | 'encastre' | null>(null);

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
              : `Carte de Classification du Terrain - France (${selectedCivilMontage || 'Cas 1'})`}
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
          {userMode === 'public' ? null : (
            <Link
              to="/"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/30 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm"
            >
              Passer au Catalogue Public
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden w-full max-w-none">
        {userMode === 'public' ? (
          <RegularUserView
            apiBaseUrl={apiBaseUrl}
            initialMontage={selectedCivilMontage}
            initialSiteType={selectedSiteType}
            initialFoundationType={selectedFoundationType}
          />
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

      {/* Cas Selection Modal */}
      {showMontageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full mx-4 border border-gray-100 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-bold text-slate-800">Sélectionner le type de Structure :</h3>
              <button
                onClick={() => setShowMontageModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold transition-colors"
              >
                ×
              </button>
            </div>

            <p className="text-slate-500 text-sm mb-6">
              Veuillez sélectionner l'un des cas ci-dessous pour accéder aux outils de conception du Catalogue. Chaque cas correspond à une configuration de structure différente.
            </p>

            {/* Prompts section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-slate-100 pb-6">
              {/* Site Type Prompt */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Type de site</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setSelectedSiteType('nouveau');
                      // Reset foundation if incompatible
                      if (selectedFoundationType !== 'metallique' && selectedFoundationType !== null) {
                        setSelectedFoundationType(null);
                      }
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${selectedSiteType === 'nouveau'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800">Site Neuf</span>
                      <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md">Disponible</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Nouvelle implantation</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSiteType('existant');
                      setSelectedFoundationType(null);
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${selectedSiteType === 'existant'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800">Site Existant</span>
                      <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">Indisponible</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Structure existante</span>
                  </button>
                </div>
              </div>

              {/* Foundation Type Prompt */}
              <div className={`flex flex-col gap-2 transition-all duration-300 ${!selectedSiteType ? 'opacity-40 pointer-events-none' : ''}`}>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Type d'ancrage {!selectedSiteType && <span className="text-[10px] text-slate-400 font-normal normal-case">(Sélectionnez le type de site d'abord)</span>}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={selectedSiteType !== 'nouveau'}
                    onClick={() => setSelectedFoundationType('metallique')}
                    className={`p-2 rounded-xl border-2 text-left transition-all flex flex-col gap-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${selectedFoundationType === 'metallique'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <span className="font-semibold text-xs text-slate-800">Plot métallique</span>
                    <span className="text-[9px] text-slate-500">Disponible</span>
                  </button>

                  <button
                    disabled={selectedSiteType !== 'nouveau'}
                    onClick={() => setSelectedFoundationType('beton')}
                    className={`p-2 rounded-xl border-2 text-left transition-all flex flex-col gap-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${selectedFoundationType === 'beton'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <span className="font-semibold text-xs text-slate-800">Plot Béton</span>
                    <span className="text-[9px] text-slate-400">Indisponible</span>
                  </button>

                  {/* Encastré removed */}
                </div>
              </div>
            </div>

            {/* Incompatibility message */}
            {selectedSiteType && selectedFoundationType && (selectedSiteType !== 'nouveau' || selectedFoundationType !== 'metallique') && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-800">Configuration non disponible</h4>
                  <p className="text-xs text-amber-600 mt-0.5">
                    La configuration sélectionnée (Site {selectedSiteType === 'existant' ? 'Existant' : 'Neuf'} / {selectedFoundationType === 'beton' ? 'Plot Béton' : selectedFoundationType === 'encastre' ? 'Encastré' : 'Plot métallique'}) n'est pas encore disponible dans le Catalogue.
                  </p>
                  <p className="text-xs text-amber-700 font-semibold mt-1">
                    Veuillez sélectionner "Site Neuf" et "Plot métallique" pour activer le Cas 1.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              {/* Cas 1 - Active */}
              {selectedSiteType === 'nouveau' && selectedFoundationType === 'metallique' ? (
                <button
                  onClick={() => {
                    setSelectedCivilMontage('A1');
                    setShowMontageModal(false);
                  }}
                  className="flex flex-col rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 hover:shadow-lg transition-all duration-300 text-left group cursor-pointer overflow-hidden animate-pulse"
                >
                  <div className="relative w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4" style={{ minHeight: '220px' }}>
                    <img
                      src="/cas1.png"
                      alt="Structure Cas 1"
                      className="max-h-[200px] w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-md"
                    />
                    <div className="absolute top-3 left-3 bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                      C1
                    </div>
                    <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      Disponible
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <h4 className="text-lg font-bold text-slate-800">Cas 1</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Mât + Plot | Ant. 4G intégrée + 5G sur bras</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-primary/70 font-medium bg-primary/10 px-2.5 py-1 rounded-full">En cours d'exploitation</span>
                      <span className="text-primary text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Sélectionner <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </span>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-60">
                  <div className="relative w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4" style={{ minHeight: '220px' }}>
                    <img
                      src="/cas1.png"
                      alt="Structure Cas 1"
                      className="max-h-[200px] w-auto object-contain grayscale opacity-50 drop-shadow-sm"
                    />
                    <div className="absolute top-3 left-3 bg-slate-400 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                      C1
                    </div>
                    <div className="absolute top-3 right-3 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Indisponible
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <h4 className="text-lg font-bold text-slate-500">Cas 1</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Mât + Plot | Ant. 4G intégrée + 5G sur bras</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-400 font-medium bg-slate-200 px-2.5 py-1 rounded-full">
                        {!selectedSiteType || !selectedFoundationType
                          ? "Sélectionnez le type de site et de fondation"
                          : "Non disponible pour cette configuration"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cas 2 - Inactive */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-70">
                <div className="relative w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4" style={{ minHeight: '220px' }}>
                  <img
                    src="/cas2.png"
                    alt="Structure Cas 2"
                    className="max-h-[200px] w-auto object-contain grayscale opacity-60 drop-shadow-sm"
                  />
                  <div className="absolute top-3 left-3 bg-slate-400 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    C2
                  </div>
                  <div className="absolute top-3 right-3 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Indisponible
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <h4 className="text-lg font-bold text-slate-500">Cas 2</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Mât + Plot | Ant. 4G/5G – bras séparés</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-400 font-medium bg-slate-200 px-2.5 py-1 rounded-full">En cours de développement</span>
                  </div>
                </div>
              </div>

              {/* Cas 3 - Inactive */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-70">
                <div className="relative w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4" style={{ minHeight: '220px' }}>
                  <img
                    src="/cas3.png"
                    alt="Structure Cas 3"
                    className="max-h-[200px] w-auto object-contain grayscale opacity-60 drop-shadow-sm"
                  />
                  <div className="absolute top-3 left-3 bg-slate-400 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    C3
                  </div>
                  <div className="absolute top-3 right-3 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Indisponible
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <h4 className="text-lg font-bold text-slate-500">Cas 3</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Cas 3 – Mât + Plot | Ant. 4G/5G – mât commun</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-400 font-medium bg-slate-200 px-2.5 py-1 rounded-full">En cours de développement</span>
                  </div>
                </div>
              </div>

              {/* Cas 4 - Inactive */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-70">
                <div className="relative w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4" style={{ minHeight: '220px' }}>
                  <img
                    src="/cas4.png"
                    alt="Structure Cas 4"
                    className="max-h-[200px] w-auto object-contain grayscale opacity-60 drop-shadow-sm"
                  />
                  <div className="absolute top-3 left-3 bg-slate-400 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    C4
                  </div>
                  <div className="absolute top-3 right-3 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Indisponible
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <h4 className="text-lg font-bold text-slate-500">Cas 4</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">Cas 4 – Mât + Plot | Antenne multitechno</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-400 font-medium bg-slate-200 px-2.5 py-1 rounded-full">En cours de développement</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowMontageModal(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-sm font-semibold transition cursor-pointer"
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
