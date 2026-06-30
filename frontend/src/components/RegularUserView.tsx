import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers, Loader2, AlertCircle, Compass, MapPin, Map as MapIcon } from 'lucide-react';
import { useCatalogueConfig } from '../hooks/useCatalogueConfig';
import TerrainMap from './TerrainMap';
import type { GeocodingAddress } from '../utils/types';
import maplibregl from 'maplibre-gl';
import { useGeocoding } from '../hooks/useGeocoding';

// Sub-components
import NotificationsDropdown from './regular-user/NotificationsDropdown';
import AddressSearchSection from './regular-user/AddressSearchSection';
import HeightInputs from './regular-user/HeightInputs';
import MontageSelector from './regular-user/MontageSelector';
import FHEquipmentToggle, { RRHEquipmentToggle, RRUEquipmentToggle } from './regular-user/FHEquipmentToggle';
import ResultsPanel from './regular-user/ResultsPanel';
import HeightRequestModal from './regular-user/HeightRequestModal';
import DocumentPreviewModal from './regular-user/DocumentPreviewModal';
import { generateAndDownloadPdf } from './regular-user/PdfGenerator';
import { AntennaConfigState, RequestFormData, PreviewDocState, LookupResult } from './regular-user/types';

interface RegularUserViewProps {
  apiBaseUrl: string;
  initialMontage?: string | null;
  initialSiteType?: 'nouveau' | 'existant' | null;
  initialFoundationType?: 'metallique' | 'beton' | 'encastre' | null;
}

export default function RegularUserView({
  apiBaseUrl,
  initialMontage,
  initialSiteType,
  initialFoundationType
}: RegularUserViewProps) {
  // Config
  const { config, loading: configLoading } = useCatalogueConfig(apiBaseUrl);
  const { reverseGeocode } = useGeocoding();

  // Core State
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBuildingHeight, setSelectedBuildingHeight] = useState<number>(15);
  const [selectedHeight, setSelectedHeight] = useState<number>(3);
  const [selectedMontage, setSelectedMontage] = useState<string>(initialMontage || '');

  // Additional Fields
  const siteType = initialSiteType || 'nouveau';
  const foundationType = initialFoundationType || 'metallique';
  const ancrageInfo = initialFoundationType === 'metallique' ? 'Fixation sur plot métallique' :
    initialFoundationType === 'beton' ? 'Fixation sur plot béton' :
      initialFoundationType === 'encastre' ? 'Mât encastré' :
        'Fixation sur plot métallique';
  const [dalleThickness, setDalleThickness] = useState<number>(0.5);
  const [plotHeight, setPlotHeight] = useState<number>(0.5);

  // Custom Form Fields when no correspondence
  const [matPrincipal, setMatPrincipal] = useState<string>('');
  const [plotMetallique, setPlotMetallique] = useState<string>('');
  const [brasDeDeport, setBrasDeDeport] = useState<string>('');
  const [matSecondaire, setMatSecondaire] = useState<string>('');

  // Antenna Config
  const [configMode, setConfigMode] = useState<'agile' | 'reference'>('agile');
  const [selectedReference, setSelectedReference] = useState<string>('ref-huawei-standard');
  const [nombreSecteurs, setNombreSecteurs] = useState<number>(3);
  const [ant4gConfig, setAnt4gConfig] = useState<AntennaConfigState>({ model: 'A1', height: 2100, width: 470, thickness: 210, weight: 45 });
  const [ant5gConfig, setAnt5gConfig] = useState<AntennaConfigState>({ model: 'A1', height: 1010, width: 500, thickness: 250, weight: 50 });
  const [hasFhEquipment, setHasFhEquipment] = useState<boolean>(false);
  const [fhWeight, setFhWeight] = useState<number>(30);
  const [fhReference, setFhReference] = useState<string>('');
  const [hasRrhEquipment, setHasRrhEquipment] = useState<boolean>(false);
  const [hasRruEquipment, setHasRruEquipment] = useState<boolean>(false);
  const [rrhReference, setRrhReference] = useState<string>('');
  const [rruReference, setRruReference] = useState<string>('');

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Map State
  const [showMap, setShowMap] = useState<boolean>(false);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);

  // Results State
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  // Request & Notifications State
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestFormData, setRequestFormData] = useState<RequestFormData>({ name: '', email: '', phone: '', description: '' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);

  // Sync initialMontage from parent or default to first standard montage
  useEffect(() => {
    if (config?.standard_montages?.length && !selectedMontage) {
      if (initialMontage && initialMontage !== 'custom') {
        setSelectedMontage(initialMontage);
        const spec = config.standard_montages.find(m => m.id === initialMontage);
        if (spec) {
          setAnt4gConfig({ model: initialMontage, height: spec.ant4g.height, width: spec.ant4g.width, thickness: spec.ant4g.thickness, weight: spec.ant4g.weight });
          setAnt5gConfig({ model: initialMontage, height: spec.ant5g.height, width: spec.ant5g.width, thickness: spec.ant5g.thickness, weight: spec.ant5g.weight });
        }
      } else {
        const spec = config.standard_montages[0];
        setSelectedMontage(spec.id);
        setAnt4gConfig({ model: spec.id, height: spec.ant4g.height, width: spec.ant4g.width, thickness: spec.ant4g.thickness, weight: spec.ant4g.weight });
        setAnt5gConfig({ model: spec.id, height: spec.ant5g.height, width: spec.ant5g.width, thickness: spec.ant5g.thickness, weight: spec.ant5g.weight });
      }
    }
  }, [initialMontage, config]);

  const handleMontageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMontage(val);

    if (val === 'custom') return;

    const spec = config?.standard_montages.find(m => m.id === val);
    if (spec) {
      setAnt4gConfig({ model: val, height: spec.ant4g.height, width: spec.ant4g.width, thickness: spec.ant4g.thickness, weight: spec.ant4g.weight });
      setAnt5gConfig({ model: val, height: spec.ant5g.height, width: spec.ant5g.width, thickness: spec.ant5g.thickness, weight: spec.ant5g.weight });
    }
  };

  const onAddressSelect = (address: GeocodingAddress) => {
    setSelectedAddress(address);
    setSelectedCoords({ latitude: address.latitude, longitude: address.longitude });
    // Reset lookup to force re-fetch
    setLookupResult(null);
    setShowMap(false);
  };

  const handleMapLocationSelect = useCallback(async (lat: number, lon: number) => {
    setSelectedCoords({ latitude: lat, longitude: lon });
    // Keep placeholder while reverse geocoding
    setSelectedAddress({
      label: `${lat}-${lon}`,
      name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      latitude: lat, longitude: lon, city: 'Recherche de l\'adresse...', postcode: '',
      context: '', type: '', importance: 0, target_terrain: null
    });
    setLookupResult(null);
    setShowMap(false);

    try {
      const reverseResult = await reverseGeocode(lat, lon);
      if (reverseResult) {
        setSelectedAddress(reverseResult);
      } else {
        setSelectedAddress({
          label: `${lat}-${lon}`,
          name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          latitude: lat, longitude: lon, city: 'Adresse inconnue', postcode: '',
          context: '', type: '', importance: 0, target_terrain: null
        });
      }
    } catch (err) {
      console.error('Reverse geocoding failed', err);
    }
  }, [reverseGeocode]);

  // Fetch API Catalogue
  useEffect(() => {
    let active = true;

    async function fetchCatalogueData() {
      if (!selectedCoords || !selectedMontage) {
        if (active) setLookupResult(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const precalculatedHeights = config?.precalculated_building_heights || [10, 15, 20, 25, 30, 35, 40, 45];
        let queryHeight = selectedBuildingHeight;

        if (!precalculatedHeights.includes(selectedBuildingHeight)) {
          const validHeights = precalculatedHeights.filter(h => h >= selectedBuildingHeight);
          queryHeight = validHeights.length > 0 ? validHeights[0] : precalculatedHeights[precalculatedHeights.length - 1];
        }

        let url = `${apiBaseUrl}/api/geodata/antenna-equipment/public_lookup/?latitude=${selectedCoords.latitude}&longitude=${selectedCoords.longitude}&building_height=${queryHeight}&mast_height=${selectedHeight}`;
        if (selectedMontage !== 'custom') {
          url += `&montage=${encodeURIComponent(selectedMontage)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur de communication avec le catalogue.");
        const data = await res.json();

        if (active) {
          const eqList = data.equipment || [];

          if (selectedMontage !== 'custom') {
            // The backend already filters by name if montage is passed.
            data.equipment = eqList;
          } else {
            data.equipment = [];
          }

          setLookupResult(data);
        }
      } catch (err: any) {
        if (active) setError(err.message || "Impossible de récupérer les données du catalogue.");
      } finally {
        if (active) setLoading(false);
      }
    }

    const timeoutId = setTimeout(fetchCatalogueData, 300);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [selectedCoords, selectedBuildingHeight, selectedHeight, selectedMontage, apiBaseUrl, config]);

  // MiniMap initialization
  useEffect(() => {
    if (!showMap && selectedCoords && miniMapContainerRef.current) {
      if (!miniMapRef.current) {
        miniMapRef.current = new maplibregl.Map({
          container: miniMapContainerRef.current,
          style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [selectedCoords.longitude, selectedCoords.latitude],
          zoom: 14,
          interactive: false,
          attributionControl: false
        });

        const el = document.createElement('div');
        el.className = 'w-4 h-4 bg-indigo-500 rounded-full border-2 border-white shadow-md';
        new maplibregl.Marker(el)
          .setLngLat([selectedCoords.longitude, selectedCoords.latitude])
          .addTo(miniMapRef.current);

        miniMapRef.current.on('load', () => {
          setTimeout(() => miniMapRef.current?.resize(), 100);
        });
      } else {
        miniMapRef.current.setCenter([selectedCoords.longitude, selectedCoords.latitude]);
      }
    } else {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    }
  }, [showMap, selectedCoords]);

  const handleTriggerCalculation = async () => {
    setCalculating(true);
    try {
      const payload = {
        schema_version: "1.0",
        site: {
          type: siteType,
          ancrage: foundationType,
          address: selectedAddress?.name || '',
          latitude: selectedCoords?.latitude,
          longitude: selectedCoords?.longitude
        },
        environment: {
          region: lookupResult?.detected_region,
          terrain_type: lookupResult?.detected_terrain_type,
          building_height_m: selectedBuildingHeight,
          dalle_thickness_m: foundationType === 'beton' ? dalleThickness : null,
          plot_height_m: foundationType === 'beton' ? plotHeight : null
        },
        structure: {
          mast_height_m: selectedHeight,
          montage_id: selectedMontage,
          is_custom_montage: selectedMontage === 'custom',
          mat_principal: matPrincipal,
          plot_metallique: plotMetallique,
          bras_de_deport: brasDeDeport,
          mat_secondaire: matSecondaire,
          nombre_secteurs: nombreSecteurs
        },
        antenna_4g: {
          model: ant4gConfig.model,
          height_mm: ant4gConfig.height,
          width_mm: ant4gConfig.width,
          thickness_mm: ant4gConfig.thickness,
          weight_dan: ant4gConfig.weight
        },
        antenna_5g: {
          model: ant5gConfig.model,
          height_mm: ant5gConfig.height,
          width_mm: ant5gConfig.width,
          thickness_mm: ant5gConfig.thickness,
          weight_dan: ant5gConfig.weight
        },
        fh_equipment: {
          enabled: hasFhEquipment,
          weight_kg: hasFhEquipment ? fhWeight : null,
          reference: hasFhEquipment ? fhReference : null
        },
        rrh_equipment: {
          enabled: hasRrhEquipment,
          reference: hasRrhEquipment ? rrhReference : null
        },
        rru_equipment: {
          enabled: hasRruEquipment,
          reference: hasRruEquipment ? rruReference : null
        }
      };

      const res = await fetch(`${apiBaseUrl}/api/calculations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Calcul lancé avec succès (Serveur Distant APS)');
      } else {
        const errData = await res.json();
        console.error("Payload error:", errData);
        alert(`Erreur lors du lancement du calcul: ${errData.error || 'Schema Invalide'}`);
      }
    } catch (err) {
      alert('Erreur réseau');
    } finally {
      setCalculating(false);
    }
  };

  const handleDownloadPdfWrap = async () => {
    if (!lookupResult) return;

    let miniMapImage: string | null = null;
    if (miniMapRef.current) {
      try {
        const canvas = miniMapRef.current.getCanvas();
        miniMapImage = canvas.toDataURL('image/png');
      } catch (e) {
        console.warn('Could not capture minimap');
      }
    }

    generateAndDownloadPdf({
      siteType,
      foundationType,
      ancrageInfo,
      selectedAddress,
      selectedCoords,
      lookupResult,
      selectedBuildingHeight,
      selectedHeight,
      selectedMontage,
      ant4gModel: ant4gConfig.model,
      ant4gHeight: ant4gConfig.height,
      ant4gWidth: ant4gConfig.width,
      ant4gThickness: ant4gConfig.thickness,
      ant4gWeight: ant4gConfig.weight,
      ant5gModel: ant5gConfig.model,
      ant5gHeight: ant5gConfig.height,
      ant5gWidth: ant5gConfig.width,
      ant5gThickness: ant5gConfig.thickness,
      ant5gWeight: ant5gConfig.weight,
      hasFhEquipment,
      fhWeight,
      fhReference,
      hasRrhEquipment,
      rrhReference,
      hasRruEquipment,
      rruReference,
      miniMapImage,
      nombreSecteurs
    }, setPdfGenerating);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (configLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p>Chargement de la configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-slate-950 text-white font-sans overflow-hidden selection:bg-indigo-500/30">
      {/* Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            NDC Portail <span className="font-light">Client</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full font-medium border border-emerald-400/20 shadow-sm flex items-center gap-1.5 hidden sm:flex">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
            En Ligne
          </div>

          <NotificationsDropdown
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))}
            onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))}
            onDelete={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Panneau de Gauche : Formulaire de Recherche */}
        <div className="w-full md:w-[480px] lg:w-[550px] flex flex-col bg-slate-900 border-r border-slate-800 shadow-2xl z-10 shrink-0">
          <div className="p-5 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              Consultez notre catalogue d'études structurelles précalculées selon la norme Eurocode.
            </p>

            <AddressSearchSection
              onAddressSelect={onAddressSelect}
              selectedAddress={selectedAddress}
              showMap={showMap}
              setShowMap={setShowMap}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <HeightInputs
              siteType={siteType}
              foundationType={foundationType}
              selectedBuildingHeight={selectedBuildingHeight}
              setSelectedBuildingHeight={setSelectedBuildingHeight}
              selectedHeight={selectedHeight}
              setSelectedHeight={setSelectedHeight}
              dalleThickness={dalleThickness}
              setDalleThickness={setDalleThickness}
              plotHeight={plotHeight}
              setPlotHeight={setPlotHeight}
              config={config}
            />

            <MontageSelector
              selectedMontage={selectedMontage}
              handleMontageChange={handleMontageChange}
              ant4gConfig={ant4gConfig}
              setAnt4gConfig={setAnt4gConfig}
              ant5gConfig={ant5gConfig}
              setAnt5gConfig={setAnt5gConfig}
              config={config}
              configMode={configMode}
              setConfigMode={setConfigMode}
              selectedReference={selectedReference}
              setSelectedReference={setSelectedReference}
            />

            {/* Section 5: Nombre de Secteurs */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                5. Nombre de Secteurs
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNombreSecteurs(num)}
                    className={`flex-1 py-2 rounded text-xs font-semibold transition-all border ${nombreSecteurs === num
                        ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-md'
                        : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                  >
                    {num} {num === 1 ? 'Secteur' : 'Secteurs'}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment Toggles */}
            <div className="space-y-4">
              <FHEquipmentToggle
                hasFhEquipment={hasFhEquipment}
                setHasFhEquipment={setHasFhEquipment}
                fhWeight={fhWeight}
                setFhWeight={setFhWeight}
                fhReference={fhReference}
                setFhReference={setFhReference}
                config={config}
              />
              <RRHEquipmentToggle
                hasRrhEquipment={hasRrhEquipment}
                setHasRrhEquipment={setHasRrhEquipment}
                rrhReference={rrhReference}
                setRrhReference={setRrhReference}
              />
              <RRUEquipmentToggle
                hasRruEquipment={hasRruEquipment}
                setHasRruEquipment={setHasRruEquipment}
                rruReference={rruReference}
                setRruReference={setRruReference}
              />
            </div>

            {/* Show Height Request Warning if custom height */}
            {selectedBuildingHeight && config && !config.precalculated_building_heights.includes(selectedBuildingHeight) && (
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-400 mb-1">Étude personnalisée requise</h4>
                  <p className="text-xs text-amber-200/80 mb-3">La hauteur saisie ne correspond pas aux standards précalculés.</p>
                  <button
                    onClick={() => setShowRequestForm(true)}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg transition-colors"
                  >
                    Demander un calcul spécifique
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panneau de Droite : Carte ou Résultats */}
        <div className="flex-1 bg-slate-950 relative flex flex-col min-w-0">
          {showMap && (
            <div className="absolute inset-0 z-10 animate-fadeIn">
              <TerrainMap
                selectedCoordinates={selectedCoords ? { latitude: selectedCoords.latitude, longitude: selectedCoords.longitude } : null}
                onMapClick={handleMapLocationSelect}
              />
            </div>
          )}

          {!showMap && (
            <div className="absolute inset-0 bg-slate-950 overflow-hidden z-0">
              <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>

              {!selectedCoords && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 relative">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
                  <div className="relative z-10 w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl mb-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-500/20 animate-pulse"></div>
                    <MapPin className="w-10 h-10 text-indigo-400 z-10 relative group-hover:scale-110 transition-transform" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">Analyse Structurelle</h2>
                  <p className="text-slate-400 max-w-md mx-auto text-lg leading-relaxed">
                    Commencez par rechercher une adresse à gauche ou sur la carte pour déterminer les classes de vent et de terrain.
                  </p>
                  <button
                    onClick={() => setShowMap(true)}
                    className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20 hover:shadow-indigo-500/40 hover:-translate-y-1"
                  >
                    <MapIcon className="w-5 h-5" /> Explorer sur la carte
                  </button>
                </div>
              )}

              {selectedCoords && !selectedMontage && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full">
                  <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-6 shadow-2xl">
                    <Layers className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Sélectionner le type de montage</h3>
                  <p className="text-base text-slate-400 max-w-md leading-relaxed">
                    Choisissez un type de montage dans le menu déroulant à gauche pour récupérer les spécifications de conception.
                  </p>
                </div>
              )}

              {selectedCoords && selectedMontage && loading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-slate-800 rounded-full"></div>
                    <div className="w-20 h-20 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-6 mb-2">Analyse en cours...</h3>
                  <p className="text-sm text-slate-400">Classification du terrain et récupération du profil structurel Eurocode.</p>
                </div>
              )}

              {selectedCoords && selectedMontage && error && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-rose-400 h-full">
                  <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Erreur de catalogue</h3>
                  <p className="text-sm text-slate-400">{error}</p>
                </div>
              )}

              {/* Dashboard Content */}
              {selectedCoords && selectedMontage && !loading && !error && lookupResult && (
                <ResultsPanel
                  lookupResult={lookupResult}
                  selectedAddress={selectedAddress}
                  selectedMontage={selectedMontage}
                  isSearching={loading}
                  onPreviewDocument={(doc) => setPreviewDoc(doc as PreviewDocState)}
                  onDownloadPdf={handleDownloadPdfWrap}
                  pdfGenerating={pdfGenerating}
                  onTriggerCalculation={handleTriggerCalculation}
                  isCalculationPending={calculating}
                  matPrincipal={matPrincipal}
                  setMatPrincipal={setMatPrincipal}
                  plotMetallique={plotMetallique}
                  setPlotMetallique={setPlotMetallique}
                  nombreSecteurs={nombreSecteurs}
                  brasDeDeport={brasDeDeport}
                  setBrasDeDeport={setBrasDeDeport}
                  matSecondaire={matSecondaire}
                  setMatSecondaire={setMatSecondaire}
                  equipmentToggles={{
                    fh: hasFhEquipment,
                    rrh: hasRrhEquipment,
                    rru: hasRruEquipment
                  }}
                  equipmentValues={{
                    fh: { poids: `${fhWeight} kg`, référence: fhReference || 'N/A' },
                    rrh: { modèle: rrhReference || 'RRH-001' },
                    rru: { modèle: rruReference || 'RRU-001' }
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <HeightRequestModal
        showHeightRequestForm={showRequestForm}
        setShowHeightRequestForm={setShowRequestForm}
        requestFormData={requestFormData}
        setRequestFormData={setRequestFormData}
        isSubmittingRequest={isSubmittingRequest}
        onSubmitRequest={(e) => {
          e.preventDefault();
          setIsSubmittingRequest(true);
          setTimeout(() => {
            setIsSubmittingRequest(false);
            setShowRequestForm(false);
            alert("Demande envoyée avec succès.");
          }, 1500);
        }}
        selectedBuildingHeight={selectedBuildingHeight}
        selectedHeight={selectedHeight}
      />

      <DocumentPreviewModal
        previewDoc={previewDoc}
        setPreviewDoc={setPreviewDoc}
      />
    </div>
  );
}
