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
import { useGeocoding } from '../hooks/useGeocoding';
import { useSiteNdcGenerator } from '../hooks/useSiteNdcGenerator';
import { useLocationSelection } from '../hooks/useLocationSelection';
import { useSectorManager } from '../hooks/useSectorManager';

// Sub-components
import AddressSearchSection from './regular-user/AddressSearchSection';
import UserInput from './regular-user/UserInput';
import UserProfileModal from './regular-user/UserProfileModal';
import SectorConfigurator from './regular-user/SectorConfigurator';
import SectorEquipmentGrid from './regular-user/SectorEquipmentGrid';
import ZoneTechniqueGrid from './regular-user/ZoneTechniqueGrid';
import ResultsPanel from './regular-user/ResultsPanel';
import HeightRequestModal from './regular-user/HeightRequestModal';
import DocumentPreviewModal from './regular-user/DocumentPreviewModal';
import SiteConfirmationModal from './regular-user/SiteConfirmationModal';
import { AccordionStep } from './regular-user/AccordionStep';
import { PortailHeader } from './regular-user/PortailHeader';
import { calculateStepValidation } from './regular-user/validation';
import { createResolvers } from './regular-user/resolvers';
import { getTerrainDetails } from './regular-user/PdfGenerator';
import { generateAndDownloadPdf } from './regular-user/PdfGenerator';
import { SectorData, RequestFormData, PreviewDocState, SimilarityMode, SelectedBaieItem, ZoneTechniqueData, defaultZoneTechniqueData } from './regular-user/types';

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
  const [selectedBuildingHeight, setSelectedBuildingHeight] = useState<number | string>('');
  const [operator, setOperator] = useState<string>('');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isInfoConfirmed, setIsInfoConfirmed] = useState<boolean>(false);

  const siteType = initialSiteType || 'nouveau';
  const foundationType = initialFoundationType || 'metallique';
  const ancrageInfo = initialFoundationType === 'metallique' ? 'Fixation sur plot métallique' :
    initialFoundationType === 'beton' ? 'Fixation sur plot béton' :
      initialFoundationType === 'encastre' ? 'Mât encastré' :
        'Fixation sur plot métallique';

  const [zoneTechnique, setZoneTechnique] = useState<ZoneTechniqueData>(defaultZoneTechniqueData);
  const {
    hasTdEquipment, tdType, tdReference, tgbtReference,
    hasGps, gpsReference, gpsMarque,
    hasBoitierLovage, boitierLovageReference, boitierLovageQuantity,
    hasAtelierEnergie, bcubeReference,
    hasBaie, baieRadio, baieEnergie, baieItems,
    hasCab, cabOne, cabTwo, cabThree, cabSupport,
    atelierFprb, atelierFprbQuantity, atelierFpbc, atelierFpbcQuantity,
    hasConvertisseurMdea, convertisseurMdeaQuantity
  } = zoneTechnique;

  // Location Selection (geocoding, map picking, coords)
  const {
    selectedAddress,
    setSelectedAddress,
    selectedCoords,
    setSelectedCoords,
    pendingGenericAddress,
    setPendingGenericAddress,
    flyToLocation,
    setFlyToLocation,
    showMap,
    setShowMap,
    onAddressSelect,
    handleMapLocationSelect
  } = useLocationSelection({
    reverseGeocode,
    onGenericLocationChosen: () => setActiveStep(1),
    onLocationChosen: () => {
      setActiveStep(2);
      clearLookupResults();
    }
  });

  // Sector Manager (state, similarity sync, operator sync, catalogue lookups)
  const {
    sectors,
    setSectors,
    nombreSecteurs,
    setNombreSecteurs,
    similarityMode,
    setSimilarityMode,
    updateSector,
    activeSectors,
    uniqueGroups,
    anyLoading,
    anyError,
    clearLookupResults
  } = useSectorManager({
    apiBaseUrl,
    config,
    operator,
    selectedCoords,
    selectedBuildingHeight,
    setZoneTechnique
  });

  // Global Equipment
  const [dalleThickness, setDalleThickness] = useState<number | string>('');
  const [etancheite, setEtancheite] = useState<number | string>('');
  const [plotHeight, setPlotHeight] = useState<number>(0.5);
  const [hasChauffageAuSol, setHasChauffageAuSol] = useState<boolean>(false);
  const [fausseDalleThickness, setFausseDalleThickness] = useState<number | string>('');
  const [selectedEchelle, setSelectedEchelle] = useState<string>('');

  // Mast equipment derived directly from Sector 1 (single source of truth)
  const s1 = sectors[0];
  const hasFhEquipment = !!s1?.hasFhEquipment;
  const fhDiameter = s1?.fhDiameter ?? 300;
  const fhReference = s1?.fhReference ?? '';
  const fhQuantity = s1?.fhQuantity ?? 1;
  const hasRrhEquipment = !!s1?.hasRrhEquipment;
  const rrhItems = s1?.rrhItems ?? [];
  const hasRruEquipment = !!s1?.hasRruEquipment;
  const rruItems = s1?.rruItems ?? [];
  const hasCoffret = !!s1?.hasCoffret;
  const coffretReference = s1?.coffretReference ?? '';

  // Status State
  const [showPdfPreview, setShowPdfPreview] = useState<boolean>(false);

  // Photo Upload State
  const [siteImageUrl, setSiteImageUrl] = useState<string | null>(null);
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [siteName, setSiteName] = useState<string>('');
  const [codeSite, setCodeSite] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);

  // Request & Notifications State
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestFormData, setRequestFormData] = useState<RequestFormData>({ name: '', email: '', phone: '', description: '' });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);

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

  const { resolveRru, resolveRrh, resolveTd, resolveBaieItems } = createResolvers(config, operator);

  const {
    isGeneratingSiteNdc,
    siteNdcPollingMsg,
    siteNdcError,
    setSiteNdcError,
    ndcPdfUrl,
    setNdcPdfUrl,
    isFullyStandard,
    confirmGenerateSiteNdc
  } = useSiteNdcGenerator({
    apiBaseUrl,
    config,
    foundationType,
    selectedBuildingHeight,
    selectedAddress,
    selectedCoords,
    siteName,
    codeSite,
    clientName,
    clientLogoUrl,
    siteImageUrl,
    siteType,
    dalleThickness,
    etancheite,
    plotHeight,
    selectedEchelle,
    activeSectors,
    uniqueGroups,
    nombreSecteurs,
    operator,
    zoneTechnique,
    resolveTd,
    resolveRru,
    resolveRrh,
    resolveBaieItems
  });

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

  const {
    missingRequirements,
    canGenerate,
    missingStep3Equipments,
    isStep1Complete,
    isStep2Complete,
    isStep3Complete,
    isStep4Complete,
    allSectionsFilled,
    isConfirmed
  } = calculateStepValidation({
    siteName,
    clientName,
    siteImageUrl,
    selectedBuildingHeight,
    foundationType,
    dalleThickness,
    etancheite,
    selectedEchelle,
    sectors,
    nombreSecteurs,
    operator,
    zoneTechnique,
    selectedCoords,
    pendingGenericAddress,
    isInfoConfirmed
  });

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

      <SiteConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={() => {
          setShowConfirmationModal(false);
          confirmGenerateSiteNdc();
        }}
        nombreSecteurs={nombreSecteurs}
        activeSectors={activeSectors}
        dalleThickness={dalleThickness}
        etancheite={etancheite}
        selectedEchelle={selectedEchelle}
        zoneTechnique={zoneTechnique}
        operator={operator}
        config={config}
        resolveTd={resolveTd}
        resolveRru={resolveRru}
        resolveRrh={resolveRrh}
        resolveBaieItems={resolveBaieItems}
        getMontageDisplayLabel={getMontageDisplayLabel}
      />
      <PortailHeader
        siteType={siteType}
        foundationType={foundationType}
        operator={operator}
        onResetMontage={onResetMontage}
        userEmail={userEmail}
        clientLogoUrl={clientLogoUrl}
        apiBaseUrl={apiBaseUrl}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onLogout={onLogout}
        notifications={notifications}
        setNotifications={setNotifications}
      />

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

                              <SectorEquipmentGrid
                                sector={sector}
                                sectorIndex={idx}
                                updateSector={updateSector}
                                config={config}
                                operator={operator}
                                nombreSecteurs={nombreSecteurs}
                              />
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


                  <ZoneTechniqueGrid
                    data={zoneTechnique}
                    onChange={(updates) => setZoneTechnique(prev => ({ ...prev, ...updates }))}
                    config={config}
                    operator={operator}
                  />
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

                        {foundationType !== 'encastre' && (
                          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Étanchéité</span>
                            <span className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1">
                              {etancheite !== '' ? `${etancheite} cm` : <span className="text-slate-400 italic font-normal">À renseigner</span>}
                            </span>
                          </div>
                        )}

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
                              marque: config?.fh_references?.find(r => r.id === fhReference)?.vendor || '',
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
