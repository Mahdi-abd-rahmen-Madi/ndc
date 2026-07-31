import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
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
import SectorConfigurator from './regular-user/SectorConfigurator';
import FHEquipmentToggle, { RRHEquipmentToggle, RRUEquipmentToggle, TDEquipmentToggle, GenericEquipmentToggle, CoffretEquipmentToggle } from './regular-user/FHEquipmentToggle';
import ResultsPanel from './regular-user/ResultsPanel';
import HeightRequestModal from './regular-user/HeightRequestModal';
import DocumentPreviewModal from './regular-user/DocumentPreviewModal';
import PhotoPromptModal from './regular-user/PhotoPromptModal';
import { generateAndDownloadPdf } from './regular-user/PdfGenerator';
import { SectorData, RequestFormData, PreviewDocState, SimilarityMode } from './regular-user/types';

interface RegularUserViewProps {
  apiBaseUrl: string;
  initialMontage?: string | null;
  initialSiteType?: 'nouveau' | 'existant' | null;
  initialFoundationType?: 'metallique' | 'beton' | 'encastre' | null;
  onResetMontage?: () => void;
}

const defaultSectorData = (id: number): SectorData => ({
  id,
  selectedHeight: 3,
  selectedMontage4G: '',
  selectedMontage5G: '',
  configMode: 'agile',
  selectedReference4G: 'ref-huawei-standard',
  selectedReference5G: 'ref-huawei-standard',
  ant4gConfig: { model: 'A1', height: 2100, width: 470, thickness: 210, weight: 45 },
  ant5gConfig: { model: 'A1', height: 1010, width: 500, thickness: 250, weight: 50 },
  matPrincipal: '',
  plotMetallique: '',
  brasDeDeport: '',
  matSecondaire: '',
  lookupResult: null,
  loading: false,
  error: null
});

// Helper to generate a hash for a sector's calculation inputs
const getCalculationHash = (s: SectorData) => {
  return JSON.stringify({
    selectedHeight: s.selectedHeight,
    selectedMontage4G: s.selectedMontage4G,
    selectedMontage5G: s.selectedMontage5G,
    ant4gConfig: s.ant4gConfig,
    ant5gConfig: s.ant5gConfig,
    matPrincipal: s.matPrincipal,
    plotMetallique: s.plotMetallique,
    brasDeDeport: s.brasDeDeport,
    matSecondaire: s.matSecondaire
  });
};

const getCatalogueHash = (s: SectorData) => {
  return `${s.selectedHeight}-${s.selectedMontage4G}-${s.selectedMontage5G}`;
};

export default function RegularUserView({
  apiBaseUrl,
  initialMontage,
  initialSiteType,
  initialFoundationType,
  onResetMontage
}: RegularUserViewProps) {
  // Config
  const { config, loading: configLoading } = useCatalogueConfig(apiBaseUrl);
  const { reverseGeocode } = useGeocoding();

  // Core State
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBuildingHeight, setSelectedBuildingHeight] = useState<number>(15);
  const [nombreSecteurs, setNombreSecteurs] = useState<number>(3);

  const siteType = initialSiteType || 'nouveau';
  const foundationType = initialFoundationType || 'metallique';
  const ancrageInfo = initialFoundationType === 'metallique' ? 'Fixation sur plot métallique' :
    initialFoundationType === 'beton' ? 'Fixation sur plot béton' :
      initialFoundationType === 'encastre' ? 'Mât encastré' :
        'Fixation sur plot métallique';

  const [sectors, setSectors] = useState<SectorData[]>(
    Array.from({ length: 3 }, (_, i) => defaultSectorData(i))
  );

  const [similarityMode, setSimilarityMode] = useState<SimilarityMode>('none');

  // Global Equipment
  const [dalleThickness, setDalleThickness] = useState<number>(0.5);
  const [plotHeight, setPlotHeight] = useState<number>(0.5);

  const [hasFhEquipment, setHasFhEquipment] = useState<boolean>(false);
  const [fhDiameter, setFhDiameter] = useState<number>(300);
  const [fhReference, setFhReference] = useState<string>('');
  const [fhQuantity, setFhQuantity] = useState<number>(1);
  const [hasRrhEquipment, setHasRrhEquipment] = useState<boolean>(false);
  const [hasRruEquipment, setHasRruEquipment] = useState<boolean>(false);
  const [rrhReference, setRrhReference] = useState<string>('');
  const [rrhQuantity, setRrhQuantity] = useState<number>(1);
  const [rruReference, setRruReference] = useState<string>('');
  const [rruQuantity, setRruQuantity] = useState<number>(1);
  const [hasTdEquipment, setHasTdEquipment] = useState<boolean>(false);
  const [tdType, setTdType] = useState<'tetraphase' | 'monophase'>('tetraphase');
  const [tdReference, setTdReference] = useState<string>('');
  const [tgbtReference, setTgbtReference] = useState<string>('');
  const [hasGps, setHasGps] = useState<boolean>(false);
  const [gpsQuantity, setGpsQuantity] = useState<number>(1);
  const [gpsReference, setGpsReference] = useState<string>('');
  const [hasBoitierLovage, setHasBoitierLovage] = useState<boolean>(false);
  const [boitierLovageQuantity, setBoitierLovageQuantity] = useState<number>(1);
  const [boitierLovageReference, setBoitierLovageReference] = useState<string>('');
  const [hasCoffret, setHasCoffret] = useState<boolean>(false);
  const [coffretReference, setCoffretReference] = useState<string>('');

  // Status State
  const [calculating, setCalculating] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [ndcPdfUrl, setNdcPdfUrl] = useState<string | null>(null);

  // Photo Upload State
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [pendingSectorCalc, setPendingSectorCalc] = useState<SectorData | null>(null);

  // Map State
  const [showMap, setShowMap] = useState<boolean>(false);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);

  // Request & Notifications State
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestFormData, setRequestFormData] = useState<RequestFormData>({ name: '', email: '', phone: '', description: '' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);

  // Sync initialMontage from parent or default to first standard montage
  useEffect(() => {
    if (config?.standard_montages?.length) {
      setSectors(prev => prev.map(s => {
        if (!s.selectedMontage4G) {
          const mId = (initialMontage && initialMontage !== 'custom') ? initialMontage : config.standard_montages[0].id;
          const spec = config.standard_montages.find(m => m.id === mId) || config.standard_montages[0];
          return {
            ...s,
            selectedMontage4G: mId,
            selectedMontage5G: mId,
            ant4gConfig: { model: mId, height: spec.ant4g.height, width: spec.ant4g.width, thickness: spec.ant4g.thickness, weight: spec.ant4g.weight },
            ant5gConfig: { model: mId, height: spec.ant5g.height, width: spec.ant5g.width, thickness: spec.ant5g.thickness, weight: spec.ant5g.weight }
          };
        }
        return s;
      }));
    }
  }, [initialMontage, config]);

  const updateSector = (index: number, updates: Partial<SectorData>) => {
    setSectors(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };

      // Auto-sync based on similarityMode
      if (index === 0) {
        if (similarityMode === 'all_similar') {
          next[1] = { ...next[1], ...updates };
        }
        if (similarityMode === 'all_similar') {
          next[2] = { ...next[2], ...updates };
        }
      }
      return next;
    });
  };

  // Sync data when similarity mode changes
  useEffect(() => {
    if (similarityMode === 'all_similar') {
      setSectors(prev => {
        const s1 = prev[0];
        const next = [...prev];
        next[1] = { ...s1, id: next[1].id, lookupResult: next[1].lookupResult, loading: next[1].loading, error: next[1].error };
        next[2] = { ...s1, id: next[2].id, lookupResult: next[2].lookupResult, loading: next[2].loading, error: next[2].error };
        return next;
      });
    }
  }, [similarityMode]);

  // Handle number of sectors changing
  useEffect(() => {
    if (nombreSecteurs === 1) {
      setSimilarityMode('none');
    }
  }, [nombreSecteurs, similarityMode]);

  const onAddressSelect = (address: GeocodingAddress) => {
    setSelectedAddress(address);
    setSelectedCoords({ latitude: address.latitude, longitude: address.longitude });
    setSectors(prev => prev.map(s => ({ ...s, lookupResult: null })));
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
    setSectors(prev => prev.map(s => ({ ...s, lookupResult: null })));
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

  const activeSectors = sectors.slice(0, nombreSecteurs);
  const sectorDependencies = activeSectors.map(s => getCatalogueHash(s)).join('|');

  // Fetch API Catalogue for distinct sectors
  useEffect(() => {
    if (!selectedCoords) return;

    let active = true;

    async function fetchCatalogueData() {
      // Group by catalogue lookup hash
      const uniqueHashes = Array.from(new Set(activeSectors.map(getCatalogueHash)));

      setSectors(prev => prev.map((s, i) => i < nombreSecteurs ? { ...s, loading: true, error: null } : s));

      try {
        const precalculatedHeights = config?.precalculated_building_heights || [10, 15, 20, 25, 30, 35, 40, 45];
        let queryHeight = selectedBuildingHeight;
        if (!precalculatedHeights.includes(selectedBuildingHeight)) {
          const validHeights = precalculatedHeights.filter(h => h >= selectedBuildingHeight);
          queryHeight = validHeights.length > 0 ? validHeights[0] : precalculatedHeights[precalculatedHeights.length - 1];
        }

        const results = await Promise.all(uniqueHashes.map(async (hash) => {
          const sector = activeSectors.find(s => getCatalogueHash(s) === hash);
          if (!sector || !sector.selectedMontage4G || !sector.selectedMontage5G) return { hash, data: null, error: null };

          const isCustom = sector.selectedMontage4G !== sector.selectedMontage5G || sector.selectedMontage4G === 'custom';

          let url = `${apiBaseUrl}/api/geodata/antenna-equipment/public_lookup/?latitude=${selectedCoords!.latitude}&longitude=${selectedCoords!.longitude}&building_height=${queryHeight}&mast_height=${sector.selectedHeight}`;
          if (!isCustom) {
            url += `&montage=${encodeURIComponent(sector.selectedMontage4G)}`;
          }

          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Erreur de communication avec le catalogue.");
            const data = await res.json();

            if (!isCustom) {
              data.equipment = data.equipment || [];
            } else {
              data.equipment = [];
            }
            return { hash, data, error: null };
          } catch (e: any) {
            return { hash, data: null, error: e.message || "Erreur" };
          }
        }));

        if (active) {
          setSectors(prev => prev.map(s => {
            const res = results.find(r => r.hash === getCatalogueHash(s));
            if (res) {
              return { ...s, lookupResult: res.data, error: res.error, loading: false };
            }
            return s;
          }));
        }
      } catch (err: any) {
        if (active) {
          setSectors(prev => prev.map(s => ({ ...s, loading: false, error: "Erreur globale" })));
        }
      }
    }

    const timeoutId = setTimeout(fetchCatalogueData, 300);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCoords, selectedBuildingHeight, sectorDependencies, apiBaseUrl, config, nombreSecteurs]);

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

  // Group unique configurations for calculations/PDF
  const uniqueGroupsMap = new Map<string, { hash: string, indices: number[], sector: SectorData }>();
  activeSectors.forEach((s, idx) => {
    const hash = getCalculationHash(s);
    if (!uniqueGroupsMap.has(hash)) {
      uniqueGroupsMap.set(hash, { hash, indices: [idx], sector: s });
    } else {
      uniqueGroupsMap.get(hash)!.indices.push(idx);
    }
  });
  const uniqueGroups = Array.from(uniqueGroupsMap.values());

  const handleTriggerCalculation = async (sector: SectorData) => {
    setPendingSectorCalc(sector);
    setShowPhotoPrompt(true);
  };

  const confirmPhotoAndCalculate = async (photoFile: File, siteName: string, clientName: string) => {
    if (!pendingSectorCalc) return;
    const sector = pendingSectorCalc;

    setCalculating(true);
    let photoUrl = null;

    try {
      // 1. Upload Photo
      const formData = new FormData();
      formData.append('photo', photoFile);

      const uploadRes = await fetch(`${apiBaseUrl}/api/upload-photo/`, {
        method: 'POST',
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        photoUrl = uploadData.photo_url;
      } else {
        alert("Erreur lors de l'envoi de la photo.");
        setCalculating(false);
        return;
      }

      // 2. Launch Calculation
      const payload = {
        schema_version: "1.0",
        site: {
          type: siteType,
          address: selectedAddress?.name || '',
          name: siteName,
          client: clientName,
          ancrage: foundationType,
          latitude: selectedCoords?.latitude,
          longitude: selectedCoords?.longitude
        },
        environment: {
          region: sector.lookupResult?.detected_region,
          terrain_type: sector.lookupResult?.detected_terrain_type,
          building_height_m: selectedBuildingHeight,
          dalle_thickness_m: foundationType === 'beton' ? dalleThickness : null,
          plot_height_m: foundationType === 'beton' ? plotHeight : null
        },
        structure: {
          mast_height_m: sector.selectedHeight,
          montage_id: (sector.selectedMontage4G === sector.selectedMontage5G && sector.selectedMontage4G !== 'custom') ? sector.selectedMontage4G : 'custom',
          is_custom_montage: sector.selectedMontage4G !== sector.selectedMontage5G || sector.selectedMontage4G === 'custom',
          mat_principal: sector.matPrincipal,
          plot_metallique: sector.plotMetallique,
          bras_de_deport: sector.brasDeDeport,
          mat_secondaire: sector.matSecondaire,
          nombre_secteurs: nombreSecteurs
        },
        antenna_4g: {
          model: sector.ant4gConfig.model,
          height_mm: sector.ant4gConfig.height,
          width_mm: sector.ant4gConfig.width,
          thickness_mm: sector.ant4gConfig.thickness,
          weight_dan: sector.ant4gConfig.weight
        },
        antenna_5g: {
          model: sector.ant5gConfig.model,
          height_mm: sector.ant5gConfig.height,
          width_mm: sector.ant5gConfig.width,
          thickness_mm: sector.ant5gConfig.thickness,
          weight_dan: sector.ant5gConfig.weight
        },
        fh_equipment: {
          enabled: hasFhEquipment,
          diameter_mm: hasFhEquipment ? fhDiameter : null,
          reference: hasFhEquipment ? fhReference : null,
          quantity: hasFhEquipment ? fhQuantity : null
        },
        rrh_equipment: {
          enabled: hasRrhEquipment,
          reference: hasRrhEquipment ? rrhReference : null,
          quantity: hasRrhEquipment ? rrhQuantity : null
        },
        rru_equipment: {
          enabled: hasRruEquipment,
          reference: hasRruEquipment ? rruReference : null,
          quantity: hasRruEquipment ? rruQuantity : null
        },
        td_equipment: {
          enabled: hasTdEquipment,
          type: hasTdEquipment ? tdType : null,
          reference: hasTdEquipment ? tdReference : null,
          tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
        },
        gps: { enabled: hasGps, quantity: hasGps ? gpsQuantity : null, reference: hasGps ? gpsReference : null },
        boitier_lovage: { enabled: hasBoitierLovage, quantity: hasBoitierLovage ? boitierLovageQuantity : null, reference: hasBoitierLovage ? boitierLovageReference : null },
        coffrets_fibre: { enabled: hasCoffret, quantity: 1, reference: hasCoffret ? coffretReference : null },
        coffrets_hybride: { enabled: false, quantity: null, reference: null }
      };

      const res = await fetch(`${apiBaseUrl}/api/calculations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const calcData = await res.json();
        const jobId = calcData.data.id;
        
        // 3. Poll for calculation completion
        let isCompleted = calcData.data.status === 'COMPLETED';
        let jobResult = calcData.data;

        while (!isCompleted) {
          await new Promise(r => setTimeout(r, 2000));
          const pollRes = await fetch(`${apiBaseUrl}/api/calculations/${jobId}/`);
          if (pollRes.ok) {
            jobResult = await pollRes.json();
            isCompleted = jobResult.status === 'COMPLETED';
            if (jobResult.status === 'FAILED' || jobResult.status === 'ERROR') {
              throw new Error("Calcul échoué sur le serveur.");
            }
          } else {
            break;
          }
        }

        // 4. Trigger PDF Generation
        const pdfRes = await fetch(`${apiBaseUrl}/api/calculations/${jobId}/generate_pdf/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_url: photoUrl })
        });

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json();
          setNdcPdfUrl(pdfData.ndc_pdf_url);
          setShowPhotoPrompt(false);
          setPendingSectorCalc(null);
          alert('Note de Calcul générée avec succès.');
        } else {
          alert('Erreur lors de la génération du PDF Note de Calcul.');
        }

      } else {
        const errData = await res.json();
        console.error("Payload error:", errData);
        alert(`Erreur lors du lancement du calcul: ${errData.error || 'Schema Invalide'}`);
      }
    } catch (err: any) {
      alert(`Erreur réseau ou calcul: ${err.message || 'Erreur inconnue'}`);
    } finally {
      setCalculating(false);
    }
  };

  const handleDownloadPdfWrap = async (sector: SectorData, groupIndices: number[]) => {
    if (!sector.lookupResult) return;

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
      lookupResult: sector.lookupResult,
      selectedBuildingHeight,
      selectedHeight: sector.selectedHeight,
      selectedMontage: sector.selectedMontage4G === sector.selectedMontage5G ? sector.selectedMontage4G : 'custom',
      ant4gModel: sector.ant4gConfig.model,
      ant4gHeight: sector.ant4gConfig.height,
      ant4gWidth: sector.ant4gConfig.width,
      ant4gThickness: sector.ant4gConfig.thickness,
      ant4gWeight: sector.ant4gConfig.weight,
      ant5gModel: sector.ant5gConfig.model,
      ant5gHeight: sector.ant5gConfig.height,
      ant5gWidth: sector.ant5gConfig.width,
      ant5gThickness: sector.ant5gConfig.thickness,
      ant5gWeight: sector.ant5gConfig.weight,
      hasFhEquipment,
      fhDiameter,
      fhReference,
      fhQuantity,
      hasRrhEquipment,
      rrhReference,
      rrhQuantity,
      hasRruEquipment,
      rruReference,
      rruQuantity,
      hasTdEquipment,
      tdType,
      tdReference,
      tgbtReference,
      hasGps, gpsQuantity, gpsReference,
      hasBoitierLovage, boitierLovageQuantity, boitierLovageReference,
      hasCoffret, coffretReference,
      coffretOptions: config?.coffret_references || [],
      miniMapImage,
      nombreSecteurs: groupIndices.length
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

  const anyLoading = activeSectors.some(s => s.loading);
  const anyError = activeSectors.find(s => s.error)?.error;

  return (
    <div className="flex flex-col w-full h-screen bg-slate-950 text-white font-sans overflow-hidden selection:bg-indigo-500/30">
      <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            NDC Portail <span className="font-light">Client</span>
          </h1>

          <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>

          <div className="hidden sm:flex items-center gap-3 text-sm">
            <span className="text-slate-400">Site:</span>
            <span className="text-slate-200 font-medium px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700">
              {siteType === 'nouveau' ? 'Neuf' : 'Existant'}
            </span>
            <span className="text-slate-400 ml-2">Ancrage:</span>
            <span className="text-slate-200 font-medium px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700">
              {foundationType === 'metallique' ? 'Plot Métallique' :
                foundationType === 'beton' ? 'Plot Béton' :
                  foundationType === 'encastre' ? 'Encastré' : foundationType}
            </span>
            <button
              onClick={onResetMontage}
              className="ml-2 text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
            >
              Modifier
            </button>
          </div>
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
        <div className="w-full md:w-[480px] lg:w-[550px] flex flex-col bg-slate-900 border-r border-slate-800 shadow-2xl z-10 shrink-0">
          <div className="p-5 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
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
              nombreSecteurs={nombreSecteurs}
              setNombreSecteurs={setNombreSecteurs}
              dalleThickness={dalleThickness}
              setDalleThickness={setDalleThickness}
              plotHeight={plotHeight}
              setPlotHeight={setPlotHeight}
              similarityMode={similarityMode}
              setSimilarityMode={setSimilarityMode}
            />

            {activeSectors.map((sector, idx) => {
              const isCollapsed = (idx === 1 && similarityMode === 'all_similar') ||
                (idx === 2 && similarityMode === 'all_similar');
              return (
                <Fragment key={sector.id}>
                  <SectorConfigurator
                    index={idx}
                    sectorData={sector}
                    updateSector={updateSector}
                    config={config}
                    collapsed={isCollapsed}
                  />
                </Fragment>
              );
            })}

            {/* Global Equipment Toggles */}
            <div className="space-y-4">
              <FHEquipmentToggle
                hasFhEquipment={hasFhEquipment}
                setHasFhEquipment={setHasFhEquipment}
                fhDiameter={fhDiameter}
                setFhDiameter={setFhDiameter}
                fhReference={fhReference}
                setFhReference={setFhReference}
                fhQuantity={fhQuantity}
                setFhQuantity={setFhQuantity}
              />
              <RRHEquipmentToggle
                hasRrhEquipment={hasRrhEquipment}
                setHasRrhEquipment={setHasRrhEquipment}
                rrhReference={rrhReference}
                setRrhReference={setRrhReference}
                rrhQuantity={rrhQuantity}
                setRrhQuantity={setRrhQuantity}
              />
              <RRUEquipmentToggle
                hasRruEquipment={hasRruEquipment}
                setHasRruEquipment={setHasRruEquipment}
                rruReference={rruReference}
                setRruReference={setRruReference}
                rruQuantity={rruQuantity}
                setRruQuantity={setRruQuantity}
              />
              <TDEquipmentToggle
                hasTdEquipment={hasTdEquipment}
                setHasTdEquipment={setHasTdEquipment}
                tdType={tdType}
                setTdType={setTdType}
                tdReference={tdReference}
                setTdReference={setTdReference}
                tgbtReference={tgbtReference}
                setTgbtReference={setTgbtReference}
              />
              <GenericEquipmentToggle
                title="Présence équipement GPS"
                enabled={hasGps} setEnabled={setHasGps}
                quantity={gpsQuantity} setQuantity={setGpsQuantity}
                reference={gpsReference} setReference={setGpsReference}
                colorClass="blue"
              />
              <GenericEquipmentToggle
                title="Présence Boitier de lovage"
                enabled={hasBoitierLovage} setEnabled={setHasBoitierLovage}
                quantity={boitierLovageQuantity} setQuantity={setBoitierLovageQuantity}
                reference={boitierLovageReference} setReference={setBoitierLovageReference}
                colorClass="purple"
              />
              <CoffretEquipmentToggle
                hasCoffret={hasCoffret}
                setHasCoffret={setHasCoffret}
                coffretReference={coffretReference}
                setCoffretReference={setCoffretReference}
                coffretOptions={config?.coffret_references || []}
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
            <div className="absolute inset-0 bg-slate-950 overflow-hidden z-0 flex flex-col">
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

              {selectedCoords && (!sectors[0].selectedMontage4G || !sectors[0].selectedMontage5G) && (
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

              {selectedCoords && sectors[0].selectedMontage4G && sectors[0].selectedMontage5G && anyLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-slate-800 rounded-full"></div>
                    <div className="w-20 h-20 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-6 mb-2">Analyse en cours...</h3>
                  <p className="text-sm text-slate-400">Classification du terrain et récupération du profil structurel Eurocode.</p>
                </div>
              )}

              {selectedCoords && sectors[0].selectedMontage4G && sectors[0].selectedMontage5G && !anyLoading && anyError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-rose-400 h-full">
                  <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Erreur de catalogue</h3>
                  <p className="text-sm text-slate-400">{anyError}</p>
                </div>
              )}

              {/* Dashboard Content */}
              {selectedCoords && sectors[0].selectedMontage4G && sectors[0].selectedMontage5G && !anyLoading && !anyError && (
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  {uniqueGroups.map((group) => (
                    <div key={group.hash} className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-lg font-bold text-white">
                          Résultats - Secteur{group.indices.length > 1 ? 's' : ''} {group.indices.map(i => i + 1).join(', ')}
                        </h3>
                        <div className="h-px flex-1 bg-slate-800"></div>
                      </div>

                      {group.sector.lookupResult && (
                        <ResultsPanel
                          lookupResult={group.sector.lookupResult}
                          selectedAddress={selectedAddress}
                          selectedMontage={group.sector.selectedMontage4G === group.sector.selectedMontage5G && group.sector.selectedMontage4G !== 'custom' ? group.sector.selectedMontage4G : 'custom'}
                          isSearching={false}
                          onDownloadPdf={() => handleDownloadPdfWrap(group.sector, group.indices)}
                          pdfGenerating={pdfGenerating}
                          onTriggerCalculation={() => handleTriggerCalculation(group.sector)}
                          isCalculationPending={calculating}
                          matPrincipal={group.sector.matPrincipal}
                          setMatPrincipal={(val) => updateSector(group.indices[0], { matPrincipal: val })}
                          plotMetallique={group.sector.plotMetallique}
                          setPlotMetallique={(val) => updateSector(group.indices[0], { plotMetallique: val })}
                          nombreSecteurs={group.indices.length}
                          brasDeDeport={group.sector.brasDeDeport}
                          setBrasDeDeport={(val) => updateSector(group.indices[0], { brasDeDeport: val })}
                          matSecondaire={group.sector.matSecondaire}
                          setMatSecondaire={(val) => updateSector(group.indices[0], { matSecondaire: val })}
                          equipmentToggles={{
                            fh: hasFhEquipment,
                            rrh: hasRrhEquipment,
                            rru: hasRruEquipment,
                            td: hasTdEquipment,
                            gps: hasGps,
                            boitier_lovage: hasBoitierLovage,
                            coffrets_fibre: hasCoffret,
                            coffrets_hybride: false
                          }}
                          equipmentValues={{
                            fh: { diamètre: `${fhDiameter} mm`, référence: fhReference || 'N/A', quantité: fhQuantity },
                            rrh: { modèle: rrhReference || 'RRH-001', quantité: rrhQuantity },
                            rru: { modèle: rruReference || 'RRU-001', quantité: rruQuantity },
                            td: tdType === 'monophase' 
                                  ? { type: 'TD Monophasé', référence: tdReference || 'N/A', tgbt: tgbtReference || 'N/A' }
                                  : { type: 'TD Tétraphasé', référence: tdReference || 'N/A' },
                            gps: { référence: gpsReference || 'N/A', quantité: gpsQuantity },
                            boitier_lovage: { référence: boitierLovageReference || 'N/A', quantité: boitierLovageQuantity },
                            coffrets_fibre: { référence: coffretReference || 'N/A' },
                            coffrets_hybride: { référence: 'N/A', quantité: 0 }
                          }}
                          ndcPdfUrl={ndcPdfUrl}
                        />
                      )}
                    </div>
                  ))}
                </div>
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
        selectedHeight={sectors[0]?.selectedHeight || 0}
      />

      <DocumentPreviewModal
        previewDoc={previewDoc}
        setPreviewDoc={setPreviewDoc}
      />

      <PhotoPromptModal
        show={showPhotoPrompt}
        onClose={() => {
          setShowPhotoPrompt(false);
          setPendingSectorCalc(null);
        }}
        onConfirm={confirmPhotoAndCalculate}
        isSubmitting={calculating}
      />
    </div>
  );
}
