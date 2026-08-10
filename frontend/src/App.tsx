import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useAppStore } from './stores/useAppStore';
import { cn } from './utils/cn';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
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
        <header className="header bg-gradient-to-r from-primary to-secondary text-white p-4 px-8 shadow-lg flex-shrink-0 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">
              Carte de Classification du Terrain - France ({selectedCivilMontage || 'Cas 1'})
            </h1>
            <p className="mt-1 opacity-90 text-sm">
              Cliquez sur la carte pour analyser la classification du terrain (Département Génie Civil)
            </p>
          </div>

          {/* Toggle Mode & Sub-tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setEngineerSubTab('map')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition",
                  engineerSubTab === 'map' ? "bg-white text-primary shadow-sm" : "text-white/70 hover:text-white"
                )}
              >
                Carte
              </button>
              <button
                onClick={() => setEngineerSubTab('catalogue')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition",
                  engineerSubTab === 'catalogue' ? "bg-white text-primary shadow-sm" : "text-white/70 hover:text-white"
                )}
              >
                Base de données
              </button>
            </div>
            {engineerSubTab === 'map' && !showConfigPanel && (
              <button
                onClick={() => setShowConfigPanel(true)}
                className="px-4 py-2 bg-white text-primary hover:bg-white/90 active:bg-white/80 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm"
              >
                Configuration
              </button>
            )}
            <Link
              to="/ndc-portail-test"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-blue-500 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm mr-2"
            >
              Mode Test NDC
            </Link>
            <Link
              to="/portal"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/30 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm"
            >
              Passer au Catalogue Public
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
