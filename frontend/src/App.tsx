import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useAppStore } from './stores/useAppStore';
import { cn } from './utils/cn';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { Database, Map, Sliders, ExternalLink, ShieldCheck, Compass, Sparkles } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import TerrainMap from './components/TerrainMap';
import CLCLegend from './components/CLCLegend';
import InfoPanel from './components/InfoPanel';
import ConfigTabs from './components/ConfigTabs';
import BDTOPOControls from './components/BDTOPOControls';
import RegionControl from './components/RegionControl';
import AddressSearch from './components/AddressSearch';
import MontageSelectionModal from './components/MontageSelectionModal';
import { useTerrainClassification } from './hooks/useTerrainClassification';
import { useTerrainConfig } from './hooks/useTerrainConfig';
import { useRegionBoundaries } from './hooks/useRegionBoundaries';
import { useBDTOPO } from './hooks/useBDTOPO';
import { useGeocoding } from './hooks/useGeocoding';
import type { GeocodingAddress } from './utils/types';

// Lazy loaded route components
const LandingPage = lazy(() => import('./components/LandingPage'));
const LoginView = lazy(() => import('./components/LoginView'));
const NDCPortailTest = lazy(() => import('./components/regular-user/NDCPortailTest'));
const RegularUserView = lazy(() => import('./components/RegularUserView'));
const CatalogueManagement = lazy(() => import('./components/CatalogueManagement'));
const CatalogueTestView = lazy(() => import('./components/CatalogueTestView'));

export default function App() {
  const token = useAppStore((state) => state.token);
  const userEmail = useAppStore((state) => state.userEmail);
  const isAdmin = useAppStore((state) => state.isAdmin);
  const setAuth = useAppStore((state) => state.setAuth);
  const logout = useAppStore((state) => state.logout);

  const handleLoginSuccess = (newToken: string, email: string, adminStatus: boolean) => {
    setAuth(newToken, email, adminStatus);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Chargement...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage token={token} userEmail={userEmail} isAdmin={isAdmin} onLogout={handleLogout} />} />
        <Route path="/portal" element={<MainApp key="public" initialMode="public" token={token} userEmail={userEmail} isAdmin={isAdmin} onLoginSuccess={handleLoginSuccess} onLogout={handleLogout} />} />
        <Route path="/engineer" element={<MainApp key="engineer" initialMode="engineer" token={token} userEmail={userEmail} isAdmin={isAdmin} onLoginSuccess={handleLoginSuccess} onLogout={handleLogout} />} />
        <Route path="/ndc-portail-test" element={<NDCPortailTest />} />
        <Route path="/test-catalogue" element={<CatalogueTestView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

interface MainAppProps {
  initialMode: 'engineer' | 'public';
  token: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  onLoginSuccess: (token: string, email: string, isAdmin: boolean) => void;
  onLogout: () => void;
}

function MainApp({ initialMode, token, userEmail, isAdmin, onLoginSuccess, onLogout }: MainAppProps) {
  const [userMode] = useState<'engineer' | 'public'>(initialMode);
  
  // Zustand Store
  const engineerSubTab = useAppStore((state) => state.engineerSubTab);
  const setEngineerSubTab = useAppStore((state) => state.setEngineerSubTab);
  const showConfigPanel = useAppStore((state) => state.showConfigPanel);
  const setShowConfigPanel = useAppStore((state) => state.setShowConfigPanel);
  const currentAnalysisRadius = useAppStore((state) => state.currentAnalysisRadius);
  
  const regionsVisible = useAppStore((state) => state.regionsVisible);
  const setRegionsVisible = useAppStore((state) => state.setRegionsVisible);
  const selectedCoords = useAppStore((state) => state.selectedCoords);
  const setSelectedCoords = useAppStore((state) => state.setSelectedCoords);
  const setSelectedAddress = useAppStore((state) => state.setSelectedAddress);
  
  const showMontageModal = useAppStore((state) => state.showMontageModal);
  const setShowMontageModal = useAppStore((state) => state.setShowMontageModal);
  const selectedCivilMontage = useAppStore((state) => state.selectedCivilMontage);
  const setSelectedCivilMontage = useAppStore((state) => state.setSelectedCivilMontage);
  const selectedSiteType = useAppStore((state) => state.selectedSiteType);
  const setSelectedSiteType = useAppStore((state) => state.setSelectedSiteType);
  const selectedFoundationType = useAppStore((state) => state.selectedFoundationType);
  const setSelectedFoundationType = useAppStore((state) => state.setSelectedFoundationType);

  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  // Route protection
  if (userMode === 'engineer' && token && !isAdmin) {
    return <Navigate to="/portal" replace />;
  }

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

  useEffect(() => {
    setAnalysisRadius(currentAnalysisRadius);
  }, [currentAnalysisRadius, setAnalysisRadius]);

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

  if (userMode === 'public' && !token) {
    return (
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Chargement...</div>}>
        <LoginView apiBaseUrl={apiBaseUrl} onLoginSuccess={onLoginSuccess} />
      </Suspense>
    );
  }

  // Also require login for engineer if we want to be strict, but the user requested:
  // "admin is the only one capable of accessing espace ingenieur"
  if (userMode === 'engineer' && !token) {
    return (
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Chargement...</div>}>
        <LoginView apiBaseUrl={apiBaseUrl} onLoginSuccess={onLoginSuccess} />
      </Suspense>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      {/* Header (Only shown for engineer mode since portal has its own custom navbar) */}
      {userMode === 'engineer' && (
        <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20 shadow-xs">
          {/* Brand & Context */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
                <Compass className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                    Espace Ingénieur
                  </h1>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Génie Civil
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <span>Classification de terrain</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                    {selectedCivilMontage || 'Cas 1'}
                  </span>
                </p>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden md:block" />

            {/* Sub-tabs: Carte vs Base de données */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setEngineerSubTab('map')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                  engineerSubTab === 'map'
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Map className="w-3.5 h-3.5" />
                <span>Carte interactive</span>
              </button>
              <button
                onClick={() => setEngineerSubTab('catalogue')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                  engineerSubTab === 'catalogue'
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Base de données</span>
              </button>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {engineerSubTab === 'map' && !showConfigPanel && (
              <button
                onClick={() => setShowConfigPanel(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-slate-200 flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Configuration</span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <Link
              to="/ndc-portail-test"
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test NDC</span>
            </Link>

            <Link
              to="/test-catalogue"
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Catalogue</span>
            </Link>

            <Link
              to="/portal"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Portail Client</span>
              <ExternalLink className="w-3 h-3 text-slate-300" />
            </Link>
          </div>
        </header>
      )}

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden w-full max-w-none">
        {userMode === 'public' ? (
          <RegularUserView
            apiBaseUrl={apiBaseUrl}
            initialMontage={selectedCivilMontage}
            initialSiteType={selectedSiteType}
            initialFoundationType={selectedFoundationType}
            onResetMontage={() => setShowMontageModal(true)}
            token={token!}
            userEmail={userEmail!}
            onLogout={onLogout}
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
                  classificationResult={classificationResult}
                  config={config}
                />
              </div>
            )}

          </>
        )}
      </div>

      {/* Cas Selection Modal */}
      <MontageSelectionModal
        show={showMontageModal}
        onClose={() => setShowMontageModal(false)}
        selectedSiteType={selectedSiteType}
        selectedFoundationType={selectedFoundationType}
        onSiteTypeSelect={(type) => {
          setSelectedSiteType(type);
          if (selectedFoundationType !== 'metallique' && selectedFoundationType !== null) {
            setSelectedFoundationType('metallique');
          }
        }}
        onFoundationTypeSelect={setSelectedFoundationType}
        onCasSelect={(cas) => setSelectedCivilMontage(cas)}
      />
    </div>
  );
}
