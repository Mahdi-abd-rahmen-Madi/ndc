import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import {
  Layers, Loader2, AlertCircle, Compass, MapPin, Map as MapIcon, User as UserIcon,
  FileText, AlertTriangle, Eye, CheckCircle2, Settings, RefreshCw,
  Building2, Anchor, Edit3, Sparkles, ArrowRight, ChevronRight, ChevronDown, Pencil,
  Search, Zap, Check, Radio, Activity, X, Server
} from 'lucide-react';

export interface EquipmentItem {
  id: string;
  reference: string;
  quantity: number;
  vendor?: string;
}

import { useCatalogueConfig } from '../hooks/useCatalogueConfig';
import TerrainMap from './TerrainMap';
import type { GeocodingAddress } from '../utils/types';
import maplibregl from 'maplibre-gl';
import { useGeocoding } from '../hooks/useGeocoding';

// Sub-components
import NotificationsDropdown from './regular-user/NotificationsDropdown';
import AddressSearchSection from './regular-user/AddressSearchSection';
import UserInput from './regular-user/UserInput';
import UserProfileModal from './regular-user/UserProfileModal';
import SectorConfigurator from './regular-user/SectorConfigurator';
import FHEquipmentToggle, { RRHEquipmentToggle, RRUEquipmentToggle, TDEquipmentToggle, BoitierLovageEquipmentToggle, GPSEquipmentToggle, CoffretEquipmentToggle, BaieEquipmentToggle, DEFAULT_ORANGE_BAIES, CabEquipmentToggle, AtelierEnergieEquipmentToggle, BCubeEquipmentToggle, ConvertisseurMdeaEquipmentToggle } from './regular-user/EquipmentToggle';
import ResultsPanel from './regular-user/ResultsPanel';
import HeightRequestModal from './regular-user/HeightRequestModal';
import DocumentPreviewModal from './regular-user/DocumentPreviewModal';
import { getTerrainDetails } from './regular-user/PdfGenerator';
import { generateAndDownloadPdf } from './regular-user/PdfGenerator';
import { SectorData, RequestFormData, PreviewDocState, SimilarityMode, SelectedBaieItem } from './regular-user/types';

interface RegularUserViewProps {
  apiBaseUrl: string;
  initialMontage?: string | null;
  initialSiteType?: 'nouveau' | 'existant' | null;
  initialFoundationType?: 'metallique' | 'beton' | 'encastre' | null;
  onResetMontage?: () => void;
  token: string;
  userEmail: string;
  onLogout: () => void;
}

const defaultSectorData = (id: number): SectorData => ({
  id,
  selectedHeight: 3,
  selectedMontage4G: '',
  selectedMontage5G: '',
  configMode: 'agile',
  selectedVendor4G: '',
  selectedVendor5G: '',
  selectedReference4G: '',
  selectedReference5G: '',
  ant4gConfig: { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
  ant5gConfig: { model: '', height: 0, width: 0, thickness: 0, weight: 0 },
  matPrincipal: '',
  plotMetallique: '',
  brasDeDeport: '',
  matSecondaire: '',
  hasFhEquipment: false,
  fhDiameter: 300,
  fhReference: '',
  fhQuantity: 1,
  hasRrhEquipment: false,
  rrhItems: [{ id: crypto.randomUUID(), reference: '', quantity: 1 }],
  hasRruEquipment: false,
  rruItems: [{ id: crypto.randomUUID(), reference: '', quantity: 1 }],
  hasCoffret: false,
  coffretReference: '',
  hasBaie: false,
  baieRadio: false,
  baieEnergie: false,
  baieItems: [],
  hasCab: false,
  cabOne: false,
  cabTwo: false,
  cabThree: false,
  cabSupport: 'plinthes',
  hasAtelierEnergie: false,
  atelierFprb: false,
  atelierFprbQuantity: 1,
  atelierFpbc: false,
  atelierFpbcQuantity: 1,
  hasConvertisseurMdea: false,
  convertisseurMdeaQuantity: 1,
  lookupResult: null,
  loading: false,
  error: null
});

// Helper to generate a hash for a sector's calculation inputs

const getCatalogueHash = (s: SectorData) => {
  return `${s.selectedHeight}-${s.selectedMontage4G}-${s.selectedMontage5G}`;
};


interface AccordionStepProps {
  step: number;
  title: string;
  activeStep: number;
  setActiveStep: (step: number) => void;
  isCompleted: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  summary?: React.ReactNode;
  hideContinue?: boolean;
}

function AccordionStep({ step, title, activeStep, setActiveStep, isCompleted, disabled, children, summary, hideContinue }: AccordionStepProps) {
  const isOpen = activeStep === step;

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-300 mb-4 ${disabled
      ? 'opacity-50 border-slate-200/80 bg-slate-50/50 cursor-not-allowed overflow-hidden'
      : isOpen
        ? 'border-violet-300 shadow-md ring-4 ring-violet-500/5 overflow-visible z-20 relative'
        : 'border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm overflow-hidden'
      }`}>
      <div
        className={`p-4 flex items-center justify-between transition-all ${disabled
          ? 'cursor-not-allowed'
          : isOpen
            ? 'bg-gradient-to-r from-violet-50/70 via-indigo-50/30 to-white border-b border-violet-100 cursor-pointer'
            : 'hover:bg-slate-50/70 cursor-pointer'
          }`}
        onClick={() => {
          if (!disabled) {
            setActiveStep(step);
          }
        }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl font-bold text-xs shrink-0 transition-all ${disabled
            ? 'bg-slate-100 text-slate-400 border border-slate-200'
            : isCompleted && !isOpen
              ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
              : isOpen
                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-300'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
            {isCompleted && !isOpen && !disabled ? <Check className="w-5 h-5 text-emerald-700 stroke-[2.5]" /> : step}
          </div>
          <div className="min-w-0">
            <h3 className={`font-bold text-sm tracking-tight transition-colors ${disabled ? 'text-slate-400' : isOpen ? 'text-slate-900' : 'text-slate-700'
              }`}>
              {title}
            </h3>
            {!isOpen && isCompleted && !disabled && summary && (
              <div className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1 font-medium">
                {summary}
              </div>
            )}
            {!isOpen && disabled && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                Localisation précise (bâtiment ou surface) requise
              </div>
            )}
          </div>
        </div>

        {!isOpen && !disabled && (
          <button
            className="text-xs font-semibold text-slate-600 hover:text-violet-700 px-3 py-1.5 bg-slate-100/80 hover:bg-violet-50 rounded-xl border border-slate-200/80 hover:border-violet-200 transition-all flex items-center gap-1.5 shadow-2xs shrink-0"
            onClick={(e) => { e.stopPropagation(); setActiveStep(step); }}
          >
            <Pencil className="w-3 h-3" />
            Modifier
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-5 animate-fadeIn">
          {children}
          {!hideContinue && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveStep(step + 1)}
                className="group px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-violet-500/20 hover:shadow-violet-500/30 transition-all flex items-center gap-2"
              >
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegularUserView({
  apiBaseUrl,
  initialMontage,
  initialSiteType,
  initialFoundationType,
  onResetMontage,
  token,
  userEmail,
  onLogout
}: RegularUserViewProps) {
  // Config
  const { config, loading: configLoading } = useCatalogueConfig(apiBaseUrl);
  const { reverseGeocode } = useGeocoding();

  // Core State
  const [selectedAddress, setSelectedAddress] = useState<GeocodingAddress | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingGenericAddress, setPendingGenericAddress] = useState<GeocodingAddress | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{ latitude: number; longitude: number; zoom?: number } | null>(null);
  const [selectedBuildingHeight, setSelectedBuildingHeight] = useState<number | string>('');
  const [nombreSecteurs, setNombreSecteurs] = useState<number>(3);

  const siteType = initialSiteType || 'nouveau';
  const foundationType = initialFoundationType || 'metallique';
  const ancrageInfo = initialFoundationType === 'metallique' ? 'Fixation sur plot métallique' :
    initialFoundationType === 'beton' ? 'Fixation sur plot béton' :
      initialFoundationType === 'encastre' ? 'Mât encastré' :
        'Fixation sur plot métallique';

  const [activeStep, setActiveStep] = useState<number>(1);
  const [isInfoConfirmed, setIsInfoConfirmed] = useState<boolean>(false);
  const [sectors, setSectors] = useState<SectorData[]>(
    Array.from({ length: 3 }, (_, i) => defaultSectorData(i))
  );

  const [similarityMode, setSimilarityMode] = useState<SimilarityMode>('all_similar');

  // Global Equipment
  const [dalleThickness, setDalleThickness] = useState<number | string>('');
  const [etancheite, setEtancheite] = useState<number | string>('');
  const [plotHeight, setPlotHeight] = useState<number>(0.5);
  const [hasChauffageAuSol, setHasChauffageAuSol] = useState<boolean>(false);
  const [fausseDalleThickness, setFausseDalleThickness] = useState<number | string>('');
  const [selectedEchelle, setSelectedEchelle] = useState<string>('');

  const [hasFhEquipment, setHasFhEquipment] = useState<boolean>(false);
  const [fhDiameter, setFhDiameter] = useState<number>(300);
  const [fhReference, setFhReference] = useState<string>('');
  const [fhQuantity, setFhQuantity] = useState<number>(1);
  const [hasRrhEquipment, setHasRrhEquipment] = useState<boolean>(false);
  const [hasRruEquipment, setHasRruEquipment] = useState<boolean>(false);
  const [rrhItems, setRrhItems] = useState<EquipmentItem[]>([{ id: crypto.randomUUID(), reference: '', quantity: 1 }]);
  const [rruItems, setRruItems] = useState<EquipmentItem[]>([{ id: crypto.randomUUID(), reference: '', quantity: 1 }]);
  const [hasTdEquipment, setHasTdEquipment] = useState<boolean>(false);
  const [tdType, setTdType] = useState<'tetraphase' | 'monophase'>('tetraphase');
  const [tdReference, setTdReference] = useState<string>('');
  const [tgbtReference, setTgbtReference] = useState<string>('');
  const [gpsReference, setGpsReference] = useState<string>('');
  const [gpsMarque, setGpsMarque] = useState<string>('NOKIA');
  const [hasBoitierLovage, setHasBoitierLovage] = useState<boolean>(false);
  const [hasGps, setHasGps] = useState<boolean>(false);
  const [boitierLovageReference, setBoitierLovageReference] = useState<string>('');
  const [boitierLovageQuantity, setBoitierLovageQuantity] = useState<number>(1);
  const [hasCoffret, setHasCoffret] = useState<boolean>(false);
  const [coffretReference, setCoffretReference] = useState<string>('');
  const [hasBaie, setHasBaie] = useState<boolean>(false);
  const [baieRadio, setBaieRadio] = useState<boolean>(false);
  const [baieEnergie, setBaieEnergie] = useState<boolean>(false);
  const [baieItems, setBaieItems] = useState<SelectedBaieItem[]>([]);
  const [hasCab, setHasCab] = useState<boolean>(false);
  const [cabOne, setCabOne] = useState<boolean>(false);
  const [cabTwo, setCabTwo] = useState<boolean>(false);
  const [cabThree, setCabThree] = useState<boolean>(false);
  const [cabSupport, setCabSupport] = useState<string>('plinthes');
  const [hasAtelierEnergie, setHasAtelierEnergie] = useState<boolean>(false);
  const [atelierFprb, setAtelierFprb] = useState<boolean>(false);
  const [atelierFprbQuantity, setAtelierFprbQuantity] = useState<number>(1);
  const [atelierFpbc, setAtelierFpbc] = useState<boolean>(false);
  const [atelierFpbcQuantity, setAtelierFpbcQuantity] = useState<number>(1);
  const [hasConvertisseurMdea, setHasConvertisseurMdea] = useState<boolean>(false);
  const [convertisseurMdeaQuantity, setConvertisseurMdeaQuantity] = useState<number>(1);
  const [bcubeReference, setBcubeReference] = useState<string>('');

  // Status State
  const [calculating, setCalculating] = useState(false);
  const [ndcPdfUrl, setNdcPdfUrl] = useState<string | null>(null);
  const [showPdfPreview, setShowPdfPreview] = useState<boolean>(false);

  // Photo Upload State
  const [siteImageUrl, setSiteImageUrl] = useState<string | null>(null);
  const [siteNdcError, setSiteNdcError] = useState<string | null>(null);
  const [isGeneratingSiteNdc, setIsGeneratingSiteNdc] = useState(false);
  const [siteNdcPollingMsg, setSiteNdcPollingMsg] = useState('');
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [siteName, setSiteName] = useState<string>('');
  const [codeSite, setCodeSite] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [operator, setOperator] = useState<string>('');
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState<boolean>(false);
  const confirmationScrollRef = useRef<HTMLDivElement>(null);

  // Monitor confirmation modal open and scroll status
  useEffect(() => {
    if (showConfirmationModal) {
      setHasScrolledToBottom(false);
      // If the content is small enough to not need scrolling, unlock automatically
      const timer = setTimeout(() => {
        const el = confirmationScrollRef.current;
        if (el) {
          if (el.scrollHeight <= el.clientHeight + 15) {
            setHasScrolledToBottom(true);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showConfirmationModal]);

  // Map State (visible by default on startup for intuitive spatial selection)
  const [showMap, setShowMap] = useState<boolean>(true);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<maplibregl.Map | null>(null);

  // Request & Notifications State
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestFormData, setRequestFormData] = useState<RequestFormData>({ name: '', email: '', phone: '', description: '' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);

  // Reset operator-specific equipments when operator changes
  useEffect(() => {
    if (operator === 'bouygues') {
      setHasRrhEquipment(false);
    }
    if (operator !== 'orange') {
      setHasBaie(false);
      setBaieRadio(false);
      setBaieEnergie(false);
      setBaieItems([]);
    }
    if (operator !== 'free') {
      setHasCab(false);
      setCabOne(false);
      setCabTwo(false);
      setCabThree(false);
      setCabSupport('plinthes');
    }
    const defaultRrh = [{
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: operator !== 'bouygues' ? 'NOKIA' : undefined
    }];
    const defaultRru = [{
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: operator === 'free' ? 'NOKIA' : operator === 'orange' ? 'ERICSSON' : undefined
    }];
    setRrhItems(defaultRrh);
    setRruItems(defaultRru);
    setSectors(prev => prev.map(s => ({
      ...s,
      hasRrhEquipment: operator === 'bouygues' ? false : s.hasRrhEquipment,
      hasBaie: operator === 'orange' ? s.hasBaie : false,
      baieRadio: operator === 'orange' ? s.baieRadio : false,
      baieEnergie: operator === 'orange' ? s.baieEnergie : false,
      baieItems: operator === 'orange' ? s.baieItems || [] : [],
      hasCab: operator === 'free' ? s.hasCab : false,
      cabOne: operator === 'free' ? s.cabOne : false,
      cabTwo: operator === 'free' ? s.cabTwo : false,
      cabThree: operator === 'free' ? s.cabThree : false,
      cabSupport: operator === 'free' ? (s.cabSupport || 'plinthes') : 'plinthes',
      hasAtelierEnergie: (operator === 'free' || operator === 'bouygues') ? s.hasAtelierEnergie : false,
      atelierFprb: operator === 'free' ? s.atelierFprb : false,
      atelierFprbQuantity: operator === 'free' ? (s.atelierFprbQuantity || 1) : 1,
      atelierFpbc: operator === 'free' ? s.atelierFpbc : false,
      atelierFpbcQuantity: operator === 'free' ? (s.atelierFpbcQuantity || 1) : 1,
      hasConvertisseurMdea: operator === 'free' ? s.hasConvertisseurMdea : false,
      convertisseurMdeaQuantity: operator === 'free' ? (s.convertisseurMdeaQuantity || 1) : 1,
      bcubeReference: operator === 'bouygues' ? s.bcubeReference : '',
      rrhItems: defaultRrh,
      rruItems: defaultRru
    })));
  }, [operator]);


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

  // Fetch user profile on mount to prefill client logo if available
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('ndc_auth_token');
        if (!token) return;
        const res = await fetch(`${apiBaseUrl}/api/user-profiles/me/`, {
          headers: { 'Authorization': `Token ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.client_logo) {
            setClientLogoUrl(data.client_logo);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    };
    fetchProfile();
  }, [apiBaseUrl]);

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
    } else if (similarityMode === 'none') {
      setSimilarityMode('all_similar');
    }
  }, [nombreSecteurs, similarityMode]);

  const onAddressSelect = (address: GeocodingAddress) => {
    const isGeneric = !address.type || address.type !== 'housenumber';

    if (isGeneric) {
      // User picked a generic location (commune, street, locality)
      setPendingGenericAddress(address);
      setSelectedAddress(null);
      setSelectedCoords(null);
      const zoom = address.type === 'municipality' ? 13 : 15;
      setFlyToLocation({
        latitude: address.latitude,
        longitude: address.longitude,
        zoom
      });
      // Open the map so user can see the area close-up and pick the exact point
      setShowMap(true);
      setActiveStep(1);
    } else {
      // Exact housenumber picked
      setPendingGenericAddress(null);
      setFlyToLocation({
        latitude: address.latitude,
        longitude: address.longitude,
        zoom: 17
      });
      setSelectedAddress(address);
      setSelectedCoords({ latitude: address.latitude, longitude: address.longitude });
      setSectors(prev => prev.map(s => ({ ...s, lookupResult: null })));
      setShowMap(false);
      setActiveStep(2);
    }
  };

  const handleMapLocationSelect = useCallback(async (lat: number, lon: number) => {
    setSelectedCoords({ latitude: lat, longitude: lon });
    setPendingGenericAddress(null);
    setFlyToLocation(null);

    // Keep placeholder while reverse geocoding
    setSelectedAddress({
      label: `${lat}-${lon}`,
      name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      latitude: lat, longitude: lon, city: 'Recherche de l\'adresse...', postcode: '',
      context: '', type: 'housenumber', importance: 0, target_terrain: null
    });
    setSectors(prev => prev.map(s => ({ ...s, lookupResult: null })));
    setShowMap(false);
    setActiveStep(2);

    try {
      const reverseResult = await reverseGeocode(lat, lon);
      if (reverseResult) {
        setSelectedAddress(reverseResult);
      } else {
        setSelectedAddress({
          label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          latitude: lat, longitude: lon, city: 'Emplacement sélectionné', postcode: '',
          context: '', type: 'housenumber', importance: 0, target_terrain: null
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
        let queryHeight = Number(selectedBuildingHeight) || 0;
        if (!precalculatedHeights.includes(queryHeight)) {
          const validHeights = precalculatedHeights.filter(h => h >= queryHeight);
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
    let hash = `${s.selectedHeight}_${s.selectedMontage4G}_${s.selectedMontage5G}_${s.matPrincipal}_${s.matSecondaire}_${s.brasDeDeport}_${s.plotMetallique}`;
    if (s.selectedMontage4G === 'custom' || s.selectedMontage5G === 'custom') {
      hash += `_4G${s.ant4gConfig.height}x${s.ant4gConfig.width}x${s.ant4gConfig.thickness}w${s.ant4gConfig.weight}`;
      hash += `_5G${s.ant5gConfig.height}x${s.ant5gConfig.width}x${s.ant5gConfig.thickness}w${s.ant5gConfig.weight}`;
    }
    if (s.configMode === 'reference') {
      hash += `_ref4G${s.selectedReference4G}_ref5G${s.selectedReference5G}`;
    }
    if (similarityMode === 'all_similar') {
      hash = 'unified_group';
    }
    if (!uniqueGroupsMap.has(hash)) {
      uniqueGroupsMap.set(hash, { hash, indices: [idx], sector: s });
    } else {
      uniqueGroupsMap.get(hash)!.indices.push(idx);
    }
  });
  const uniqueGroups = Array.from(uniqueGroupsMap.values());

  const resolveRru = (id: string) => {
    if (operator === 'free') {
      const rfmModels = [
        { id: 'ARGA', vendor: 'NOKIA', reference: 'ARGA' },
        { id: 'ARDB', vendor: 'NOKIA', reference: 'ARDB' },
        { id: 'ARHA', vendor: 'NOKIA', reference: 'ARHA' },
        { id: 'AREA', vendor: 'NOKIA', reference: 'AREA' },
        { id: 'ARPA', vendor: 'NOKIA', reference: 'ARPA' },
      ];
      const opt = rfmModels.find(r => r.id === id);
      return opt ? `${opt.vendor} ${opt.reference}` : id;
    }
    const opt = config?.rru_references?.find(r => r.id === id);
    return opt ? `${opt.vendor} ${opt.reference}` : id;
  };

  const resolveRrh = (id: string) => {
    const opt = config?.rrh_references?.find(r => r.id === id);
    return opt ? `${opt.vendor} ${opt.reference}` : id;
  };

  const resolveTd = (id: string) => {
    const opt = config?.td_references?.find(r => r.id === id);
    return opt ? `${opt.vendor} ${opt.name} (${opt.reference})` : id;
  };

  const resolveBaieItems = (items: SelectedBaieItem[]) => {
    const options = config?.baie_references && config.baie_references.length > 0
      ? config.baie_references
      : DEFAULT_ORANGE_BAIES;
    return items.map(item => {
      const ref = options.find(o => o.id === item.referenceId);
      return {
        id: item.id,
        referenceId: item.referenceId,
        name: ref?.name || item.referenceId,
        reference: ref?.reference || '',
        category: ref?.category || '',
        category_label: ref?.category_label || '',
        dimensions: ref?.dimensions || '',
        weight: ref?.weight ?? null,
        quantity: item.quantity || 1,
        totalWeight: ref?.weight ? ref.weight * (item.quantity || 1) : null
      };
    });
  };


  const confirmAndCalculate = async (sector: SectorData) => {
    setCalculating(true);

    try {
      const payload = {
        schema_version: "1.0",
        site: {
          type: siteType,
          address: selectedAddress?.label || '',
          name: siteName,
          code_site: codeSite,
          ref_site: codeSite,
          client: clientName,
          client_logo_url: clientLogoUrl,
          ancrage: foundationType,
          latitude: selectedCoords?.latitude,
          longitude: selectedCoords?.longitude
        },
        environment: {
          region: sector.lookupResult?.detected_region || 'N/A',
          terrain_type: sector.lookupResult?.detected_terrain_type ?? 0,
          building_height_m: Number(selectedBuildingHeight) || 0,
          dalle_thickness_m: dalleThickness === '' ? null : Number(dalleThickness) / 100,
          etancheite: etancheite === '' ? null : Number(etancheite),
          plot_height_m: plotHeight
        },
        structure: {
          hauteur_mat_m: sector.selectedHeight,
          montage_id: (sector.selectedMontage4G === sector.selectedMontage5G && sector.selectedMontage4G !== 'custom') ? sector.selectedMontage4G : 'custom',
          is_custom_montage: sector.selectedMontage4G !== sector.selectedMontage5G || sector.selectedMontage4G === 'custom',
          mat_principal: sector.matPrincipal,
          plot_metallique: sector.plotMetallique,
          bras_de_deport: sector.brasDeDeport,
          mat_secondaire: sector.matSecondaire,
          nombre_secteurs: nombreSecteurs,
          echelle: selectedEchelle
        },
        antenna_4g: {
          model: sector.ant4gConfig.model,
          hauteur_mm: sector.ant4gConfig.height,
          largeur_mm: sector.ant4gConfig.width,
          epaisseur_mm: sector.ant4gConfig.thickness,
          poids_kg: sector.ant4gConfig.weight
        },
        antenna_5g: {
          model: sector.ant5gConfig.model,
          hauteur_mm: sector.ant5gConfig.height,
          largeur_mm: sector.ant5gConfig.width,
          epaisseur_mm: sector.ant5gConfig.thickness,
          poids_kg: sector.ant5gConfig.weight
        },
        fh_equipment: {
          enabled: hasFhEquipment,
          diameter_mm: hasFhEquipment ? fhDiameter : null,
          reference: hasFhEquipment ? (config?.fh_references?.find(r => r.id === fhReference)?.reference || null) : null,
          quantity: hasFhEquipment ? fhQuantity : null,
          weight_kg: hasFhEquipment ? (config?.fh_references?.find(r => r.id === fhReference)?.weight || null) : null
        },
        rrh_equipment: {
          enabled: operator !== 'bouygues' && hasRrhEquipment,
          items: (operator !== 'bouygues' && hasRrhEquipment) ? rrhItems.map(item => ({ reference: resolveRrh(item.reference), quantity: item.quantity * nombreSecteurs })) : []
        },
        rru_equipment: {
          enabled: hasRruEquipment,
          items: hasRruEquipment ? rruItems.map(item => ({ reference: resolveRru(item.reference), quantity: item.quantity * nombreSecteurs })) : []
        },
        td_equipment: {
          enabled: hasTdEquipment,
          type: hasTdEquipment ? tdType : null,
          reference: hasTdEquipment ? resolveTd(tdReference) : null,
          tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
        },
        gps: { enabled: hasGps, quantity: 1, marque: hasGps ? gpsMarque : null, reference: hasGps ? gpsReference : null },
        boitier_lovage: { enabled: hasBoitierLovage, quantity: boitierLovageQuantity, reference: hasBoitierLovage ? boitierLovageReference : null },
        coffrets_fibre: { enabled: hasCoffret, quantity: hasCoffret ? nombreSecteurs : 1, reference: hasCoffret ? coffretReference : null },
        coffrets_hybride: { enabled: false, quantity: null, reference: null },
        baie: {
          enabled: operator === 'orange' && hasBaie,
          items: operator === 'orange' && hasBaie ? resolveBaieItems(baieItems) : [],
          baie_radio: operator === 'orange' && hasBaie && (baieRadio || baieItems.some(i => {
            const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
            return ref?.category === 'radio_trans';
          })),
          baie_energie: operator === 'orange' && hasBaie && (baieEnergie || baieItems.some(i => {
            const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
            return ref?.category === 'energie';
          }))
        },
        cab: {
          enabled: operator === 'free' && hasCab,
          cab_one: operator === 'free' && hasCab && cabOne,
          cab_two: operator === 'free' && hasCab && cabTwo,
          cab_three: operator === 'free' && hasCab && cabThree,
          support: operator === 'free' && hasCab ? cabSupport : null
        },
        atelier_energie: {
          enabled: (operator === 'free' || operator === 'bouygues') && hasAtelierEnergie,
          module_fprb: operator === 'free' && hasAtelierEnergie && atelierFprb,
          module_fprb_quantity: operator === 'free' && hasAtelierEnergie && atelierFprb ? atelierFprbQuantity : 0,
          module_fpbc: operator === 'free' && hasAtelierEnergie && atelierFpbc,
          module_fpbc_quantity: operator === 'free' && hasAtelierEnergie && atelierFpbc ? atelierFpbcQuantity : 0,
          bcube: (operator === 'bouygues' && hasAtelierEnergie) ? bcubeReference : null
        },
        convertisseur_mdea: {
          enabled: operator === 'free' && hasConvertisseurMdea,
          quantite: operator === 'free' && hasConvertisseurMdea ? convertisseurMdeaQuantity : 0,
          dimensions: '338*295*140mm',
          poids: 10
        },
        site_image_url: siteImageUrl
      };

      const res = await fetch(`${apiBaseUrl}/api/calculations/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
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
          body: JSON.stringify({ photo_url: siteImageUrl })
        });

        if (pdfRes.ok) {
          const pdfData = await pdfRes.json();
          setNdcPdfUrl(pdfData.ndc_pdf_url);
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

  // Determine if all sectors match the catalogue perfectly (Fast-Track eligible)
  const isFullyStandard = () => {
    if (uniqueGroups.length === 0) return false;
    for (const group of uniqueGroups) {
      const sector = group.sector;
      if (!sector.lookupResult) return false;
      if (sector.selectedMontage4G === 'custom') return false;
      if (sector.selectedMontage4G !== sector.selectedMontage5G) return false;

      // Check if mast height is standard
      const hFloat = sector.selectedHeight;
      if (typeof hFloat !== 'number' || isNaN(hFloat) || !config?.recommended_mast_heights?.includes(hFloat)) return false;

      // Check if building height is standard (only matters for roof sites)
      if (foundationType === 'metallique') {
        const bHeight = Number(selectedBuildingHeight) || 0;
        if (typeof bHeight !== 'number' || isNaN(bHeight) || !config?.precalculated_building_heights?.includes(bHeight)) return false;
      }

      const eq = sector.lookupResult.equipment[0];
      if (eq) {
        // Extract the correct default materials for this specific terrain
        const details = getTerrainDetails(eq, sector.lookupResult.detected_terrain_type);
        if (sector.matPrincipal && sector.matPrincipal !== details.matPrincipal) return false;
        if (sector.brasDeDeport && sector.brasDeDeport !== details.brasDeDeport) return false;
        if (sector.plotMetallique && sector.plotMetallique !== details.plotMetallique) return false;
        if (sector.matSecondaire && sector.matSecondaire !== details.matSecondaire) return false;
      }

      // Equipements additionnels (FH, RRH, etc.) ne bloquent plus le Fast-Track
      // L'utilisateur joindra leurs notes de calcul manuellement.
    }
    return true;
  };

  const handleGenerateSiteNdc = () => {
    if (!siteName.trim() || !clientName.trim()) {
      setSiteNdcError('Veuillez saisir le nom du site et le nom du client.');
      return;
    }
    if (!siteImageUrl) {
      setSiteNdcError('Veuillez uploader la photo du site.');
      return;
    }
    setShowConfirmationModal(true);
  };

  const confirmGenerateSiteNdc = async () => {
    setShowConfirmationModal(false);
    setIsGeneratingSiteNdc(true);
    setSiteNdcError(null);

    try {
      const token = localStorage.getItem('ndc_auth_token') || '';

      // --- FAST TRACK (INSTANT NDC) ---
      if (isFullyStandard()) {
        setSiteNdcPollingMsg('Génération du document Standard (Instantané)...');

        // Extract the correct catalogue PDF URLs from the terrain details
        const catalogueUrls = [];
        for (const g of uniqueGroups) {
          const eq = g.sector.lookupResult?.equipment[0];
          if (eq) {
            const height = foundationType === 'metallique'
              ? (Number(selectedBuildingHeight) || eq.building_height || 15)
              : g.sector.selectedHeight;

            let actualMontage = g.sector.selectedMontage4G;
            if (actualMontage === 'Custom' && eq.sub_elements) {
              actualMontage = eq.sub_elements;
            }

            const params = new URLSearchParams({
              montage: actualMontage,
              terrain_type: g.sector.lookupResult?.detected_terrain_type || 'IIIa',
              region: g.sector.lookupResult?.detected_region || '1',
              height: height.toString(),
              config_mode: g.sector.configMode || 'reference'
            });

            if (eq.item_id) {
              params.append('item_id', eq.item_id);
            }

            const response = await fetch(`${apiBaseUrl}/api/geodata/matching-catalogue-pdf/?${params.toString()}`);
            if (response.ok) {
              const data = await response.json();
              if (data.url) catalogueUrls.push(data.url);
            }
          }
        }

        const payload = {
          fast_track: true,
          catalogue_pdf_urls: catalogueUrls,
          photo_url: siteImageUrl,
          site_name: siteName,
          code_site: codeSite,
          ref_site: codeSite,
          client_name: clientName,
          address: selectedAddress?.label || selectedAddress?.name || '',
          etancheite: etancheite,
          dalle_thickness_m: dalleThickness ? parseFloat(String(dalleThickness)) / 100 : null,
          environment: {
            terrain_type: activeSectors[0]?.lookupResult?.detected_terrain_type || 'IIIa',
            region: activeSectors[0]?.lookupResult?.detected_region || '1',
            building_height_m: Number(selectedBuildingHeight) || 0,
            plot_height_m: 0.6
          },
          structure: {
            mast_height_m: activeSectors[0]?.selectedHeight,
            mat_principal: "CH 88.9x3",
            nombre_secteurs: activeSectors.length,
            echelle: selectedEchelle
          },
          antenna_4g: {
            model: activeSectors[0]?.ant4gConfig?.model,
            hauteur_mm: activeSectors[0]?.ant4gConfig?.height,
            largeur_mm: activeSectors[0]?.ant4gConfig?.width,
            epaisseur_mm: activeSectors[0]?.ant4gConfig?.thickness,
            poids_kg: activeSectors[0]?.ant4gConfig?.weight
          },
          antenna_5g: {
            model: activeSectors[0]?.ant5gConfig?.model,
            hauteur_mm: activeSectors[0]?.ant5gConfig?.height,
            largeur_mm: activeSectors[0]?.ant5gConfig?.width,
            epaisseur_mm: activeSectors[0]?.ant5gConfig?.thickness,
            poids_kg: activeSectors[0]?.ant5gConfig?.weight
          },
          fh_equipment: {
            enabled: hasFhEquipment,
            diameter_mm: hasFhEquipment ? fhDiameter : null,
            reference: hasFhEquipment ? (config?.fh_references?.find((r: any) => r.id === fhReference)?.reference || null) : null,
            quantity: hasFhEquipment ? fhQuantity : null,
            weight_kg: hasFhEquipment ? (config?.fh_references?.find((r: any) => r.id === fhReference)?.weight || null) : null
          },
          rrh_equipment: {
            enabled: operator !== 'bouygues' && hasRrhEquipment,
            items: (operator !== 'bouygues' && hasRrhEquipment) ? rrhItems.map(item => ({ reference: resolveRrh(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          rru_equipment: {
            enabled: hasRruEquipment,
            items: hasRruEquipment ? rruItems.map(item => ({ reference: resolveRru(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          td_equipment: {
            enabled: hasTdEquipment,
            type: hasTdEquipment ? tdType : null,
            reference: hasTdEquipment ? tdReference : null,
            tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
          },
          gps: { enabled: hasGps, quantity: 1, marque: hasGps ? gpsMarque : null, reference: hasGps ? gpsReference : null },
          boitier_lovage: { enabled: hasBoitierLovage, quantity: boitierLovageQuantity, reference: hasBoitierLovage ? boitierLovageReference : null },
          coffrets_fibre: { enabled: hasCoffret, quantity: hasCoffret ? nombreSecteurs : 1, reference: hasCoffret ? coffretReference : null },
          coffrets_hybride: { enabled: false, quantity: null, reference: null },
          baie: {
            enabled: operator === 'orange' && hasBaie,
            items: operator === 'orange' && hasBaie ? resolveBaieItems(baieItems) : [],
            baie_radio: operator === 'orange' && hasBaie && (baieRadio || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'radio_trans';
            })),
            baie_energie: operator === 'orange' && hasBaie && (baieEnergie || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'energie';
            }))
          },
          cab: {
            enabled: operator === 'free' && hasCab,
            cab_one: operator === 'free' && hasCab && cabOne,
            cab_two: operator === 'free' && hasCab && cabTwo,
            cab_three: operator === 'free' && hasCab && cabThree,
            support: operator === 'free' && hasCab ? cabSupport : null
          },
          atelier_energie: {
            enabled: (operator === 'free' || operator === 'bouygues') && hasAtelierEnergie,
            module_fprb: operator === 'free' && hasAtelierEnergie && atelierFprb,
            module_fprb_quantity: operator === 'free' && hasAtelierEnergie && atelierFprb ? atelierFprbQuantity : 0,
            module_fpbc: operator === 'free' && hasAtelierEnergie && atelierFpbc,
            module_fpbc_quantity: operator === 'free' && hasAtelierEnergie && atelierFpbc ? atelierFpbcQuantity : 0,
            bcube: (operator === 'bouygues' && hasAtelierEnergie) ? bcubeReference : null
          },
          convertisseur_mdea: {
            enabled: operator === 'free' && hasConvertisseurMdea,
            quantite: operator === 'free' && hasConvertisseurMdea ? convertisseurMdeaQuantity : 0,
            dimensions: '338*295*140mm',
            poids: 10
          }
        };

        const res = await fetch(`${apiBaseUrl}/api/calculations/generate_site_ndc/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const mergeData = await res.json();
          if (mergeData.ndc_pdf_url) {
            const fullUrl = mergeData.ndc_pdf_url.startsWith('http')
              ? mergeData.ndc_pdf_url
              : `${window.location.origin}${mergeData.ndc_pdf_url}`;

            setIsGeneratingSiteNdc(false);
            setNdcPdfUrl(fullUrl);
            return; // Done! Bypassed Robot!
          }
        }
        // If Fast-Track fails for some reason, fall through to Robot Calculation
        console.warn("Fast-Track failed, falling back to Robot calculation");
      }

      // --- ROBOT CALCULATION (CUSTOM TRACK) ---
      setSiteNdcPollingMsg('Lancement des calculs Robot pour chaque secteur...');
      const jobIds = [];

      // Create a job for each unique group
      for (let i = 0; i < uniqueGroups.length; i++) {
        const group = uniqueGroups[i];
        const sector = group.sector;
        const groupIndicesCount = group.indices.length;

        const firstEqDetails = sector.lookupResult && sector.lookupResult.equipment.length > 0
          ? getTerrainDetails(sector.lookupResult.equipment[0], sector.lookupResult.detected_terrain_type)
          : null;

        const payload = {
          schema_version: "1.0",
          site: {
            type: siteType,
            address: selectedAddress?.label || '',
            name: siteName,
            code_site: codeSite,
            ref_site: codeSite,
            client: clientName,
            client_logo_url: clientLogoUrl,
            ancrage: foundationType,
            latitude: selectedCoords?.latitude,
            longitude: selectedCoords?.longitude
          },
          environment: {
            region: sector.lookupResult?.detected_region || 'N/A',
            terrain_type: sector.lookupResult?.detected_terrain_type ?? 0,
            building_height_m: Number(selectedBuildingHeight) || 0,
            dalle_thickness_m: dalleThickness === '' ? null : Number(dalleThickness) / 100,
            etancheite: etancheite === '' ? null : Number(etancheite),
            plot_height_m: plotHeight
          },
          structure: {
            hauteur_mat_m: sector.selectedHeight,
            montage_id: (sector.selectedMontage4G === sector.selectedMontage5G && sector.selectedMontage4G !== 'custom') ? sector.selectedMontage4G : 'custom',
            is_custom_montage: sector.selectedMontage4G !== sector.selectedMontage5G || sector.selectedMontage4G === 'custom',
            mat_principal: firstEqDetails?.matPrincipal || sector.matPrincipal || 'TRON 139x6.3',
            plot_metallique: firstEqDetails?.plotMetallique || sector.plotMetallique || 'TCAR 200x5',
            bras_de_deport: firstEqDetails?.brasDeDeport || sector.brasDeDeport || 'TCAR 50x5',
            mat_secondaire: firstEqDetails?.matSecondaire || sector.matSecondaire || 'TRON 76x5',
            material_name: 'S 235',
            plot_section: firstEqDetails?.plotMetallique || sector.plotMetallique || 'TCAR 200x5',
            bras_section: firstEqDetails?.brasDeDeport || sector.brasDeDeport || 'TCAR 50x5',
            mast_5g_section: firstEqDetails?.matSecondaire || sector.matSecondaire || 'TRON 76x5',
            mast_section: firstEqDetails?.matPrincipal || sector.matPrincipal || 'TRON 139x6.3',
            nombre_secteurs: groupIndicesCount,
            echelle: selectedEchelle
          },
          antenna_4g: {
            model: sector.ant4gConfig.model,
            hauteur_mm: sector.ant4gConfig.height,
            largeur_mm: sector.ant4gConfig.width,
            epaisseur_mm: sector.ant4gConfig.thickness,
            poids_kg: sector.ant4gConfig.weight
          },
          antenna_5g: {
            model: sector.ant5gConfig.model,
            hauteur_mm: sector.ant5gConfig.height,
            largeur_mm: sector.ant5gConfig.width,
            epaisseur_mm: sector.ant5gConfig.thickness,
            poids_kg: sector.ant5gConfig.weight
          },
          fh_equipment: {
            enabled: hasFhEquipment,
            diameter_mm: hasFhEquipment ? fhDiameter : null,
            reference: hasFhEquipment ? (config?.fh_references?.find(r => r.id === fhReference)?.reference || null) : null,
            quantity: hasFhEquipment ? fhQuantity : null,
            weight_kg: hasFhEquipment ? (config?.fh_references?.find(r => r.id === fhReference)?.weight || null) : null
          },
          rrh_equipment: {
            enabled: operator !== 'bouygues' && hasRrhEquipment,
            items: (operator !== 'bouygues' && hasRrhEquipment) ? rrhItems.map(item => ({ reference: resolveRrh(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          rru_equipment: {
            enabled: hasRruEquipment,
            items: hasRruEquipment ? rruItems.map(item => ({ reference: resolveRru(item.reference), quantity: item.quantity * nombreSecteurs })) : []
          },
          td_equipment: {
            enabled: hasTdEquipment,
            type: hasTdEquipment ? tdType : null,
            reference: hasTdEquipment ? tdReference : null,
            tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
          },
          gps: { enabled: hasGps, quantity: 1, marque: hasGps ? gpsMarque : null, reference: hasGps ? gpsReference : null },
          boitier_lovage: { enabled: hasBoitierLovage, quantity: boitierLovageQuantity, reference: hasBoitierLovage ? boitierLovageReference : null },
          coffrets_fibre: { enabled: hasCoffret, quantity: hasCoffret ? nombreSecteurs : 1, reference: hasCoffret ? coffretReference : null },
          coffrets_hybride: { enabled: false, quantity: null, reference: null },
          baie: {
            enabled: operator === 'orange' && hasBaie,
            items: operator === 'orange' && hasBaie ? resolveBaieItems(baieItems) : [],
            baie_radio: operator === 'orange' && hasBaie && (baieRadio || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'radio_trans';
            })),
            baie_energie: operator === 'orange' && hasBaie && (baieEnergie || baieItems.some(i => {
              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === i.referenceId);
              return ref?.category === 'energie';
            }))
          },
          cab: {
            enabled: operator === 'free' && hasCab,
            cab_one: operator === 'free' && hasCab && cabOne,
            cab_two: operator === 'free' && hasCab && cabTwo,
            cab_three: operator === 'free' && hasCab && cabThree,
            support: operator === 'free' && hasCab ? cabSupport : null
          },
          atelier_energie: {
            enabled: (operator === 'free' || operator === 'bouygues') && hasAtelierEnergie,
            module_fprb: operator === 'free' && hasAtelierEnergie && atelierFprb,
            module_fprb_quantity: operator === 'free' && hasAtelierEnergie && atelierFprb ? atelierFprbQuantity : 0,
            module_fpbc: operator === 'free' && hasAtelierEnergie && atelierFpbc,
            module_fpbc_quantity: operator === 'free' && hasAtelierEnergie && atelierFpbc ? atelierFpbcQuantity : 0,
            bcube: (operator === 'bouygues' && hasAtelierEnergie) ? bcubeReference : null
          },
          convertisseur_mdea: {
            enabled: operator === 'free' && hasConvertisseurMdea,
            quantite: operator === 'free' && hasConvertisseurMdea ? convertisseurMdeaQuantity : 0,
            dimensions: '338*295*140mm',
            poids: 10
          },
          site_image_url: siteImageUrl
        };

        const res = await fetch(`${apiBaseUrl}/api/calculations/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const calcData = await res.json();
          jobIds.push(calcData.data.id);
        } else {
          const errorText = await res.text();
          console.error(`Erreur création job groupe ${i + 1}:`, errorText);
          throw new Error(`Erreur lors de la création du job pour le groupe ${i + 1}: ${errorText}`);
        }
      }

      setSiteNdcPollingMsg('Attente des résultats Robot...');

      // Poll all jobs until COMPLETED
      for (const jobId of jobIds) {
        let isCompleted = false;
        let attempts = 0;
        while (!isCompleted && attempts < 120) {
          await new Promise(r => setTimeout(r, 2000));
          const pollRes = await fetch(`${apiBaseUrl}/api/calculations/${jobId}/`, {
            headers: { 'Authorization': `Token ${token}` }
          });
          if (pollRes.ok) {
            const jobResult = await pollRes.json();
            if (jobResult.status === 'COMPLETED' || (jobResult.status === 'PENDING' && jobResult.result_data)) {
              isCompleted = true;
            } else if (jobResult.status === 'FAILED' || jobResult.status === 'ERROR') {
              throw new Error("Calcul échoué sur le serveur pour l'un des secteurs.");
            }
          }
          attempts++;
        }
        if (!isCompleted) {
          throw new Error("Délai d'attente dépassé pour les calculs.");
        }
      }

      setSiteNdcPollingMsg('Fusion des documents PDF...');

      // Call the merge endpoint
      const mergeRes = await fetch(`${apiBaseUrl}/api/calculations/generate_site_ndc/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({
          job_ids: jobIds,
          photo_url: siteImageUrl,
          site_name: siteName,
          code_site: codeSite,
          ref_site: codeSite,
          client_name: clientName,
          address: selectedAddress?.label || selectedAddress?.name || ''
        })
      });

      if (!mergeRes.ok) {
        const errorText = await mergeRes.text();
        console.error('Erreur génération globale:', errorText);
        throw new Error(`Erreur lors de la génération du document global: ${errorText}`);
      }

      const mergeData = await mergeRes.json();

      if (mergeData.ndc_pdf_url) {
        const fullUrl = mergeData.ndc_pdf_url.startsWith('http')
          ? mergeData.ndc_pdf_url
          : `${window.location.origin}${mergeData.ndc_pdf_url}`;
        setNdcPdfUrl(fullUrl);
      } else {
        throw new Error('URL de document manquant dans la réponse.');
      }

    } catch (e: any) {
      console.error(e);
      setSiteNdcError(e.message || 'Une erreur est survenue.');
    } finally {
      setIsGeneratingSiteNdc(false);
      setSiteNdcPollingMsg('');
    }
  };

  const getMontageDisplayLabel = (sector: any) => {
    if (sector.configMode === 'agile') {
      if (sector.selectedMontage4G === 'custom') {
        return 'Dimensions Personnalisées';
      }
      if (sector.ant4gConfig) {
        return `${sector.ant4gConfig.height} x ${sector.ant4gConfig.width} x ${sector.ant4gConfig.thickness} mm`;
      }
      return `Dimensions (Montage ${sector.selectedMontage4G})`;
    }

    if (sector.selectedMontage4G?.toLowerCase() === 'custom') {
      return `Montage (${sector.selectedVendor4G || 'Ericsson'})`;
    }
    return `Montage ${sector.selectedMontage4G}`;
  };

  const isLocked = isGeneratingSiteNdc || !!ndcPdfUrl;

  const missingRequirements = [];
  if (!siteName.trim()) missingRequirements.push('Nom du site');
  if (!clientName.trim()) missingRequirements.push('Nom du client');
  if (!siteImageUrl) missingRequirements.push('Photo du site');
  if (selectedBuildingHeight === '') missingRequirements.push('Hauteur bâtiment');
  if (foundationType !== 'encastre') {
    if (dalleThickness === '') missingRequirements.push('Épaisseur dalle');
  }
  if (!selectedEchelle.trim()) missingRequirements.push('Échelle');
  const canGenerate = missingRequirements.length === 0;

  const missingStep3Equipments: string[] = [];
  sectors.slice(0, nombreSecteurs).forEach((sector, idx) => {
    const secLabel = nombreSecteurs > 1 ? ` (Secteur ${idx + 1})` : '';
    const hasFh = sector.hasFhEquipment ?? hasFhEquipment;
    const fhRef = sector.fhReference ?? fhReference;
    if (hasFh && !fhRef) {
      missingStep3Equipments.push(`Référence FH${secLabel}`);
    }

    const hasRrh = sector.hasRrhEquipment ?? hasRrhEquipment;
    const rrhList = sector.rrhItems ?? rrhItems;
    if (operator !== 'bouygues' && hasRrh) {
      if (rrhList.length === 0 || rrhList.some(i => !i.reference || !i.vendor)) {
        missingStep3Equipments.push(`Référence RRH${secLabel}`);
      }
    }

    const hasRru = sector.hasRruEquipment ?? hasRruEquipment;
    const rruList = sector.rruItems ?? rruItems;
    if (hasRru) {
      if (rruList.length === 0 || rruList.some(i => !i.reference || !i.vendor)) {
        missingStep3Equipments.push(`Référence ${operator === 'free' ? 'RF NSN' : 'RRU'}${secLabel}`);
      }
    }

    const hasCoff = sector.hasCoffret ?? hasCoffret;
    const coffRef = sector.coffretReference ?? coffretReference;
    if (hasCoff && !coffRef) {
      missingStep3Equipments.push(`Référence Coffret fibre${secLabel}`);
    }
  });

  const missingStep4Equipments: string[] = [];
  if (hasTdEquipment && !tdReference) {
    missingStep4Equipments.push('Référence TD');
  }
  if (hasGps && !gpsReference) {
    missingStep4Equipments.push('Référence GPS');
  }
  if (hasBoitierLovage && !boitierLovageReference) {
    missingStep4Equipments.push('Référence Boîtier de lovage');
  }
  if (operator === 'bouygues' && hasAtelierEnergie && !bcubeReference) {
    missingStep4Equipments.push('Modèle BCube');
  }

  const isStep1Complete = !!selectedCoords && !pendingGenericAddress;
  const isStep2Complete = canGenerate;
  const isStep3Complete = activeSectors.length > 0 && activeSectors.every(s => Boolean(s.selectedMontage4G) && Boolean(s.selectedMontage5G)) && missingStep3Equipments.length === 0;
  const isStep4Complete = missingStep4Equipments.length === 0;
  const allSectionsFilled = isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete;
  const isConfirmed = isInfoConfirmed && allSectionsFilled;

  return (
    <div className="flex flex-col w-full h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-violet-500/20">
      {isProfileModalOpen && (
        <UserProfileModal
          onClose={() => setIsProfileModalOpen(false)}
          clientLogoUrl={clientLogoUrl}
          onClientLogoUploaded={setClientLogoUrl}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {showConfirmationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-violet-100/80 rounded-xl text-violet-700 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    Confirmation de Génération
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Récapitulatif complet de votre configuration avant lancement du calcul
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div
              ref={confirmationScrollRef}
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollTop + target.clientHeight >= target.scrollHeight - 20) {
                  setHasScrolledToBottom(true);
                }
              }}
              className="p-6 overflow-y-auto space-y-5 text-slate-700 flex-1"
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Vous avez sélectionné :
                </p>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  {nombreSecteurs} secteur{nombreSecteurs > 1 ? 's' : ''} actif{nombreSecteurs > 1 ? 's' : ''}
                </span>
              </div>

              {/* 1. Site & Environnement */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/60">
                  <div className="p-1 bg-blue-50 text-blue-600 rounded-md">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Site & Environnement
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Région de Vent</span>
                    <span className="font-bold text-slate-900">{activeSectors[0]?.lookupResult?.detected_region || '1'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Catégorie Terrain</span>
                    <span className="font-bold text-slate-900">Type {activeSectors[0]?.lookupResult?.detected_terrain_type || 'IIIa'}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Épaisseur Dalle</span>
                    <span className="font-bold text-slate-900">{dalleThickness || 'Non spécifié'} cm</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Épaisseur Étanchéité</span>
                    <span className="font-bold text-slate-900">{etancheite || 'Non spécifié'} cm</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Présence echelle + Palier de repos rabattable + PA</span>
                    <span className="font-bold text-slate-900">{selectedEchelle}</span>
                  </div>
                </div>
              </div>

              {/* 2. Équipements Aériens */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-violet-50 text-violet-600 rounded-md">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Équipements Aériens
                    </h4>
                  </div>
                </div>

                {/* Sectors montage summary */}
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Montages par secteur
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {activeSectors.map((sector, idx) => (
                      <div key={`std-${idx}`} className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Secteur {idx + 1}</span>
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[65%]" title={getMontageDisplayLabel(sector)}>
                          {getMontageDisplayLabel(sector)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Aerial Equipments */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Équipements sur mât additionnels
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* FH */}
                    {hasFhEquipment && fhQuantity > 0 && (
                      <div className="bg-white p-3 rounded-lg border border-slate-200/80 flex flex-col gap-1.5 border-l-[3px] border-l-amber-500">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            Faisceau Hertzien (FH)
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-bold uppercase">
                              1x par site
                            </span>
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {fhQuantity} unité
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex justify-between">
                          <span>Modèle : <strong className="text-slate-800">{config?.fh_references?.find(r => r.id === fhReference)?.reference || 'Sélectionné'}</strong></span>
                          {fhDiameter ? <span>Ø {fhDiameter} mm</span> : null}
                        </div>
                      </div>
                    )}

                    {/* RRU Items */}
                    {hasRruEquipment && rruItems.length > 0 && rruItems.map((item, idx) => {
                      const resolved = resolveRru(item.reference) || item.reference || 'N/A';
                      const totalCount = (item.quantity || 1) * nombreSecteurs;
                      return (
                        <div key={`rru-${idx}`} className="bg-white p-3 rounded-lg border border-slate-200/80 flex flex-col gap-1.5 border-l-[3px] border-l-emerald-500">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              {operator === 'free' ? 'RF NSN' : 'RRU'}
                              <span className="text-[9px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.2 rounded font-bold uppercase">
                                Par secteur
                              </span>
                            </span>
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-800">{item.quantity} / sect.</span>
                              {nombreSecteurs > 1 && (
                                <span className="text-[10px] font-extrabold text-violet-700 ml-1.5">
                                  (Total : {totalCount})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Référence : <strong className="text-slate-800">{resolved}</strong>
                          </div>
                        </div>
                      );
                    })}

                    {/* RRH Items */}
                    {operator !== 'bouygues' && hasRrhEquipment && rrhItems.length > 0 && rrhItems.map((item, idx) => {
                      const resolved = resolveRrh(item.reference) || item.reference || 'N/A';
                      const totalCount = (item.quantity || 1) * nombreSecteurs;
                      return (
                        <div key={`rrh-${idx}`} className="bg-white p-3 rounded-lg border border-slate-200/80 flex flex-col gap-1.5 border-l-[3px] border-l-rose-500">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              RRH
                              <span className="text-[9px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.2 rounded font-bold uppercase">
                                Par secteur
                              </span>
                            </span>
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-800">{item.quantity} / sect.</span>
                              {nombreSecteurs > 1 && (
                                <span className="text-[10px] font-extrabold text-violet-700 ml-1.5">
                                  (Total : {totalCount})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Référence : <strong className="text-slate-800">{resolved}</strong>
                          </div>
                        </div>
                      );
                    })}

                    {/* Coffrets */}
                    {hasCoffret && (
                      <div className="bg-white p-3 rounded-lg border border-slate-200/80 flex flex-col gap-1.5 border-l-[3px] border-l-pink-500">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            Coffret Fibre / Hybride
                            <span className="text-[9px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.2 rounded font-bold uppercase">
                              Par secteur
                            </span>
                          </span>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-800">1 / sect.</span>
                            {nombreSecteurs > 1 && (
                              <span className="text-[10px] font-extrabold text-violet-700 ml-1.5">
                                (Total : {nombreSecteurs})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Modèle : <strong className="text-slate-800">{config?.coffret_references?.find((r: any) => r.id === coffretReference)?.name || coffretReference || 'Sélectionné'}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Zone Technique */}
              {(hasTdEquipment || hasGps || hasBoitierLovage || (operator === 'orange' && hasBaie) || (operator === 'free' && (hasCab || hasAtelierEnergie || hasConvertisseurMdea)) || ((operator === 'free' || operator === 'bouygues') && hasAtelierEnergie)) && (
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/60">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                      <Server className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Zone Technique & Baies
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {hasTdEquipment && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Équipement TD ({tdType === 'monophase' ? 'Monophasé' : 'Tétraphasé'})</span>
                        <span className="text-xs font-bold text-slate-900 block truncate" title={resolveTd(tdReference) || tdReference}>
                          {resolveTd(tdReference) || tdReference || 'Sélectionné'}
                        </span>
                        {tdType === 'monophase' && tgbtReference && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">TGBT : {tgbtReference}</span>
                        )}
                      </div>
                    )}
                    {hasGps && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Antenne GPS</span>
                        <span className="text-xs font-bold text-slate-900 block">
                          {gpsMarque ? `${gpsMarque} ` : ''}{gpsReference || 'Sélectionné'}
                        </span>
                      </div>
                    )}
                    {hasBoitierLovage && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Boîtier de Lovage (Qté: {boitierLovageQuantity})</span>
                        <span className="text-xs font-bold text-slate-900 block truncate" title={config?.boitier_lovage_references?.find((r: any) => r.id === boitierLovageReference)?.reference || boitierLovageReference}>
                          {config?.boitier_lovage_references?.find((r: any) => r.id === boitierLovageReference)?.reference || boitierLovageReference || 'Sélectionné'}
                        </span>
                      </div>
                    )}
                    {operator === 'orange' && hasBaie && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">
                          Zone Technique Orange ({baieItems.length} {baieItems.length > 1 ? 'équipements' : 'équipement'})
                        </span>
                        {baieItems.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {baieItems.map(item => {
                              const ref = (config?.baie_references || DEFAULT_ORANGE_BAIES).find(b => b.id === item.referenceId);
                              return (
                                <span key={item.id} className="inline-flex items-center gap-1 text-[11px] bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 rounded font-medium">
                                  <span>{item.quantity > 1 ? `${item.quantity}x ` : ''}{ref?.name || item.referenceId}</span>
                                  {ref?.weight ? <span className="text-orange-600 font-semibold text-[10px]">({ref.weight * item.quantity}kg)</span> : null}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-900 block">
                            {[baieRadio ? 'Baie radio' : null, baieEnergie ? 'Baie énergie' : null].filter(Boolean).join(', ') || 'Sélectionnée'}
                          </span>
                        )}
                      </div>
                    )}
                    {operator === 'free' && hasCab && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Baie CAB ({cabSupport ? { plinthes: 'Plinthes', support_autostable: 'Support Autostable', support_fimo: 'Support FIMO', support_muraux: 'Supports Muraux' }[cabSupport] || cabSupport : 'Support'})</span>
                        <span className="text-xs font-bold text-slate-900 block">
                          {[cabOne ? 'CAB ONE' : null, cabTwo ? 'CAB TWO' : null, cabThree ? 'CAB THREE' : null].filter(Boolean).join(', ') || 'Sélectionnée'}
                        </span>
                      </div>
                    )}
                    {operator === 'free' && hasAtelierEnergie && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Atelier d'Énergie</span>
                        <span className="text-xs font-bold text-slate-900 block">
                          {[
                            atelierFprb ? (atelierFprbQuantity > 1 ? `${atelierFprbQuantity}x Module FPRB` : "Module FPRB") : null,
                            atelierFpbc ? (atelierFpbcQuantity > 1 ? `${atelierFpbcQuantity}x Module FPBC` : "Module FPBC") : null
                          ].filter(Boolean).join(', ') || 'Sélectionné'}
                        </span>
                      </div>
                    )}
                    {operator === 'free' && hasConvertisseurMdea && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Convertisseur MDEA</span>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            MDEA (10 kg)
                          </span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                            Qté: {convertisseurMdeaQuantity}
                          </span>
                        </div>
                      </div>
                    )}
                    {operator === 'bouygues' && hasAtelierEnergie && (
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">BCube (TD + AE)</span>
                        <span className="text-xs font-bold text-slate-900 block">
                          {config?.atelier_energie_references?.find(r => r.id === bcubeReference)?.name || bcubeReference || 'Sélectionné'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Disclaimer callout */}
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 flex gap-3 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed">
                  En cliquant sur <strong>Confirmer et Générer</strong>, vous acceptez que nous n'assumons aucune responsabilité en cas de mauvaise utilisation de cette note de calcul ou de non-respect des hypothèses structurelles.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
              <div className="flex items-center">
                {!hasScrolledToBottom ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/90 px-3 py-1.5 rounded-lg border border-amber-200">
                    <ChevronDown className="w-3.5 h-3.5 animate-bounce text-amber-600 shrink-0" />
                    <span>Faites défiler le récapitulatif jusqu'en bas pour débloquer la validation</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">Récapitulatif entièrement consulté</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="px-5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors font-semibold text-sm"
                >
                  Annuler
                </button>
                <button
                  disabled={!hasScrolledToBottom}
                  onClick={confirmGenerateSiteNdc}
                  className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${hasScrolledToBottom
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg cursor-pointer active:scale-95'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/60 shadow-none'
                    }`}
                  title={!hasScrolledToBottom ? "Veuillez faire défiler le récapitulatif jusqu'en bas pour confirmer" : undefined}
                >
                  <FileText className="w-4 h-4" />
                  Confirmer et Générer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="h-16 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-5 md:px-8 flex items-center justify-between shrink-0 z-20 sticky top-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/25 ring-1 ring-white/20">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
                NDC Portail <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Client</span>
              </h1>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200/80 mx-1 hidden sm:block"></div>

          <div className="hidden sm:flex items-center gap-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 text-xs">
            {/* Site & Ancrage group with Modifier button */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg shadow-2xs text-slate-700 font-medium border border-slate-200/60">
              <Building2 className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-slate-400 font-normal">Site:</span>
              <span className="font-semibold text-slate-900">{siteType === 'nouveau' ? 'Neuf' : 'Existant'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg shadow-2xs text-slate-700 font-medium border border-slate-200/60">
              <Anchor className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-400 font-normal">Ancrage:</span>
              <span className="font-semibold text-slate-900">
                {foundationType === 'metallique' ? 'Plot Métallique' :
                  foundationType === 'beton' ? 'Plot Béton' :
                    foundationType === 'encastre' ? 'Encastré' : foundationType}
              </span>
            </div>
            {onResetMontage && (
              <button
                onClick={onResetMontage}
                className="flex items-center gap-1 px-2.5 py-1 text-violet-700 hover:text-violet-900 hover:bg-violet-50 rounded-lg transition-colors font-semibold"
                title="Modifier le type de site ou d'ancrage"
              >
                <Edit3 className="w-3 h-3" />
                <span>Modifier</span>
              </button>
            )}

            {/* Opérateur badge (distinct pill, only shown once selected) */}
            {operator ? (
              <>
                <div className="h-4 w-px bg-slate-300 mx-0.5"></div>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg shadow-2xs font-medium border transition-all ${operator === 'orange'
                      ? 'bg-orange-50/80 border-orange-200 text-orange-950'
                      : operator === 'free'
                        ? 'bg-red-50/80 border-red-200 text-red-950'
                        : 'bg-sky-50/80 border-sky-200 text-sky-950'
                    }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${operator === 'orange' ? 'bg-orange-400' : operator === 'free' ? 'bg-red-400' : 'bg-sky-400'
                      }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${operator === 'orange' ? 'bg-orange-500' : operator === 'free' ? 'bg-red-500' : 'bg-sky-500'
                      }`}></span>
                  </span>
                  <span className="text-slate-400 font-normal">Opérateur:</span>
                  <span className="font-bold capitalize">
                    {operator}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">{userEmail}</span>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="text-xs px-2.5 py-1.5 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 font-medium shadow-2xs"
            >
              {clientLogoUrl ? (
                <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-300 bg-white shrink-0">
                  <img
                    src={clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:') ? clientLogoUrl : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
              )}
              Profil
            </button>
            <button
              onClick={onLogout}
              className="text-xs px-2.5 py-1.5 bg-slate-100/80 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 rounded-xl border border-slate-200 transition-all font-medium shadow-2xs"
            >
              Déconnexion
            </button>
          </div>
          <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-semibold border border-emerald-200 shadow-2xs flex items-center gap-1.5 hidden sm:flex">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
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
        <div className="w-full lg:w-1/2 flex flex-col bg-slate-50/70 border-r border-slate-200 shadow-sm z-10 shrink-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-64 custom-scrollbar">
            {/* Stepper Progress Bar */}
            <div className="mb-5 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  Progression du Projet
                </span>
                <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                  Étape {activeStep} sur 4
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { num: 1, label: 'Localisation' },
                  { num: 2, label: 'Projet' },
                  { num: 3, label: 'Aériens' },
                  { num: 4, label: 'Zone Technique' }
                ].map((s) => {
                  const isStepLocked = s.num > 1 && (!selectedCoords || !!pendingGenericAddress);
                  return (
                    <div key={s.num} className="flex flex-col gap-1">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${isStepLocked
                          ? 'bg-slate-200/80 opacity-60'
                          : s.num < activeStep
                            ? 'bg-emerald-500'
                            : s.num === activeStep
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-xs'
                              : 'bg-slate-200'
                          }`}
                      />
                      <span className={`text-[10px] text-center truncate ${isStepLocked
                        ? 'text-slate-300'
                        : s.num === activeStep
                          ? 'font-bold text-violet-700'
                          : s.num < activeStep
                            ? 'font-medium text-emerald-700'
                            : 'text-slate-400'
                        }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`border-none p-0 m-0 w-full ${isLocked ? "pointer-events-none opacity-60 transition-opacity duration-300" : ""}`}>

              <AccordionStep
                step={1}
                title="Localisation"
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                isCompleted={!!selectedAddress && !pendingGenericAddress}
                summary={
                  pendingGenericAddress ? (
                    <span className="flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Précision requise ({pendingGenericAddress.name || pendingGenericAddress.city || pendingGenericAddress.label})
                    </span>
                  ) : selectedAddress ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-violet-600" /> {selectedAddress.label}
                    </span>
                  ) : (
                    "Non renseigné"
                  )
                }
                hideContinue={true}
              >
                <AddressSearchSection
                  onAddressSelect={onAddressSelect}
                  selectedAddress={selectedAddress}
                  pendingGenericAddress={pendingGenericAddress}
                  showMap={showMap}
                  setShowMap={setShowMap}
                />
              </AccordionStep>

              <AccordionStep
                step={2}
                title="Informations du Projet"
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                isCompleted={!!siteName || !!clientName}
                disabled={!selectedCoords || !!pendingGenericAddress}
                summary={`Site: ${siteName || 'N/A'} | Client: ${clientName || 'N/A'}`}
                hideContinue={(foundationType !== 'encastre' && (dalleThickness === '' || Number(dalleThickness) < 12 || Number(dalleThickness) > 35 || etancheite === '')) || !selectedEchelle}
              >
                <UserInput
                  siteType={siteType}
                  foundationType={foundationType}
                  selectedBuildingHeight={selectedBuildingHeight}
                  setSelectedBuildingHeight={setSelectedBuildingHeight}
                  nombreSecteurs={nombreSecteurs}
                  setNombreSecteurs={setNombreSecteurs}
                  dalleThickness={dalleThickness}
                  setDalleThickness={setDalleThickness}
                  etancheite={etancheite}
                  setEtancheite={setEtancheite}
                  plotHeight={plotHeight}
                  setPlotHeight={setPlotHeight}
                  similarityMode={similarityMode}
                  setSimilarityMode={setSimilarityMode}
                  apiBaseUrl={apiBaseUrl}
                  siteImageUrl={siteImageUrl}
                  onSiteImageUploaded={setSiteImageUrl}
                  siteName={siteName}
                  setSiteName={setSiteName}
                  codeSite={codeSite}
                  setCodeSite={setCodeSite}
                  clientName={clientName}
                  setClientName={setClientName}
                  hasChauffageAuSol={hasChauffageAuSol}
                  setHasChauffageAuSol={setHasChauffageAuSol}
                  fausseDalleThickness={fausseDalleThickness}
                  setFausseDalleThickness={setFausseDalleThickness}
                  selectedEchelle={selectedEchelle}
                  setSelectedEchelle={setSelectedEchelle}
                  operator={operator}
                  setOperator={setOperator}
                />
              </AccordionStep>

              <AccordionStep
                step={3}
                title="Aériens"
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                isCompleted={isStep3Complete}
                disabled={!selectedCoords || !!pendingGenericAddress}
                hideContinue={!isStep3Complete}
                summary={
                  isStep3Complete
                    ? [
                      `${nombreSecteurs} secteur(s)`,
                      hasFhEquipment ? 'FH' : null,
                      (operator !== 'bouygues' && hasRrhEquipment) ? 'RRH' : null,
                      hasRruEquipment ? (operator === 'free' ? 'RF NSN' : 'RRU') : null,
                      hasCoffret ? 'Fibre' : null
                    ].filter(Boolean).join(' • ')
                    : undefined
                }
              >
                <div className="space-y-6">
                  {/* Secteurs (Mâts & Antennes 4G / 5G) */}
                  <div className="space-y-6">
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
                            operator={operator}
                          >
                            <div className="mt-4 pt-4 border-t border-slate-200/80">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 bg-gradient-to-br from-violet-500/10 to-indigo-500/20 text-violet-600 rounded-lg border border-violet-200/50 shadow-2xs">
                                    <Radio className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 tracking-tight">Équipements sur mât</h4>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  Sur mât
                                </span>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <FHEquipmentToggle
                                  hasFhEquipment={sector.hasFhEquipment ?? hasFhEquipment}
                                  setHasFhEquipment={(val) => {
                                    updateSector(idx, { hasFhEquipment: val });
                                    if (idx === 0) setHasFhEquipment(val);
                                  }}
                                  fhDiameter={sector.fhDiameter ?? fhDiameter}
                                  setFhDiameter={(val) => {
                                    updateSector(idx, { fhDiameter: val });
                                    if (idx === 0) setFhDiameter(val);
                                  }}
                                  fhReference={sector.fhReference ?? fhReference}
                                  setFhReference={(val) => {
                                    updateSector(idx, { fhReference: val });
                                    if (idx === 0) setFhReference(val);
                                  }}
                                  fhQuantity={sector.fhQuantity ?? fhQuantity}
                                  setFhQuantity={(val) => {
                                    updateSector(idx, { fhQuantity: val });
                                    if (idx === 0) setFhQuantity(val);
                                  }}
                                  fhOptions={config?.fh_references || []}
                                  nombreSecteurs={nombreSecteurs}
                                />
                                {operator !== 'bouygues' && (
                                  <RRHEquipmentToggle
                                    hasRrhEquipment={sector.hasRrhEquipment ?? hasRrhEquipment}
                                    setHasRrhEquipment={(val) => {
                                      updateSector(idx, { hasRrhEquipment: val });
                                      if (idx === 0) setHasRrhEquipment(val);
                                    }}
                                    rrhItems={sector.rrhItems ?? rrhItems}
                                    setRrhItems={(val) => {
                                      const newItems = typeof val === 'function' ? val(sector.rrhItems ?? rrhItems) : val;
                                      updateSector(idx, { rrhItems: newItems });
                                      if (idx === 0) setRrhItems(newItems);
                                    }}
                                    rrhOptions={config?.rrh_references || []}
                                    operator={operator}
                                    nombreSecteurs={nombreSecteurs}
                                  />
                                )}
                                <RRUEquipmentToggle
                                  hasRruEquipment={sector.hasRruEquipment ?? hasRruEquipment}
                                  setHasRruEquipment={(val) => {
                                    updateSector(idx, { hasRruEquipment: val });
                                    if (idx === 0) setHasRruEquipment(val);
                                  }}
                                  rruItems={sector.rruItems ?? rruItems}
                                  setRruItems={(val) => {
                                    const newItems = typeof val === 'function' ? val(sector.rruItems ?? rruItems) : val;
                                    updateSector(idx, { rruItems: newItems });
                                    if (idx === 0) setRruItems(newItems);
                                  }}
                                  rruOptions={config?.rru_references || []}
                                  isRfmMode={operator === 'free'}
                                  operator={operator}
                                  nombreSecteurs={nombreSecteurs}
                                />
                                <CoffretEquipmentToggle
                                  hasCoffret={sector.hasCoffret ?? hasCoffret}
                                  setHasCoffret={(val) => {
                                    updateSector(idx, { hasCoffret: val });
                                    if (idx === 0) setHasCoffret(val);
                                  }}
                                  coffretReference={sector.coffretReference ?? coffretReference}
                                  setCoffretReference={(val) => {
                                    updateSector(idx, { coffretReference: val });
                                    if (idx === 0) setCoffretReference(val);
                                  }}
                                  coffretOptions={config?.coffret_references || []}
                                  operator={operator}
                                  nombreSecteurs={nombreSecteurs}
                                />
                              </div>
                            </div>
                          </SectorConfigurator>
                        </Fragment>
                      );
                    })}
                  </div>

                  {missingStep3Equipments.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 items-start text-amber-800 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Veuillez sélectionner un modèle pour chaque équipement activé avant de continuer :</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-700">
                          {missingStep3Equipments.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionStep>

              <AccordionStep
                step={4}
                title="Zone Technique"
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                isCompleted={hasTdEquipment || hasGps || hasBoitierLovage || (operator === 'orange' && hasBaie) || (operator === 'free' && (hasCab || hasAtelierEnergie || hasConvertisseurMdea)) || ((operator === 'free' || operator === 'bouygues') && hasAtelierEnergie)}
                disabled={!selectedCoords || !!pendingGenericAddress}
                summary={[
                  hasTdEquipment ? 'TD' : null,
                  hasGps ? 'GPS' : null,
                  hasBoitierLovage ? 'Lovage' : null,
                  (operator === 'orange' && hasBaie) ? 'Baie' : null,
                  (operator === 'free' && hasCab) ? 'CAB' : null,
                  (operator === 'free' && hasAtelierEnergie) ? 'Atelier énergie' : null,
                  (operator === 'free' && hasConvertisseurMdea) ? 'Convertisseur MDEA' : null,
                  (operator === 'bouygues' && hasAtelierEnergie) ? 'BCube (TD + AE)' : null
                ].filter(Boolean).join(' • ') || 'Aucun équipement en zone technique'}
                hideContinue={true}
              >
                <div className="space-y-4">


                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TDEquipmentToggle
                      hasTdEquipment={hasTdEquipment}
                      setHasTdEquipment={setHasTdEquipment}
                      tdType={tdType}
                      setTdType={setTdType}
                      tdReference={tdReference}
                      setTdReference={setTdReference}
                      tgbtReference={tgbtReference}
                      setTgbtReference={setTgbtReference}
                      tdOptions={config?.td_references || []}
                      operator={operator}
                    />
                    <GPSEquipmentToggle
                      hasGps={hasGps} setHasGps={setHasGps}
                      gpsReference={gpsReference} setGpsReference={setGpsReference}
                      gpsMarque={gpsMarque} setGpsMarque={setGpsMarque}
                      operator={operator}
                    />
                    <BoitierLovageEquipmentToggle
                      hasBoitierLovage={hasBoitierLovage} setHasBoitierLovage={setHasBoitierLovage}
                      boitierLovageReference={boitierLovageReference} setBoitierLovageReference={setBoitierLovageReference}
                      boitierLovageQuantity={boitierLovageQuantity} setBoitierLovageQuantity={setBoitierLovageQuantity}
                      boitierOptions={config?.boitier_lovage_references || []}
                      operator={operator}
                    />
                    {operator === 'bouygues' && (
                      <BCubeEquipmentToggle
                        hasAtelierEnergie={hasAtelierEnergie}
                        setHasAtelierEnergie={setHasAtelierEnergie}
                        bcubeReference={bcubeReference}
                        setBcubeReference={setBcubeReference}
                        options={config?.atelier_energie_references || []}
                      />
                    )}
                    {operator === 'orange' && (
                      <div className="lg:col-span-2">
                        <BaieEquipmentToggle
                          hasBaie={hasBaie}
                          setHasBaie={setHasBaie}
                          baieItems={baieItems}
                          setBaieItems={setBaieItems}
                          baieOptions={config?.baie_references || DEFAULT_ORANGE_BAIES}
                          baieRadio={baieRadio}
                          setBaieRadio={setBaieRadio}
                          baieEnergie={baieEnergie}
                          setBaieEnergie={setBaieEnergie}
                        />
                      </div>
                    )}
                    {operator === 'free' && (
                      <>
                        <CabEquipmentToggle
                          hasCab={hasCab}
                          setHasCab={setHasCab}
                          cabOne={cabOne}
                          setCabOne={setCabOne}
                          cabTwo={cabTwo}
                          setCabTwo={setCabTwo}
                          cabThree={cabThree}
                          setCabThree={setCabThree}
                          cabSupport={cabSupport}
                          setCabSupport={setCabSupport}
                        />
                        <AtelierEnergieEquipmentToggle
                          hasAtelierEnergie={hasAtelierEnergie}
                          setHasAtelierEnergie={setHasAtelierEnergie}
                          atelierFprb={atelierFprb}
                          setAtelierFprb={setAtelierFprb}
                          atelierFprbQuantity={atelierFprbQuantity}
                          setAtelierFprbQuantity={setAtelierFprbQuantity}
                          atelierFpbc={atelierFpbc}
                          setAtelierFpbc={setAtelierFpbc}
                          atelierFpbcQuantity={atelierFpbcQuantity}
                          setAtelierFpbcQuantity={setAtelierFpbcQuantity}
                        />
                        <ConvertisseurMdeaEquipmentToggle
                          hasConvertisseurMdea={hasConvertisseurMdea}
                          setHasConvertisseurMdea={setHasConvertisseurMdea}
                          convertisseurMdeaQuantity={convertisseurMdeaQuantity}
                          setConvertisseurMdeaQuantity={setConvertisseurMdeaQuantity}
                        />
                      </>
                    )}
                  </div>
                </div>
              </AccordionStep>

            </div>

            {/* Launch Calculation Button after Section 4 */}
            {(activeStep >= 4 || allSectionsFilled) && (
              <div className="mt-4 p-4 sm:p-5 bg-white rounded-2xl border border-violet-200/90 shadow-md shadow-violet-500/5 transition-all animate-fadeIn">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-gradient-to-br from-violet-500/10 to-indigo-500/20 text-violet-600 rounded-xl border border-violet-200/50 shadow-2xs">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">Validation & Calcul</h4>
                      <p className="text-[11px] text-slate-500">
                        {allSectionsFilled
                          ? 'Toutes les sections sont renseignées'
                          : 'Veuillez finaliser les informations obligatoires'}
                      </p>
                    </div>
                  </div>
                  {allSectionsFilled && !ndcPdfUrl && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Prêt pour le calcul
                    </span>
                  )}
                </div>

                {!allSectionsFilled && (
                  <div className="mb-3 px-3 py-2 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center gap-2 text-amber-800 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Complétez les informations requises pour valider.</span>
                  </div>
                )}

                {siteNdcError && canGenerate && (
                  <div className="mb-3 bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2.5 items-center text-rose-800 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <p>{siteNdcError}</p>
                  </div>
                )}

                {ndcPdfUrl ? (
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => setShowPdfPreview(!showPdfPreview)}
                      className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-md shadow-emerald-500/20 transition-all text-sm sm:text-base cursor-pointer"
                    >
                      <Eye className="w-5 h-5" />
                      <span>{showPdfPreview ? 'Fermer la Note de Calcul' : 'Voir la Note de Calcul'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setNdcPdfUrl(null);
                        setShowPdfPreview(false);
                        setSiteNdcError(null);
                      }}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-xs border border-slate-200/80 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Modifier les paramètres</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isConfirmed) {
                        setIsInfoConfirmed(true);
                      } else {
                        handleGenerateSiteNdc();
                      }
                    }}
                    disabled={isGeneratingSiteNdc || !allSectionsFilled}
                    className={`w-full py-3.5 px-6 rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-md transition-all text-sm sm:text-base ${!allSectionsFilled
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : isConfirmed
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer'
                      } ${isGeneratingSiteNdc ? 'opacity-80 scale-[0.99]' : ''}`}
                  >
                    {isGeneratingSiteNdc ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{siteNdcPollingMsg || 'Calcul en cours...'}</span>
                      </>
                    ) : isConfirmed ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Informations confirmées (Lancer le calcul)</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Confirmer les informations</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </button>
                )}

                {isGeneratingSiteNdc && (
                  <div className="w-full mt-3 animate-fadeIn">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                      <div
                        className={`absolute top-0 bottom-0 left-0 w-1/4 rounded-full ${isFullyStandard()
                            ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600'
                            : 'bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600'
                          }`}
                        style={{ animation: 'indeterminateProgress 1.5s ease-in-out infinite' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 lg:w-1/2 bg-gradient-to-br from-slate-50 via-violet-50/20 to-indigo-50/30 relative flex flex-col min-w-0">
          {showMap && (
            <div className="absolute inset-0 z-10 animate-fadeIn flex flex-col">
              {pendingGenericAddress && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-amber-500 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-xl border border-amber-400 max-w-[90%] text-center animate-bounce">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Commune/Zone sélectionnée : <strong>{pendingGenericAddress.label}</strong>. Veuillez cliquer sur la carte pour définir l'emplacement exact du site.
                  </span>
                </div>
              )}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-200/90 text-xs text-slate-700 whitespace-nowrap">
                <MapPin className="w-4 h-4 text-violet-600 animate-bounce shrink-0" />
                <span className="font-semibold">
                  {pendingGenericAddress
                    ? "Cliquez sur la carte pour définir l'emplacement exact du site"
                    : "Cliquez n'importe où sur la carte pour positionner le site"}
                </span>
                {selectedCoords && (
                  <button
                    onClick={() => setShowMap(false)}
                    className="ml-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-semibold transition-colors shadow-2xs"
                  >
                    Fermer la carte
                  </button>
                )}
              </div>
              <TerrainMap
                selectedCoordinates={selectedCoords ? { latitude: selectedCoords.latitude, longitude: selectedCoords.longitude } : null}
                flyToLocation={flyToLocation}
                onMapClick={handleMapLocationSelect}
              />
            </div>
          )}

          {!showMap && (
            <div className="absolute inset-0 overflow-y-auto z-0 flex flex-col justify-between p-3 sm:p-4 lg:p-5 xl:p-6 custom-scrollbar">
              {/* Ambient Background Decorative Glows */}
              <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-violet-400/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

              {!selectedCoords && pendingGenericAddress && (
                <div className="flex-1 flex flex-col justify-center items-center max-w-xl mx-auto w-full py-8 px-6 text-center relative z-10 animate-fadeIn">
                  <div className="w-full bg-white/90 backdrop-blur-md border border-amber-200/80 rounded-3xl p-8 shadow-xl shadow-amber-500/5 text-center relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-500"></div>

                    <div className="relative mx-auto w-16 h-16 mb-5 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
                        <MapPin className="w-8 h-8 animate-bounce" />
                      </div>
                    </div>

                    <h3 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
                      Précision requise : Bâtiment ou surface
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6">
                      Vous avez sélectionné une commune ou zone générique : <br />
                      <strong className="text-slate-900 font-semibold">{pendingGenericAddress.label}</strong>.<br />
                      Pour effectuer le calcul Eurocode 1 et générer la note, vous devez désigner l'emplacement précis (bâtiment, toiture ou parcelle) sur la carte satellite.
                    </p>

                    <button
                      onClick={() => setShowMap(true)}
                      className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all shadow-md shadow-violet-500/25 mx-auto"
                    >
                      <MapIcon className="w-5 h-5" />
                      Choisir sur la carte satellite
                    </button>
                  </div>
                </div>
              )}

              {/* When no coordinates and no generic address are selected, show a subtle prompt bar on top of the map if needed */}
              {!selectedCoords && !pendingGenericAddress && (
                <div className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full py-6 relative z-10 pointer-events-none opacity-0">
                </div>
              )}

              {selectedCoords && (!sectors[0].selectedMontage4G || !sectors[0].selectedMontage5G) && (
                activeStep === 2 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 w-full max-w-2xl mx-auto animate-fadeIn relative z-10">
                    <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 relative overflow-hidden">
                      {/* Top accent gradient bar */}
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600"></div>

                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 shrink-0">
                          <Building2 className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              Étape 2 sur 4
                            </span>
                            <span className="text-xs text-slate-400 font-medium">Informations du Projet</span>
                          </div>
                          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                            Paramètres & Données du Site
                          </h3>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Complétez les informations du site et ses paramètres structurels dans le panneau de gauche pour configurer votre note de calcul.
                      </p>

                      {/* Live summary grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nom du site</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1" title={siteName || 'Non renseigné'}>
                            {siteName || <span className="text-slate-400 italic font-normal">À renseigner</span>}
                          </span>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Client</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1" title={clientName || 'Non renseigné'}>
                            {clientName || <span className="text-slate-400 italic font-normal">À renseigner</span>}
                          </span>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Opérateur</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1">
                            {operator ? operator.toUpperCase() : 'BOUYGUES'}
                          </span>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hauteur Bâtiment</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1">
                            {selectedBuildingHeight !== '' ? `${selectedBuildingHeight} m` : <span className="text-slate-400 italic font-normal">À renseigner</span>}
                          </span>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Épaisseur Dalle</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1">
                            {dalleThickness !== '' ? `${dalleThickness} cm` : <span className="text-slate-400 italic font-normal">À renseigner</span>}
                          </span>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Photo du site</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1">
                            {siteImageUrl ? (
                              <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Chargée
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-normal">À ajouter</span>
                            )}
                          </span>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col col-span-2 sm:col-span-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Présence echelle + Palier de repos rabattable + PA</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1">
                            {selectedEchelle ? selectedEchelle : <span className="text-slate-400 italic font-normal">À renseigner</span>}
                          </span>
                        </div>
                      </div>

                      {/* Status indicator bar */}
                      {isStep2Complete ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-emerald-800">
                          <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span className="text-xs sm:text-sm font-semibold">
                              Informations du projet complètes !
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveStep(3)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                          >
                            <span>Passer aux Aériens</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-3.5 flex items-start sm:items-center gap-3 text-violet-900">
                          <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5 sm:mt-0" />
                          <div className="text-xs sm:text-sm leading-relaxed">
                            <span className="font-semibold text-slate-700">Champs requis restants : </span>
                            <span className="text-violet-700 font-medium">{missingRequirements.join(', ')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : activeStep === 3 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full relative z-10 animate-fadeIn">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-violet-600 mb-6 shadow-md">
                      <Radio className="w-10 h-10 text-violet-600" />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Étape 3 sur 4
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Aériens & Antennes</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">Sélectionnez les Aériens</h3>
                    <p className="text-base text-slate-600 max-w-md leading-relaxed mb-4">
                      Choisissez un gabarit agile ou des références d'antennes 4G et 5G dans le panneau de gauche pour vos secteurs.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
                      <span>{nombreSecteurs} secteur(s) à configurer</span>
                    </div>
                  </div>
                ) : activeStep === 4 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full relative z-10 animate-fadeIn">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-violet-600 mb-6 shadow-md">
                      <Server className="w-10 h-10 text-violet-600" />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Étape 4 sur 4
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Zone Technique</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">Zone Technique</h3>
                    <p className="text-base text-slate-600 max-w-md leading-relaxed">
                      Configurez les équipements techniques (baies, cheminements de câbles, atelier énergie) dans le panneau de gauche.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full relative z-10 animate-fadeIn">
                    <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-violet-600 mb-6 shadow-md">
                      <MapPin className="w-10 h-10 text-violet-600" />
                    </div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Étape 1 sur 4
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Localisation</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">Localisation du Site</h3>
                    <p className="text-base text-slate-600 max-w-md leading-relaxed mb-4">
                      {selectedAddress?.label || "Emplacement géographique sélectionné."}
                    </p>
                  </div>
                )
              )}

              {selectedCoords && sectors[0].selectedMontage4G && sectors[0].selectedMontage5G && anyLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-slate-200 rounded-full"></div>
                    <div className="w-20 h-20 border-4 border-violet-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-6 mb-2">Analyse en cours...</h3>
                  <p className="text-sm text-slate-600">Classification du terrain et récupération du profil structurel Eurocode.</p>
                </div>
              )}

              {selectedCoords && sectors[0].selectedMontage4G && sectors[0].selectedMontage5G && !anyLoading && anyError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-rose-600 h-full">
                  <div className="w-20 h-20 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Erreur de catalogue</h3>
                  <p className="text-sm text-slate-600">{anyError}</p>
                </div>
              )}

              {/* Dashboard Content */}
              {selectedCoords && sectors[0].selectedMontage4G && sectors[0].selectedMontage5G && !anyLoading && !anyError && (
                <div className="flex-1 space-y-6 w-full">

                  {/* Shared Analysis Header — shown once at top */}
                  {uniqueGroups[0]?.sector.lookupResult && (
                    <ResultsPanel
                      lookupResult={uniqueGroups[0].sector.lookupResult}
                      selectedAddress={selectedAddress}
                      selectedMontage={uniqueGroups[0].sector.selectedMontage4G === uniqueGroups[0].sector.selectedMontage5G && uniqueGroups[0].sector.selectedMontage4G !== 'custom' ? uniqueGroups[0].sector.selectedMontage4G : 'custom'}
                      isSearching={false}
                      nombreSecteurs={nombreSecteurs}
                      hideAnalysisHeader={false}
                      headerOnly={true}
                      equipmentToggles={{}}
                      equipmentValues={{}}
                      ndcPdfUrl={null}
                      codeSite={codeSite}
                      showSectorsCount={activeStep >= 2}
                      operator={operator}
                    />
                  )}

                  {/* Per-group calculations */}
                  {activeStep >= 3 && uniqueGroups.map((group) => (
                    <div key={group.hash} className="relative">
                      {/* Show per-group label only when multiple groups exist */}
                      {uniqueGroups.length > 1 && (
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="text-lg font-bold text-slate-900">
                            Calculs - Secteur{group.indices.length > 1 ? 's' : ''} {group.indices.map(i => i + 1).join(', ')}
                          </h3>
                          <div className="h-px flex-1 bg-slate-200"></div>
                        </div>
                      )}

                      {group.sector.lookupResult && (
                        <ResultsPanel
                          lookupResult={group.sector.lookupResult}
                          selectedAddress={selectedAddress}
                          selectedMontage={group.sector.selectedMontage4G === group.sector.selectedMontage5G && group.sector.selectedMontage4G !== 'custom' ? group.sector.selectedMontage4G : 'custom'}
                          isSearching={false}
                          matPrincipal={group.sector.matPrincipal}
                          plotMetallique={group.sector.plotMetallique}
                          nombreSecteurs={nombreSecteurs}
                          brasDeDeport={group.sector.brasDeDeport}
                          matSecondaire={group.sector.matSecondaire}
                          hideAnalysisHeader={true}
                          operator={operator}
                          equipmentToggles={{
                            fh: hasFhEquipment,
                            rrh: operator !== 'bouygues' && hasRrhEquipment,
                            rru: hasRruEquipment,
                            td: hasTdEquipment,
                            gps: hasGps,
                            boitier_lovage: hasBoitierLovage,
                            coffrets_fibre: hasCoffret,
                            coffrets_hybride: false,
                            baie: operator === 'orange' && hasBaie,
                            cab: operator === 'free' && hasCab,
                            atelier_energie: (operator === 'free' || operator === 'bouygues') && hasAtelierEnergie,
                            convertisseur_mdea: operator === 'free' && hasConvertisseurMdea
                          }}
                          equipmentValues={{
                            fh: {
                              diamètre: `${fhDiameter} mm`,
                              référence: config?.fh_references?.find(r => r.id === fhReference)?.reference || 'N/A',
                              quantité: fhQuantity,
                              poids: config?.fh_references?.find(r => r.id === fhReference)?.weight ? `${config.fh_references.find(r => r.id === fhReference)?.weight} kg` : 'N/A'
                            },
                            rrhItems: (operator !== 'bouygues' && hasRrhEquipment) ? rrhItems.map(item => ({ ...item, reference: resolveRrh(item.reference) })) : null,
                            rruItems: hasRruEquipment ? rruItems.map(item => {
                              const rruOpt = config?.rru_references?.find(r => r.id === item.reference || r.reference === item.reference);
                              return {
                                ...item,
                                reference: resolveRru(item.reference),
                                dimensions: rruOpt?.dimensions || '',
                                weight: rruOpt?.weight ?? null
                              };
                            }) : null,
                            td: tdType === 'monophase'
                              ? { type: 'TD Monophasé', référence: resolveTd(tdReference) || 'N/A', tgbt: tgbtReference || 'N/A' }
                              : { type: 'TD Tétraphasé', référence: resolveTd(tdReference) || 'N/A' },
                            gps: { marque: gpsMarque || 'N/A', référence: gpsReference || 'N/A' },
                            boitier_lovage: { référence: boitierLovageReference || 'N/A', quantité: boitierLovageQuantity },
                            coffrets_fibre: { référence: coffretReference || 'N/A' },
                            coffrets_hybride: { référence: 'N/A', quantité: 0 },
                            baie: (operator === 'orange' && hasBaie) ? {
                              baieRadio,
                              baieEnergie,
                              items: resolveBaieItems(baieItems)
                            } : null,
                            cab: (operator === 'free' && hasCab) ? {
                              cabOne,
                              cabTwo,
                              cabThree,
                              support: cabSupport
                            } : null,
                            atelier_energie: (operator === 'free' && hasAtelierEnergie) ? {
                              atelierFprb,
                              atelierFprbQuantity,
                              atelierFpbc,
                              atelierFpbcQuantity
                            } : (operator === 'bouygues' && hasAtelierEnergie) ? {
                              bcube: config?.atelier_energie_references?.find(r => r.id === bcubeReference)
                            } : null,
                            convertisseur_mdea: (operator === 'free' && hasConvertisseurMdea) ? {
                              modèle: 'MDEA',
                              dimensions: '338*295*140mm',
                              poids: `${10 * (convertisseurMdeaQuantity || 1)} kg`,
                              quantité: convertisseurMdeaQuantity || 1
                            } : null
                          }}
                          ndcPdfUrl={ndcPdfUrl}
                          siteImageUrl={siteImageUrl}
                          siteName={siteName}
                          codeSite={codeSite}
                          clientName={clientName}
                          clientLogoUrl={clientLogoUrl}
                          ant4gConfig={group.sector.ant4gConfig}
                          ant5gConfig={group.sector.ant5gConfig}
                          buildingHeight={Number(selectedBuildingHeight) || 0}
                          mastHeight={group.sector.selectedHeight}
                          plotHeight={plotHeight}
                          sectors={group.indices.map(i => activeSectors[i])}
                          showSectorsConfig={activeStep >= 3}
                          showAerialEquipmentConfig={activeStep >= 3}
                          showTechniqueEquipmentConfig={activeStep >= 4}
                        />
                      )}
                    </div>
                  ))}



                  {/* GENERATE GLOBAL NDC / STEP GUIDANCE */}
                  <div className="mt-6 pt-5 border-t border-slate-200">
                    {!ndcPdfUrl ? (
                      !isConfirmed ? (
                        activeStep === 3 ? (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 animate-fadeIn">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100/80 px-2 py-0.5 rounded-full inline-block mb-1">
                                  Étape 3 : Aériens
                                </span>
                                <h4 className="text-sm font-bold text-slate-900">Équipements sur mât</h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Sélectionnez vos équipements ci-contre ou passez à l'étape suivante.
                                </p>
                              </div>
                              <button
                                onClick={() => setActiveStep(4)}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                              >
                                <span>Zone Technique (4)</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : activeStep === 4 ? (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 animate-fadeIn">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full inline-block mb-1">
                                Étape 4 : Zone Technique
                              </span>
                              <h4 className="text-sm font-bold text-slate-900">
                                {allSectionsFilled ? 'Prêt pour confirmation' : 'Configuration de la zone technique'}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {allSectionsFilled
                                  ? 'Cliquez sur « Confirmer les informations » à gauche pour débloquer le calcul.'
                                  : 'Complétez les informations requises à gauche pour valider.'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-slate-500 text-center">
                            Complétez les informations requises à gauche pour valider.
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col gap-3 animate-fadeIn">
                          <button
                            onClick={handleGenerateSiteNdc}
                            disabled={isGeneratingSiteNdc || !canGenerate}
                            className={`w-full py-3.5 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-md transition-all text-base cursor-pointer ${!canGenerate
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                : isFullyStandard()
                                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                                  : 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20'
                              } ${isGeneratingSiteNdc ? 'opacity-80 scale-[0.98]' : ''}`}
                          >
                            {isGeneratingSiteNdc ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>{siteNdcPollingMsg || 'Calcul en cours...'}</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-5 h-5" />
                                <span>Calculer</span>
                              </>
                            )}
                          </button>

                          {isGeneratingSiteNdc && (
                            <div className="w-full mt-2 animate-fadeIn">
                              <style>
                                {`
                                  @keyframes indeterminateProgress {
                                    0% { transform: translateX(-100%); }
                                    100% { transform: translateX(400%); }
                                  }
                                `}
                              </style>
                              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden relative shadow-inner">
                                <div
                                  className={`absolute top-0 bottom-0 left-0 w-1/4 rounded-full ${isFullyStandard() ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600'}`}
                                  style={{ animation: 'indeterminateProgress 1.5s ease-in-out infinite' }}
                                ></div>
                              </div>
                              <p className="text-center text-xs text-slate-500 mt-3 animate-pulse font-medium">
                                {isFullyStandard() ? 'Assemblage des documents en cours...' : 'Nos serveurs calculent votre structure, cela peut prendre 1 à 2 minutes...'}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col gap-4">
                        <button
                          onClick={() => setShowPdfPreview(!showPdfPreview)}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-md shadow-emerald-500/20 transition-all text-lg"
                        >
                          <Eye className="w-5 h-5" />
                          {showPdfPreview ? 'Fermer la Note de Calcul' : 'Ouvrir la Note de Calcul'}
                        </button>

                        <div className="flex gap-4 border-t border-slate-200 pt-4 mt-2">
                          <button
                            onClick={() => {
                              setNdcPdfUrl(null);
                              setShowPdfPreview(false);
                              setSiteNdcError(null);
                            }}
                            className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-sm border border-slate-200 shadow-sm"
                          >
                            <Settings className="w-4 h-4" />
                            Modifier les paramètres
                          </button>
                          <button
                            onClick={() => window.location.reload()}
                            className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-sm border border-rose-200"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Nouveau Calcul
                          </button>
                        </div>
                        {showPdfPreview && ndcPdfUrl && (
                          <div className="w-full h-[75vh] min-h-[600px] border border-slate-200 rounded-xl overflow-hidden bg-white mt-4 shadow-md">
                            <iframe
                              src={ndcPdfUrl}
                              className="w-full h-full"
                              title="Aperçu de la Note de Calcul"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {siteNdcError && canGenerate && (
                      <p className="text-rose-600 text-sm text-center mt-3">{siteNdcError}</p>
                    )}
                  </div>
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
    </div>
  );
}
