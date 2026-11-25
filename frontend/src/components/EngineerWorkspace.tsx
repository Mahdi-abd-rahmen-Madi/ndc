import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Database, Map, Sliders, ExternalLink, ShieldCheck, Compass } from 'lucide-react';
import type maplibregl from 'maplibre-gl';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';
import { formatStructureCaseLabel } from './regular-user/types';
import TerrainMap from './TerrainMap';
import CLCLegend from './CLCLegend';
import InfoPanel from './InfoPanel';
import ConfigTabs from './ConfigTabs';
import BDTOPOControls from './BDTOPOControls';
import RegionControl from './RegionControl';
import AddressSearch from './AddressSearch';
import { useTerrainClassification } from '../hooks/useTerrainClassification';
import { useTerrainConfig } from '../hooks/useTerrainConfig';
import { useRegionBoundaries } from '../hooks/useRegionBoundaries';
import { useBDTOPO } from '../hooks/useBDTOPO';
import { useGeocoding } from '../hooks/useGeocoding';
import type { GeocodingAddress } from '../utils/types';

const CatalogueManagement = lazy(() => import('./CatalogueManagement'));

export default function EngineerWorkspace() {
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
  const selectedCivilMontage = useAppStore((state) => state.selectedCivilMontage);

  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  const {
    classify,
    reset: resetClassification,
    loading: classificationLoading,
    error: classificationError,
    result: classificationResult,
  } = useTerrainClassification();

  const { config, fetchConfig } = useTerrainConfig();
  const { fetchRegions, addRegionsToMap, removeRegionsFromMap } = useRegionBoundaries();

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

  useEffect(() => {
    fetchConfig();
    fetchRegions();
  }, [fetchConfig, fetchRegions]);

  const classificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (classificationTimeoutRef.current) {
        clearTimeout(classificationTimeoutRef.current);
      }
    };
  }, []);

  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
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
    [classify, config, currentAnalysisRadius, reverseGeocode, setSelectedCoords, setSelectedAddress]
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
    [classify, config, currentAnalysisRadius, mapInstance, setSelectedAddress, setSelectedCoords]
  );

  const handleClearAddress = useCallback(() => {
    setSelectedAddress(null);
    setSelectedCoords(null);
    resetClassification();
  }, [resetClassification, setSelectedAddress, setSelectedCoords]);

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

    setRegionsVisible((prev) => {
      const newState = !prev;
      if (newState) {
        addRegionsToMap(mapInstance, 'regions-source', 'regions-layer');
      } else {
        removeRegionsFromMap(mapInstance, 'regions-layer');
      }
      return newState;
    });
  }, [mapInstance, addRegionsToMap, removeRegionsFromMap, setRegionsVisible]);

  const handleToggleBDTOPO = useCallback(() => {
    if (!mapInstance) return;

    toggleBDTOPO();
    if (!bdtopoVisible) {
      addBDTOPOLayer(mapInstance, 'bdtopo-source', 'bdtopo-buildings');
    } else {
      removeBDTOPOLayer(mapInstance, 'bdtopo-buildings');
    }
  }, [mapInstance, bdtopoVisible, toggleBDTOPO, addBDTOPOLayer, removeBDTOPOLayer]);

  useEffect(() => {
    if (bdtopoVisible && mapInstance) {
      handleBDTOPOStyleChange();
    }
  }, [bdtopoConfig, bdtopoVisible, mapInstance, handleBDTOPOStyleChange]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20 shadow-xs">
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
                  {formatStructureCaseLabel(selectedCivilMontage)}
                </span>
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setEngineerSubTab('map')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                engineerSubTab === 'map'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Carte interactive</span>
            </button>
            <button
              onClick={() => setEngineerSubTab('catalogue')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer',
                engineerSubTab === 'catalogue'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Base de données</span>
            </button>
          </div>
        </div>

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
            to="/test-catalogue"
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Catalogue</span>
          </Link>

          <Link
            to="/portail"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
          >
            <span>Portail Client</span>
            <ExternalLink className="w-3 h-3 text-slate-300" />
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden w-full max-w-none">
        {engineerSubTab === 'catalogue' ? (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-500">Chargement...</div>}>
            <CatalogueManagement />
          </Suspense>
        ) : (
          <>
            <CLCLegend
              detectedCodes={classificationResult?.detected_clc_codes || []}
              config={config}
            />

            <div className="map-container flex-1 relative">
              <TerrainMap
                onMapClick={handleMapClick}
                onMapLoad={handleMapLoad}
                selectedCoordinates={selectedCoords}
                clcPolygons={classificationResult?.clc_polygons}
                transitionZones={classificationResult?.transition_zones}
                analysisRadius={currentAnalysisRadius}
              />

              <AddressSearch
                onAddressSelect={handleAddressSelect}
                onClearAddress={handleClearAddress}
              />

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

              <RegionControl visible={regionsVisible} onToggle={handleToggleRegions} />
            </div>

            <InfoPanel
              classificationResult={classificationResult}
              loading={classificationLoading}
              error={classificationError}
            />

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
    </div>
  );
}

