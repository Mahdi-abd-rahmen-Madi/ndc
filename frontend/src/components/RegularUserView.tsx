import { useState, useEffect, useRef, useCallback, Fragment, Suspense, lazy } from 'react';
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
const TerrainMap = lazy(() => import('./TerrainMap'));
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
import RightPreviewPanel from './regular-user/RightPreviewPanel';
import HeightRequestModal from './regular-user/HeightRequestModal';
import DocumentPreviewModal from './regular-user/DocumentPreviewModal';
import SiteConfirmationModal from './regular-user/SiteConfirmationModal';
import { AccordionStep } from './regular-user/AccordionStep';
import { PortailHeader } from './regular-user/PortailHeader';
import { calculateStepValidation } from './regular-user/validation';
import { createResolvers } from './regular-user/resolvers';
import { SectorData, RequestFormData, PreviewDocState, SimilarityMode, SelectedBaieItem, ZoneTechniqueData, defaultZoneTechniqueData, ProjectData, defaultProjectData } from './regular-user/types';

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
  const [project, setProject] = useState<ProjectData>(defaultProjectData);
  const {
    siteName,
    clientName,
    codeSite,
    operator,
    siteImageUrl,
    buildingHeight,
    dalleThickness,
    etancheite,
    plotHeight,
    hasChauffageAuSol,
    fausseDalleThickness,
    selectedEchelle,
  } = project;
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
    hasTdEquipment, tdType, tdReference, hasTgbt, tgbtReference,
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
    selectedBuildingHeight: buildingHeight,
    setZoneTechnique
  });

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

  // Photo & Profile State
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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
    selectedBuildingHeight: buildingHeight,
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
    project,
    foundationType,
    sectors,
    nombreSecteurs,
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
                  project={project}
                  onChange={(updates) => setProject(prev => ({ ...prev, ...updates }))}
                  nombreSecteurs={nombreSecteurs}
                  setNombreSecteurs={setNombreSecteurs}
                  similarityMode={similarityMode}
                  setSimilarityMode={setSimilarityMode}
                  siteType={siteType}
                  foundationType={foundationType}
                  apiBaseUrl={apiBaseUrl}
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
                                    <h4 className="text-xs font-bold text-slate-900 tracking-tight">Équipements</h4>
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
                isCompleted={hasTdEquipment || hasGps || hasBoitierLovage || (operator === 'orange' && hasBaie) || (operator === 'free' && (hasCab || hasAtelierEnergie || hasConvertisseurMdea)) || ((operator === 'free' || operator === 'bouygues') && hasAtelierEnergie) || (operator === 'bouygues' && hasTgbt)}
                disabled={!selectedCoords || !!pendingGenericAddress}
                summary={[
                  hasTdEquipment ? 'TD' : null,
                  hasGps ? 'GPS' : null,
                  hasBoitierLovage ? 'Lovage' : null,
                  (operator === 'orange' && hasBaie) ? 'Baie' : null,
                  (operator === 'free' && hasCab) ? 'CAB' : null,
                  (operator === 'free' && hasAtelierEnergie) ? 'Atelier énergie' : null,
                  (operator === 'free' && hasConvertisseurMdea) ? 'Convertisseur MDEA' : null,
                  (operator === 'bouygues' && hasAtelierEnergie) ? 'BCube (TD + AE)' : null,
                  (operator === 'bouygues' && hasTgbt) ? 'TGBT' : null
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
              <Suspense fallback={
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100/80">
                  <Loader2 className="w-8 h-8 text-violet-600 animate-spin mb-2" />
                  <span className="text-xs font-semibold text-slate-600">Chargement de la carte...</span>
                </div>
              }>
                <TerrainMap
                  selectedCoordinates={selectedCoords ? { latitude: selectedCoords.latitude, longitude: selectedCoords.longitude } : null}
                  flyToLocation={flyToLocation}
                  onMapClick={handleMapLocationSelect}
                />
              </Suspense>
            </div>
          )}

          <RightPreviewPanel
            showMap={showMap}
            setShowMap={setShowMap}
            selectedCoords={selectedCoords}
            pendingGenericAddress={pendingGenericAddress}
            selectedAddress={selectedAddress}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            project={project}
            foundationType={foundationType}
            isStep2Complete={isStep2Complete}
            missingRequirements={missingRequirements}
            nombreSecteurs={nombreSecteurs}
            sectors={sectors}
            activeSectors={activeSectors}
            uniqueGroups={uniqueGroups}
            anyLoading={anyLoading}
            anyError={anyError}
            config={config}
            zoneTechnique={zoneTechnique}
            clientLogoUrl={clientLogoUrl}
            isConfirmed={isConfirmed}
            allSectionsFilled={allSectionsFilled}
            canGenerate={canGenerate}
            isGeneratingSiteNdc={isGeneratingSiteNdc}
            siteNdcPollingMsg={siteNdcPollingMsg}
            siteNdcError={siteNdcError}
            setSiteNdcError={setSiteNdcError}
            ndcPdfUrl={ndcPdfUrl}
            setNdcPdfUrl={setNdcPdfUrl}
            showPdfPreview={showPdfPreview}
            setShowPdfPreview={setShowPdfPreview}
            isFullyStandard={isFullyStandard}
            handleGenerateSiteNdc={handleGenerateSiteNdc}
            resolveRrh={resolveRrh}
            resolveRru={resolveRru}
            resolveTd={resolveTd}
            resolveBaieItems={resolveBaieItems}
          />
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
        selectedBuildingHeight={buildingHeight}
        selectedHeight={sectors[0]?.selectedHeight || 0}
      />

      <DocumentPreviewModal
        previewDoc={previewDoc}
        setPreviewDoc={setPreviewDoc}
      />
    </div>
  );
}
