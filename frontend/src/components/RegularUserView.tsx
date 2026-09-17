import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Layers, Loader2, AlertCircle, Compass, MapPin, Map as MapIcon, User as UserIcon,FileText, AlertTriangle, Eye, Download, CheckCircle2, Settings, RefreshCw } from 'lucide-react';

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
import FHEquipmentToggle, { RRHEquipmentToggle, RRUEquipmentToggle, TDEquipmentToggle, BoitierLovageEquipmentToggle, GPSEquipmentToggle, CoffretEquipmentToggle } from './regular-user/FHEquipmentToggle';
import ResultsPanel from './regular-user/ResultsPanel';
import HeightRequestModal from './regular-user/HeightRequestModal';
import DocumentPreviewModal from './regular-user/DocumentPreviewModal';
import { getTerrainDetails } from './regular-user/PdfGenerator';
import { generateAndDownloadPdf } from './regular-user/PdfGenerator';
import { SectorData, RequestFormData, PreviewDocState, SimilarityMode } from './regular-user/types';

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
  selectedVendor4G: 'Huawei',
  selectedVendor5G: 'Ericsson',
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

const getCatalogueHash = (s: SectorData) => {
  return `${s.selectedHeight}-${s.selectedMontage4G}-${s.selectedMontage5G}`;
};

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

  const [similarityMode, setSimilarityMode] = useState<SimilarityMode>('all_similar');

  // Global Equipment
  const [dalleThickness, setDalleThickness] = useState<number | string>('');
  const [etancheite, setEtancheite] = useState<number | string>('');
  const [plotHeight, setPlotHeight] = useState<number>(0.5);

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
  const [hasBoitierLovage, setHasBoitierLovage] = useState<boolean>(false);
  const [hasGps, setHasGps] = useState<boolean>(false);
  const [boitierLovageReference, setBoitierLovageReference] = useState<string>('');
  const [hasCoffret, setHasCoffret] = useState<boolean>(false);
  const [coffretReference, setCoffretReference] = useState<string>('');

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
  const [clientName, setClientName] = useState<string>('');
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);

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

  
  const confirmAndCalculate = async (sector: SectorData) => {
    setCalculating(true);
    
    try {
      const payload = {
        schema_version: "1.0",
        site: {
          type: siteType,
          address: selectedAddress?.label || '',
          name: siteName,
          client: clientName,
          client_logo_url: clientLogoUrl,
          ancrage: foundationType,
          latitude: selectedCoords?.latitude,
          longitude: selectedCoords?.longitude
        },
        environment: {
          region: sector.lookupResult?.detected_region || 'N/A',
          terrain_type: sector.lookupResult?.detected_terrain_type ?? 0,
          building_height_m: selectedBuildingHeight,
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
          nombre_secteurs: nombreSecteurs
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
          enabled: hasRrhEquipment,
          items: hasRrhEquipment ? rrhItems.map(item => ({ reference: resolveRrh(item.reference), quantity: item.quantity })) : []
        },
        rru_equipment: {
          enabled: hasRruEquipment,
          items: hasRruEquipment ? rruItems.map(item => ({ reference: resolveRru(item.reference), quantity: item.quantity })) : []
        },
        td_equipment: {
          enabled: hasTdEquipment,
          type: hasTdEquipment ? tdType : null,
          reference: hasTdEquipment ? resolveTd(tdReference) : null,
          tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
        },
        gps: { enabled: hasGps, quantity: 1, reference: hasGps ? gpsReference : null },
        boitier_lovage: { enabled: hasBoitierLovage, quantity: 1, reference: hasBoitierLovage ? boitierLovageReference : null },
        coffrets_fibre: { enabled: hasCoffret, quantity: 1, reference: hasCoffret ? coffretReference : null },
        coffrets_hybride: { enabled: false, quantity: null, reference: null },
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
        const bHeight = selectedBuildingHeight;
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

  const handleDownloadPdf = () => {
    if (!ndcPdfUrl) return;
    const link = document.createElement('a');
    link.href = ndcPdfUrl;
    link.download = `NDC_${siteName.replace(/\\s+/g, '_')}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
               ? (selectedBuildingHeight || eq.building_height || 15)
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
          client_name: clientName,
          address: selectedAddress?.label || selectedAddress?.name || '',
          etancheite: etancheite,
          dalle_thickness_m: dalleThickness ? parseFloat(String(dalleThickness)) / 100 : null,
          environment: {
            terrain_type: activeSectors[0]?.lookupResult?.detected_terrain_type || 'IIIa',
            region: activeSectors[0]?.lookupResult?.detected_region || '1',
            building_height_m: selectedBuildingHeight,
            plot_height_m: 0.6
          },
          structure: {
            mast_height_m: activeSectors[0]?.selectedHeight,
            mat_principal: "CH 88.9x3",
            nombre_secteurs: activeSectors.length
          },
          fh_equipment: {
            enabled: hasFhEquipment,
            diameter_mm: hasFhEquipment ? fhDiameter : null,
            reference: hasFhEquipment ? (config?.fh_references?.find((r: any) => r.id === fhReference)?.reference || null) : null,
            quantity: hasFhEquipment ? fhQuantity : null,
            weight_kg: hasFhEquipment ? (config?.fh_references?.find((r: any) => r.id === fhReference)?.weight || null) : null
          },
          rrh_equipment: {
            enabled: hasRrhEquipment,
            items: hasRrhEquipment ? rrhItems.map(item => ({ reference: item.reference, quantity: item.quantity })) : []
          },
          rru_equipment: {
            enabled: hasRruEquipment,
            items: hasRruEquipment ? rruItems.map(item => ({ reference: item.reference, quantity: item.quantity })) : []
          },
          td_equipment: {
            enabled: hasTdEquipment,
            type: hasTdEquipment ? tdType : null,
            reference: hasTdEquipment ? tdReference : null,
            tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
          },
          gps: { enabled: hasGps, quantity: 1, reference: hasGps ? gpsReference : null },
          boitier_lovage: { enabled: hasBoitierLovage, quantity: 1, reference: hasBoitierLovage ? boitierLovageReference : null },
          coffrets_fibre: { enabled: hasCoffret, quantity: 1, reference: hasCoffret ? coffretReference : null },
          coffrets_hybride: { enabled: false, quantity: null, reference: null }
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
            client: clientName,
            client_logo_url: clientLogoUrl,
            ancrage: foundationType,
            latitude: selectedCoords?.latitude,
            longitude: selectedCoords?.longitude
          },
          environment: {
            region: sector.lookupResult?.detected_region || 'N/A',
            terrain_type: sector.lookupResult?.detected_terrain_type ?? 0,
            building_height_m: selectedBuildingHeight,
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
            nombre_secteurs: groupIndicesCount
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
            enabled: hasRrhEquipment,
            items: hasRrhEquipment ? rrhItems.map(item => ({ reference: item.reference, quantity: item.quantity })) : []
          },
          rru_equipment: {
            enabled: hasRruEquipment,
            items: hasRruEquipment ? rruItems.map(item => ({ reference: item.reference, quantity: item.quantity })) : []
          },
          td_equipment: {
            enabled: hasTdEquipment,
            type: hasTdEquipment ? tdType : null,
            reference: hasTdEquipment ? tdReference : null,
            tgbt_reference: hasTdEquipment && tdType === 'monophase' ? tgbtReference : null
          },
          gps: { enabled: hasGps, quantity: 1, reference: hasGps ? gpsReference : null },
          boitier_lovage: { enabled: hasBoitierLovage, quantity: 1, reference: hasBoitierLovage ? boitierLovageReference : null },
          coffrets_fibre: { enabled: hasCoffret, quantity: 1, reference: hasCoffret ? coffretReference : null },
          coffrets_hybride: { enabled: false, quantity: null, reference: null },
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
        body: JSON.stringify({ job_ids: jobIds, photo_url: siteImageUrl })
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

  return (
    <div className="flex flex-col w-full h-screen bg-slate-950 text-white font-sans overflow-hidden selection:bg-indigo-500/30">
      {isProfileModalOpen && (
        <UserProfileModal
          onClose={() => setIsProfileModalOpen(false)}
          clientLogoUrl={clientLogoUrl}
          onClientLogoUploaded={setClientLogoUrl}
          apiBaseUrl={apiBaseUrl}
        />
      )}
      
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Confirmation de Génération
              </h2>
            </div>
            <div className="p-6 text-slate-300 space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <p className="font-semibold text-white mb-2">Vous avez sélectionné :</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                  <li>Région de Vent : <span className="text-white font-medium">{activeSectors[0]?.lookupResult?.detected_region || '1'}</span></li>
                  <li>Terrain : <span className="text-white font-medium">Type {activeSectors[0]?.lookupResult?.detected_terrain_type || 'IIIa'}</span></li>
                  <li>Épaisseur de la dalle : <span className="text-white font-medium">{dalleThickness || 'Non spécifié'} cm</span></li>
                  <li>Épaisseur de l'étanchéité : <span className="text-white font-medium">{etancheite || 'Non spécifié'} cm</span></li>
                  {activeSectors.map((sector, idx) => (
                    <li key={`std-${idx}`}>
                      Secteur {idx + 1} (Standard) : <span className="text-white font-medium">{getMontageDisplayLabel(sector)}</span>
                    </li>
                  ))}
                  {hasFhEquipment && fhQuantity > 0 && (
                    <li>Équipement FH : <span className="text-white font-medium">{fhQuantity}x {config?.fh_references?.find(r => r.id === fhReference)?.reference || 'Sélectionné'}</span></li>
                  )}
                  {hasRrhEquipment && rrhItems.length > 0 && rrhItems.map((item, idx) => (
                    <li key={`rrh-${idx}`}>Équipement RRH : <span className="text-white font-medium">{item.quantity}x {item.reference}</span></li>
                  ))}
                  {hasRruEquipment && rruItems.length > 0 && rruItems.map((item, idx) => (
                    <li key={`rru-${idx}`}>Équipement RRU : <span className="text-white font-medium">{item.quantity}x {item.reference}</span></li>
                  ))}
                  {hasTdEquipment && (
                    <li>Équipement TD : <span className="text-white font-medium">{config?.td_references?.find(r => r.id === tdReference)?.reference || 'Sélectionné'}</span></li>
                  )}
                  {hasBoitierLovage && (
                    <li>Boîtier de lovage : <span className="text-white font-medium">{config?.boitier_lovage_references?.find((r: any) => r.id === boitierLovageReference)?.reference || 'Sélectionné'}</span></li>
                  )}
                  {hasCoffret && (
                    <li>Coffret : <span className="text-white font-medium">{config?.coffret_references?.find((r: any) => r.id === coffretReference)?.name || 'Sélectionné'}</span></li>
                  )}
                </ul>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <p className="text-sm text-amber-200/90 leading-relaxed">
                  En cliquant sur Valider, vous acceptez que nous n'assumons aucune responsabilité en cas de mauvaise utilisation de cette note de calcul ou de non-respect des hypothèses structurelles.
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-800/20 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={confirmGenerateSiteNdc}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                Confirmer et Générer
              </button>
            </div>
          </div>
        </div>
      )}
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
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-slate-400">{userEmail}</span>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors flex items-center gap-1.5"
            >
              {clientLogoUrl ? (
                <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-600 bg-slate-700 shrink-0">
                  <img
                    src={clientLogoUrl.startsWith('http') || clientLogoUrl.startsWith('data:') ? clientLogoUrl : `${apiBaseUrl}${clientLogoUrl.startsWith('/') ? '' : '/'}${clientLogoUrl}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <UserIcon className="w-4 h-4 text-slate-400" />
              )}
              Profil
            </button>
            <button
              onClick={onLogout}
              className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
            >
              Déconnexion
            </button>
          </div>
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
        <div className="w-full lg:w-[55%] flex flex-col bg-slate-900 border-r border-slate-800 shadow-2xl z-10 shrink-0">
          <div className="p-5 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
            <AddressSearchSection
              onAddressSelect={onAddressSelect}
              selectedAddress={selectedAddress}
              showMap={showMap}
              setShowMap={setShowMap}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <fieldset disabled={isLocked} className={`space-y-6 border-none p-0 m-0 w-full ${isLocked ? "pointer-events-none opacity-60 transition-opacity duration-300" : ""}`}>
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
              clientName={clientName}
              setClientName={setClientName}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FHEquipmentToggle
                hasFhEquipment={hasFhEquipment}
                setHasFhEquipment={setHasFhEquipment}
                fhDiameter={fhDiameter}
                setFhDiameter={setFhDiameter}
                fhReference={fhReference}
                setFhReference={setFhReference}
                fhQuantity={fhQuantity}
                setFhQuantity={setFhQuantity}
                fhOptions={config?.fh_references || []}
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
                tdOptions={config?.td_references || []}
              />
              <RRHEquipmentToggle
                hasRrhEquipment={hasRrhEquipment}
                setHasRrhEquipment={setHasRrhEquipment}
                rrhItems={rrhItems}
                setRrhItems={setRrhItems}
                rrhOptions={config?.rrh_references || []}
              />
              <RRUEquipmentToggle
                hasRruEquipment={hasRruEquipment}
                setHasRruEquipment={setHasRruEquipment}
                rruItems={rruItems}
                setRruItems={setRruItems}
                rruOptions={config?.rru_references || []}
              />
              <BoitierLovageEquipmentToggle
                hasBoitierLovage={hasBoitierLovage} setHasBoitierLovage={setHasBoitierLovage}
                boitierLovageReference={boitierLovageReference} setBoitierLovageReference={setBoitierLovageReference}
              />
              <GPSEquipmentToggle
                hasGps={hasGps} setHasGps={setHasGps}
                gpsReference={gpsReference} setGpsReference={setGpsReference}
              />
              <CoffretEquipmentToggle
                hasCoffret={hasCoffret}
                setHasCoffret={setHasCoffret}
                coffretReference={coffretReference}
                setCoffretReference={setCoffretReference}
                coffretOptions={config?.coffret_references || []}
              />
            </div>
            </fieldset>

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
                    />
                  )}

                  {/* Per-group calculations */}
                  {uniqueGroups.map((group) => (
                    <div key={group.hash} className="relative">
                      {/* Show per-group label only when multiple groups exist */}
                      {uniqueGroups.length > 1 && (
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="text-lg font-bold text-white">
                            Calculs - Secteur{group.indices.length > 1 ? 's' : ''} {group.indices.map(i => i + 1).join(', ')}
                          </h3>
                          <div className="h-px flex-1 bg-slate-800"></div>
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
                          nombreSecteurs={group.indices.length}
                          brasDeDeport={group.sector.brasDeDeport}
                          matSecondaire={group.sector.matSecondaire}
                          hideAnalysisHeader={true}
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
                            fh: { 
                              diamètre: `${fhDiameter} mm`, 
                              référence: config?.fh_references?.find(r => r.id === fhReference)?.reference || 'N/A', 
                              quantité: fhQuantity, 
                              poids: config?.fh_references?.find(r => r.id === fhReference)?.weight ? `${config.fh_references.find(r => r.id === fhReference)?.weight} kg` : 'N/A' 
                            },
                            rrhItems: hasRrhEquipment ? rrhItems.map(item => ({ ...item, reference: resolveRrh(item.reference) })) : null,
                            rruItems: hasRruEquipment ? rruItems.map(item => ({ ...item, reference: resolveRru(item.reference) })) : null,
                            td: tdType === 'monophase'
                              ? { type: 'TD Monophasé', référence: resolveTd(tdReference) || 'N/A', tgbt: tgbtReference || 'N/A' }
                              : { type: 'TD Tétraphasé', référence: resolveTd(tdReference) || 'N/A' },
                            gps: { référence: gpsReference || 'N/A' },
                            boitier_lovage: { référence: boitierLovageReference || 'N/A' },
                            coffrets_fibre: { référence: coffretReference || 'N/A' },
                            coffrets_hybride: { référence: 'N/A', quantité: 0 }
                          }}
                          ndcPdfUrl={ndcPdfUrl}
                          siteImageUrl={siteImageUrl}
                          siteName={siteName}
                          clientName={clientName}
                          clientLogoUrl={clientLogoUrl}
                          ant4gConfig={group.sector.ant4gConfig}
                          ant5gConfig={group.sector.ant5gConfig}
                          buildingHeight={selectedBuildingHeight}
                          mastHeight={group.sector.selectedHeight}
                          plotHeight={plotHeight}
                        />
                      )}
                    </div>
                  ))}
                  
                  {/* Résumé de Configuration & Disclaimer */}
                  {!ndcPdfUrl && uniqueGroups.length > 0 && (
                    <div className="mt-8 bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-slate-700/60 shadow-xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                          <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Confirmation de Génération</h3>
                      </div>
                      
                      <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50 mb-4">
                        <p className="font-semibold text-white mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Vous avez sélectionné :
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-300">
                          <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                            <span className="text-slate-400">Région de Vent</span>
                            <span className="text-white font-medium">{activeSectors[0]?.lookupResult?.detected_region || '1'}</span>
                          </div>

                          <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                            <span className="text-slate-400">Épaisseur de la dalle</span>
                            <span className="text-white font-medium">{dalleThickness || 'Non spécifié'} cm</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                            <span className="text-slate-400">Épaisseur de l'étanchéité</span>
                            <span className="text-white font-medium">{etancheite || 'Non spécifié'} cm</span>
                          </div>
                          
                          {activeSectors.map((sector, idx) => (
                            <div key={`std-${idx}`} className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">Secteur {idx + 1} (Standard)</span>
                              <span className="text-white font-medium">{getMontageDisplayLabel(sector)}</span>
                            </div>
                          ))}
                          
                          {hasFhEquipment && fhQuantity > 0 && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">Équipement FH</span>
                              <span className="text-white font-medium">{fhQuantity}x {config?.fh_references?.find(r => r.id === fhReference)?.reference || 'Sélectionné'}</span>
                            </div>
                          )}
                          
                          {hasRrhEquipment && rrhItems.length > 0 && rrhItems.map((item, idx) => (
                            <div key={`rrh-${idx}`} className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">Équipement RRH</span>
                              <span className="text-white font-medium">{item.quantity}x {resolveRrh(item.reference) || 'Sélectionné'}</span>
                            </div>
                          ))}
                          
                          {hasRruEquipment && rruItems.length > 0 && rruItems.map((item, idx) => (
                            <div key={`rru-${idx}`} className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">Équipement RRU</span>
                              <span className="text-white font-medium">{item.quantity}x {resolveRru(item.reference) || 'Sélectionné'}</span>
                            </div>
                          ))}
                          
                          {hasTdEquipment && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">Équipement TD</span>
                              <span className="text-white font-medium">{resolveTd(tdReference) || 'Sélectionné'}</span>
                            </div>
                          )}
                          
                          {hasBoitierLovage && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">Boîtier de Lovage</span>
                              <span className="text-white font-medium">{boitierLovageReference || 'Sélectionné'}</span>
                            </div>
                          )}
                          
                          {hasGps && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">GPS</span>
                              <span className="text-white font-medium">{gpsReference || 'Sélectionné'}</span>
                            </div>
                          )}
                          
                          {hasCoffret && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/30">
                              <span className="text-slate-400">Coffret</span>
                              <span className="text-white font-medium">{coffretReference || 'Sélectionné'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-4 items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-200/80 leading-relaxed">
                          En cliquant sur Valider, vous acceptez que nous n'assumons aucune responsabilité en cas de mauvaise utilisation de cette note de calcul ou de non-respect des hypothèses structurelles.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* GENERATE GLOBAL NDC BUTTON */}
                  <div className="mt-8 pt-6 border-t border-slate-800">
                    {!ndcPdfUrl ? (
                      <div className="flex flex-col gap-4">
                        <button
                          onClick={handleGenerateSiteNdc}
                          disabled={isGeneratingSiteNdc}
                          className={`w-full py-4 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all text-lg ${
                            isFullyStandard() 
                              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' 
                              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                          } ${isGeneratingSiteNdc ? 'opacity-80 scale-[0.98]' : ''}`}
                        >
                          {isGeneratingSiteNdc ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              {siteNdcPollingMsg || 'Génération en cours...'}
                            </>
                          ) : (
                            <>
                              <FileText className="w-5 h-5" />
                              {isFullyStandard() 
                                ? 'Générer la Note de Calcul Standard (Instantané)' 
                                : 'Lancer Calcul Robot (Analyse Requise)'}
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
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative shadow-inner">
                              <div 
                                className={`absolute top-0 bottom-0 left-0 w-1/4 rounded-full ${isFullyStandard() ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600'}`}
                                style={{ animation: 'indeterminateProgress 1.5s ease-in-out infinite' }}
                              ></div>
                            </div>
                            <p className="text-center text-xs text-slate-400 mt-3 animate-pulse font-medium">
                              {isFullyStandard() ? 'Assemblage des documents en cours...' : 'Nos serveurs calculent votre structure, cela peut prendre 1 à 2 minutes...'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex gap-4">
                          {isFullyStandard() ? (
                            <>
                              <button
                                onClick={() => setShowPdfPreview(!showPdfPreview)}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-lg border border-slate-700"
                              >
                                <Eye className="w-5 h-5" />
                                {showPdfPreview ? 'Masquer l\'Aperçu' : 'Aperçu'}
                              </button>
                              <button
                                onClick={handleDownloadPdf}
                                className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all text-lg"
                              >
                                <Download className="w-5 h-5" />
                                Télécharger ({sectors.length} secteur{sectors.length > 1 ? 's' : ''})
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setShowPdfPreview(!showPdfPreview)}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-lg border border-slate-700"
                              >
                                <Eye className="w-5 h-5" />
                                {showPdfPreview ? 'Fermer la Note' : 'Ouvrir la Note'}
                              </button>
                              <button
                                onClick={handleDownloadPdf}
                                className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all text-lg"
                              >
                                <Download className="w-5 h-5" />
                                Télécharger ({sectors.length} secteur{sectors.length > 1 ? 's' : ''})
                              </button>
                            </>
                          )}
                        </div>
                        
                        <div className="flex gap-4 border-t border-slate-800 pt-4 mt-2">
                          <button
                            onClick={() => {
                              setNdcPdfUrl(null);
                              setShowPdfPreview(false);
                              setSiteNdcError(null);
                            }}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-sm border border-slate-700"
                          >
                            <Settings className="w-4 h-4" />
                            Modifier les paramètres
                          </button>
                          <button
                            onClick={() => window.location.reload()}
                            className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-sm border border-rose-500/20"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Nouveau Calcul
                          </button>
                        </div>
                        {showPdfPreview && ndcPdfUrl && (
                          <div className="w-full h-[75vh] min-h-[600px] border border-slate-700 rounded-xl overflow-hidden bg-white mt-4">
                            <iframe
                              src={ndcPdfUrl}
                              className="w-full h-full"
                              title="Aperçu de la Note de Calcul"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {siteNdcError && (
                      <p className="text-rose-400 text-sm text-center mt-3">{siteNdcError}</p>
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
