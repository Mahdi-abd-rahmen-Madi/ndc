import React from 'react';
import {
  MapPin, Map as MapIcon, Building2, CheckCircle2, ArrowRight,
  Sparkles, Radio, Server, AlertCircle, Loader2, FileText, Eye, Settings, RefreshCw,
  Camera, Layers, ShieldCheck, Ruler, UserCheck, Hash, Check
} from 'lucide-react';
import ResultsPanel from './ResultsPanel';
import NdcPdfPreviewSection from './NdcPdfPreviewSection';
import WorkerStatusBanner from './WorkerStatusBanner';
import { useWorkerStatus } from '../../hooks/useWorkerStatus';
import {
  buildEquipmentTogglesMap,
  extractSectorAerialState,
  formatFoundationLabel,
} from '../../config/equipmentRegistry';
import type {
  SectorData,
  ZoneTechniqueData,
  ProjectData,
  CatalogueConfig,
  SelectedBaieItem
} from './types';

export interface RightPreviewPanelProps {
  showMap: boolean;
  setShowMap: (show: boolean) => void;
  selectedCoords: { latitude: number; longitude: number } | null;
  pendingGenericAddress: any;
  selectedAddress: any;
  activeStep: number;
  setActiveStep: (step: number) => void;
  project: ProjectData;
  foundationType: string;
  isStep2Complete: boolean;
  isStep3Complete?: boolean;
  missingRequirements: string[];
  missingStep3Equipments?: string[];
  nombreSecteurs: number;
  sectors: SectorData[];
  activeSectors: SectorData[];
  uniqueGroups: Array<{ hash: string; indices: number[]; sector: SectorData }>;
  anyLoading: boolean;
  anyError?: string | null;
  config: CatalogueConfig | null;
  zoneTechnique: ZoneTechniqueData;
  clientLogoUrl: string | null;
  isConfirmed: boolean;
  allSectionsFilled: boolean;
  canGenerate: boolean;
  isGeneratingSiteNdc: boolean;
  siteNdcPollingMsg: string | null;
  siteNdcProgressPercent?: number | null;
  siteNdcError: string | null;
  setSiteNdcError: (err: string | null) => void;
  ndcPdfUrl: string | null;
  setNdcPdfUrl: (url: string | null) => void;
  showPdfPreview: boolean;
  setShowPdfPreview: (show: boolean) => void;
  isFullyStandard: () => boolean;
  handleGenerateSiteNdc: (options?: { forceRecalculate?: boolean }) => void;
  resolveRrh: (id: string) => string;
  resolveRru: (id: string) => string;
  resolveTd: (id: string) => string;
  resolveBaieItems: (items: SelectedBaieItem[]) => any[];
}

function RightPreviewPanel({
  showMap,
  setShowMap,
  selectedCoords,
  pendingGenericAddress,
  selectedAddress,
  activeStep,
  setActiveStep,
  project,
  foundationType,
  isStep2Complete,
  isStep3Complete = false,
  missingRequirements,
  missingStep3Equipments = [],
  nombreSecteurs,
  sectors,
  activeSectors,
  uniqueGroups,
  anyLoading,
  anyError,
  config,
  zoneTechnique,
  clientLogoUrl,
  isConfirmed,
  allSectionsFilled,
  canGenerate,
  isGeneratingSiteNdc,
  siteNdcPollingMsg,
  siteNdcProgressPercent = null,
  siteNdcError,
  setSiteNdcError,
  ndcPdfUrl,
  setNdcPdfUrl,
  showPdfPreview,
  setShowPdfPreview,
  isFullyStandard,
  handleGenerateSiteNdc,
  resolveRrh,
  resolveRru,
  resolveTd,
  resolveBaieItems,
}: RightPreviewPanelProps) {
  const {
    status: workerStatus,
    isLoading: isWorkerStatusLoading,
    isRefreshing: isWorkerStatusRefreshing,
    refresh: refreshWorkerStatus,
  } = useWorkerStatus({
    enabled: !showMap && isConfirmed && !ndcPdfUrl,
  });

  if (showMap) return null;

  const hasRealWorkerProgress =
    (typeof siteNdcProgressPercent === 'number' && siteNdcProgressPercent > 9) ||
    Boolean(
      siteNdcPollingMsg &&
      !siteNdcPollingMsg.includes('Démarrage du calcul Robot') &&
      !siteNdcPollingMsg.includes("Calcul Robot en cours d'exécution") &&
      !siteNdcPollingMsg.includes('Initialisation') &&
      !siteNdcPollingMsg.includes('Préparation')
    );

  const isWaitingInQueue =
    isGeneratingSiteNdc &&
    !isFullyStandard() &&
    workerStatus?.state === 'busy' &&
    !hasRealWorkerProgress;

  const {
    siteName,
    clientName,
    codeSite,
    operator,
    siteImageUrl,
    buildingHeight,
    dalleThickness,
    etancheite,
    plotHeight
  } = project;

  const {
    hasFhEquipment, fhDiameter, fhReference, fhQuantity, fhItems,
    hasRrhEquipment, rrhItems, hasRruEquipment, rruItems,
    hasCoffret, coffretReference, hasBoitierJonction, boitierJonctionQuantity,
  } = extractSectorAerialState(sectors[0]);
  const selectedFhOpt = config?.fh_references?.find(r => r.id === fhReference);

  const {
    hasTdEquipment, tdType, tdReference, hasTgbt, tgbtReference, tgbtEmplacement,
    hasGps, gpsReference, gpsMarque,
    hasBoitierLovage, boitierLovageReference, boitierLovageQuantity,
    hasAtelierEnergie, bcubeReference,
    hasBcubeRadio, bcubeRadioReference,
    hasBaie, baieRadio, baieEnergie, baieItems,
    hasCab, cabOne, cabTwo, cabThree, cabSupport,
    atelierFprb, atelierFprbQuantity, atelierFpbc, atelierFpbcQuantity,
    hasConvertisseurMdea, convertisseurMdeaQuantity,
    hasCoffretTransFo, coffretTransFoQuantity,
    hasPileAmod, amodModules
  } = zoneTechnique;

  const handleEditParameters = () => {
    setNdcPdfUrl(null);
    setShowPdfPreview(false);
    setSiteNdcError(null);
  };

  const handleNewCalculation = () => {
    window.location.reload();
  };

  if (ndcPdfUrl && showPdfPreview) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col overflow-hidden p-3 sm:p-4">
        {/* Ambient Background Decorative Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-violet-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

        <NdcPdfPreviewSection
          ndcPdfUrl={ndcPdfUrl}
          siteName={siteName}
          onShowSummary={() => setShowPdfPreview(false)}
          onEditParameters={handleEditParameters}
          onNewCalculation={handleNewCalculation}
        />
      </div>
    );
  }

  return (
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
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all shadow-md shadow-violet-500/25 mx-auto cursor-pointer"
            >
              <MapIcon className="w-5 h-5" />
              Choisir sur la carte satellite
            </button>
          </div>
        </div>
      )}

      {/* When no coordinates and no generic address are selected */}
      {!selectedCoords && !pendingGenericAddress && (
        <div className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full py-6 relative z-10 pointer-events-none opacity-0">
        </div>
      )}

      {selectedCoords && (!sectors[0].selectedMontage4G || !sectors[0].selectedMontage5G) && (
        activeStep === 2 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-3xl mx-auto animate-fadeIn relative z-10">
            <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 p-6 sm:p-8 relative overflow-hidden">
              {/* Header with completion meter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Étape 2 sur 4
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Fiche Technique</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Données du Site & Bâtiment
                  </h3>
                </div>

                {/* Progress Ring / Percentage */}
                {(() => {
                  const isEncastre = foundationType === 'encastre';
                  const requiredChecks = [
                    !!siteName,
                    !!clientName,
                    !!buildingHeight,
                    ...(isEncastre ? [] : [!!dalleThickness, !!etancheite]),
                    !!siteImageUrl,
                    !!operator
                  ];
                  const totalFields = requiredChecks.length;
                  const filledCount = requiredChecks.filter(Boolean).length;
                  const percentage = Math.round((filledCount / totalFields) * 100);

                  return (
                    <div className="flex items-center gap-3 bg-slate-50 p-2.5 px-4 rounded-2xl border border-slate-200/80 shrink-0 self-start sm:self-auto">
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Complétion</span>
                        <span className="text-sm font-black text-slate-800">{filledCount} / {totalFields} champs</span>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-violet-200 bg-violet-50 flex items-center justify-center text-[11px] font-bold text-violet-700">
                        {percentage}%
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Categorized Tiles Grid */}
              <div className="space-y-4 mb-6">
                {/* Category 1: Identification */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Identification du Projet
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Nom du site */}
                    <div className={`p-3 rounded-xl border transition-all ${siteName
                      ? 'bg-violet-50/40 border-violet-200/80 text-violet-950'
                      : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Nom du site</span>
                        {!siteName && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">Requis</span>}
                      </div>
                      <span className="text-xs sm:text-sm font-bold truncate block mt-1" title={siteName || 'Non renseigné'}>
                        {siteName || <span className="text-slate-400 italic font-normal">À renseigner...</span>}
                      </span>
                    </div>

                    {/* Client */}
                    <div className={`p-3 rounded-xl border transition-all ${clientName
                      ? 'bg-violet-50/40 border-violet-200/80 text-violet-950'
                      : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Client</span>
                        {!clientName && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">Requis</span>}
                      </div>
                      <span className="text-xs sm:text-sm font-bold truncate block mt-1" title={clientName || 'Non renseigné'}>
                        {clientName || <span className="text-slate-400 italic font-normal">À renseigner...</span>}
                      </span>
                    </div>

                    {/* Opérateur */}
                    <div className="p-3 rounded-xl border bg-slate-50/70 border-slate-200/70">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Opérateur</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block mt-1">
                        {operator ? operator.toUpperCase() : 'BOUYGUES'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category 2: Structure & Bâtiment */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Paramètres Techniques & Structure
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Ancrage */}
                    <div className="p-3 rounded-xl border bg-slate-50/70 border-slate-200/70">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Type Ancrage</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block mt-1">
                        {foundationType === 'metallique' ? 'Plot Métallique' : foundationType === 'beton' ? 'Plot Béton' : foundationType === 'dallettes' ? 'Dallettes' : 'Encastré'}
                      </span>
                    </div>

                    {/* Hauteur Bâtiment */}
                    <div className={`p-3 rounded-xl border transition-all ${buildingHeight !== ''
                      ? 'bg-violet-50/40 border-violet-200/80 text-violet-950'
                      : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Hauteur Bât.</span>
                        {buildingHeight === '' && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded">Requis</span>}
                      </div>
                      <span className="text-xs sm:text-sm font-bold truncate block mt-1">
                        {buildingHeight !== '' ? `${buildingHeight} m` : <span className="text-slate-400 italic font-normal">À renseigner...</span>}
                      </span>
                    </div>

                    {/* Épaisseur Dalle */}
                    <div className={`p-3 rounded-xl border transition-all ${dalleThickness !== ''
                      ? 'bg-violet-50/40 border-violet-200/80 text-violet-950'
                      : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Épaisseur Dalle</span>
                        {dalleThickness === '' && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded">Requis</span>}
                      </div>
                      <span className="text-xs sm:text-sm font-bold truncate block mt-1">
                        {dalleThickness !== '' ? `${dalleThickness} cm` : <span className="text-slate-400 italic font-normal">À renseigner...</span>}
                      </span>
                    </div>

                    {/* Étanchéité (si non encastré) */}
                    {foundationType !== 'encastre' ? (
                      <div className={`p-3 rounded-xl border transition-all ${etancheite !== ''
                        ? 'bg-violet-50/40 border-violet-200/80 text-violet-950'
                        : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Étanchéité</span>
                          {etancheite === '' && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded">Requis</span>}
                        </div>
                        <span className="text-xs sm:text-sm font-bold truncate block mt-1">
                          {etancheite !== '' ? `${etancheite} cm` : <span className="text-slate-400 italic font-normal">À renseigner...</span>}
                        </span>
                      </div>
                    ) : null}

                    {/* Photo du site */}
                    <div className={`p-3 rounded-xl border transition-all ${siteImageUrl
                      ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                      : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                      } ${foundationType === 'encastre' ? 'col-span-2' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Photo Site</span>
                        {!siteImageUrl && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded">Requis</span>}
                      </div>
                      <span className="text-xs sm:text-sm font-bold truncate block mt-1">
                        {siteImageUrl ? (
                          <span className="text-emerald-700 font-semibold">Photo enregistrée</span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">À ajouter...</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status indicator bar */}
              {isStep2Complete ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-emerald-900 shadow-sm">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">Informations du projet complètes !</h4>
                    <p className="text-xs text-emerald-700">Tous les paramètres requis pour la note de calcul ont été saisis.</p>
                  </div>
                  <button
                    onClick={() => setActiveStep(3)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 shrink-0 cursor-pointer hover:translate-x-0.5"
                  >
                    <span>Passer aux Aériens</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-950">
                  <div className="font-bold text-amber-900 mb-1.5">Champs requis restants :</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missingRequirements.map((req) => (
                      <span key={req} className="bg-white border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-900 shadow-2xs">
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeStep === 3 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 w-full max-w-3xl mx-auto animate-fadeIn relative z-10">
            <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 p-6 sm:p-8 relative overflow-hidden">
              {/* Header with completion meter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Étape 3 sur 4
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Aériens & Antennes</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Configuration des Aériens
                  </h3>
                </div>

                {/* Progress Ring / Percentage */}
                {(() => {
                  const hasEchelle = Boolean(project.selectedEchelle && project.selectedEchelle.trim());
                  const allSectorsHaveAntennas = activeSectors.length > 0 && activeSectors.every(
                    s => Boolean(s.selectedMontage4G) && Boolean(s.selectedMontage5G)
                  );
                  const totalRequired = 2; // Échelle + Antennes
                  const count = (hasEchelle ? 1 : 0) + (allSectorsHaveAntennas ? 1 : 0);
                  const percentage = Math.round((count / totalRequired) * 100);

                  return (
                    <div className="flex items-center gap-3 bg-slate-50 p-2.5 px-4 rounded-2xl border border-slate-200/80 shrink-0 self-start sm:self-auto">
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Complétion</span>
                        <span className="text-sm font-black text-slate-800">{count} / {totalRequired} requis</span>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-violet-200 bg-violet-50 flex items-center justify-center text-[11px] font-bold text-violet-700">
                        {percentage}%
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Categorized Tiles Grid */}
              <div className="space-y-4 mb-6">
                {/* Requis 1: Échelle */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Équipement d'accès obligatoire (au sol)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className={`p-3.5 rounded-xl border transition-all ${project.selectedEchelle && project.selectedEchelle.trim()
                      ? 'bg-violet-50/40 border-violet-200/80 text-violet-950'
                      : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Échelle & Palier (Par site)</span>
                        {project.selectedEchelle && project.selectedEchelle.trim() ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {project.selectedEchelle === "Pas d'échelle" ? 'Sans échelle' : 'Sélectionnée'}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">Requis</span>
                        )}
                      </div>
                      <span className="text-xs sm:text-sm font-bold truncate block mt-1.5">
                        {project.selectedEchelle || <span className="text-slate-400 italic font-normal">Sélectionner une échelle...</span>}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl border bg-slate-50/70 border-slate-200/70 flex flex-col justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                        {nombreSecteurs > 1 ? 'Mode de configuration' : 'Configuration'}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 block mt-1.5">
                        {nombreSecteurs > 1
                          ? `Secteurs similaires (${nombreSecteurs} secteurs identiques)`
                          : 'Site mono-secteur (1 secteur unique)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Requis 2: Antennes par secteur */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {nombreSecteurs > 1
                      ? "Antennes obligatoires (Secteurs similaires — appliqué à l'ensemble du site)"
                      : "Antennes obligatoires (Secteur unique)"}
                  </div>
                  {(() => {
                    const sec = activeSectors[0] || sectors[0];
                    const has4G = Boolean(sec?.selectedMontage4G);
                    const has5G = Boolean(sec?.selectedMontage5G);
                    const isComplete = has4G && has5G;

                    return (
                      <div
                        className={`p-4 rounded-xl border transition-all ${isComplete
                          ? 'bg-violet-50/40 border-violet-200/80 text-violet-950'
                          : 'bg-slate-50/70 border-slate-200/70 text-slate-500'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              {nombreSecteurs > 1 ? 'Secteur 1' : 'Secteur Unique'}
                            </span>
                            {nombreSecteurs > 1 && (
                              <span className="text-[10px] font-semibold text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-full">
                                Appliqué aux {nombreSecteurs} secteurs
                              </span>
                            )}
                          </div>
                          {isComplete ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Antennes configurées
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">
                              {!has4G && !has5G ? 'Antennes 4G & 5G requises' : !has4G ? 'Antenne 4G requise' : 'Antenne 5G requise'}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {/* Antenne 3G/4G */}
                          <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/80">
                            <span className="text-slate-400 uppercase font-bold text-[10px] block">Antenne 3G/4G</span>
                            {has4G ? (
                              sec?.configMode === 'reference' ? (
                                <div className="mt-0.5">
                                  <span className="font-semibold text-slate-800 text-xs truncate block" title={sec?.selectedReference4G || sec?.ant4gConfig?.model}>
                                    {sec?.selectedReference4G || sec?.ant4gConfig?.model}
                                  </span>
                                  {sec?.selectedVendor4G && (
                                    <span className="text-[10px] text-slate-500 font-medium block">
                                      {sec.selectedVendor4G}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-0.5">
                                  <span className="font-bold text-slate-800 text-xs block">
                                    {sec?.ant4gConfig?.height && sec?.ant4gConfig?.width
                                      ? `${sec.ant4gConfig.height} × ${sec.ant4gConfig.width} × ${sec.ant4gConfig.thickness} mm`
                                      : sec?.ant4gConfig?.model || sec?.selectedMontage4G}
                                  </span>
                                  {sec?.ant4gConfig?.weight ? (
                                    <span className="text-[10px] text-slate-500 font-medium block">
                                      Poids : {sec.ant4gConfig.weight} kg
                                    </span>
                                  ) : null}
                                </div>
                              )
                            ) : (
                              <span className="text-slate-400 italic font-normal text-xs block mt-0.5">
                                À sélectionner...
                              </span>
                            )}
                          </div>

                          {/* Antenne 5G */}
                          <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/80">
                            <span className="text-slate-400 uppercase font-bold text-[10px] block">Antenne 5G</span>
                            {has5G ? (
                              sec?.configMode === 'reference' ? (
                                <div className="mt-0.5">
                                  <span className="font-semibold text-slate-800 text-xs truncate block" title={sec?.selectedReference5G || sec?.ant5gConfig?.model}>
                                    {sec?.selectedReference5G || sec?.ant5gConfig?.model}
                                  </span>
                                  {sec?.selectedVendor5G && (
                                    <span className="text-[10px] text-slate-500 font-medium block">
                                      {sec.selectedVendor5G}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-0.5">
                                  <span className="font-bold text-slate-800 text-xs block">
                                    {sec?.ant5gConfig?.height && sec?.ant5gConfig?.width
                                      ? `${sec.ant5gConfig.height} × ${sec.ant5gConfig.width} × ${sec.ant5gConfig.thickness} mm`
                                      : sec?.ant5gConfig?.model || sec?.selectedMontage5G}
                                  </span>
                                  {sec?.ant5gConfig?.weight ? (
                                    <span className="text-[10px] text-slate-500 font-medium block">
                                      Poids : {sec.ant5gConfig.weight} kg
                                    </span>
                                  ) : null}
                                </div>
                              )
                            ) : (
                              <span className="text-slate-400 italic font-normal text-xs block mt-0.5">
                                À sélectionner...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Équipements Aériens Additionnels (partagés, sauf FH par secteur) */}
                {(() => {
                  const secs = (activeSectors.length > 0 ? activeSectors : sectors.slice(0, 1));
                  const sec = secs[0];
                  const refList = (items?: { reference?: string; quantity?: number }[]) =>
                    (items ?? []).filter(i => i.reference).map(i => `${i.quantity ?? 1}× ${i.reference}`).join(', ');
                  type Eq = { label: string; ancrage: string; detail: string; scope?: string };
                  const shared = [
                    (operator !== 'bouygues' && sec?.hasRrhEquipment)
                      ? { label: 'RRH', ancrage: formatFoundationLabel(sec.rrhFoundationType || sec.equipmentFoundationType), detail: refList(sec.rrhItems) }
                      : null,
                    sec?.hasRruEquipment
                      ? { label: operator === 'free' ? 'RF NSN' : 'RRU', ancrage: formatFoundationLabel(sec.rruFoundationType || sec.equipmentFoundationType), detail: refList(sec.rruItems) }
                      : null,
                    (operator === 'free' ? sec?.hasBoitierJonction : sec?.hasCoffret)
                      ? {
                        label: operator === 'free' ? 'Boîtier jonction FO' : 'Coffret fibre',
                        ancrage: formatFoundationLabel(operator === 'free' ? (sec.boitierJonctionFoundationType || sec.equipmentFoundationType) : (sec.coffretFoundationType || sec.equipmentFoundationType)),
                        detail: operator === 'free' ? `${sec.boitierJonctionQuantity ?? 1}×` : (sec.coffretReference || ''),
                      }
                      : null,
                  ].filter(Boolean) as Eq[];
                  const fh: Eq[] = secs.flatMap((s2, i) => s2?.hasFhEquipment
                    ? [{
                      label: 'FH',
                      ancrage: formatFoundationLabel(s2.fhFoundationType || s2.equipmentFoundationType),
                      detail: refList(s2.fhItems),
                      scope: secs.length > 1 ? `Secteur ${i + 1}` : undefined,
                    }]
                    : []);
                  const all = [...fh, ...shared];
                  if (all.length === 0) return null;

                  return (
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Équipements Aériens Additionnels
                      </div>
                      <div className="space-y-2">
                        {all.map((eq, i) => (
                          <div key={i} className="p-3.5 rounded-xl border bg-violet-50/40 border-violet-200/80 text-violet-950 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                Type d'ancrage • {eq.label}{eq.scope ? ` • ${eq.scope}` : ''}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-slate-800 block mt-0.5">
                                {eq.ancrage}
                              </span>
                              {eq.detail && (
                                <span className="text-[11px] text-slate-500 block mt-0.5 truncate" title={eq.detail}>
                                  {eq.detail}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                              Défini
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Status indicator bar */}
              {isStep3Complete ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4 text-emerald-900 shadow-sm">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">Aériens configurés avec succès !</h4>
                    <p className="text-xs text-emerald-700">L'échelle et les antennes requises sont renseignées pour tous les secteurs.</p>
                  </div>
                  <button
                    onClick={() => setActiveStep(4)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 shrink-0 cursor-pointer hover:translate-x-0.5"
                  >
                    <span>Passer à la Zone Technique</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-950">
                  <div className="font-bold text-amber-900 mb-1.5">Sélections requises pour passer à l'étape suivante :</div>
                  <div className="flex flex-wrap gap-1.5">
                    {!project.selectedEchelle?.trim() && (
                      <span className="bg-white border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-900 shadow-2xs">
                        Échelle au sol (Accès)
                      </span>
                    )}
                    {activeSectors.some(s => !s.selectedMontage4G) && (
                      <span className="bg-white border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-900 shadow-2xs">
                        Antenne 3G/4G
                      </span>
                    )}
                    {activeSectors.some(s => !s.selectedMontage5G) && (
                      <span className="bg-white border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-900 shadow-2xs">
                        Antenne 5G
                      </span>
                    )}
                    {missingStep3Equipments.filter(req => !req.toLowerCase().includes('echelle') && !req.toLowerCase().includes('échelle')).map((req) => (
                      <span key={req} className="bg-white border border-amber-200/80 px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-900 shadow-2xs">
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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

          {/* Sticky Return-to-PDF Bar when viewing Récapitulatif after NDC completion */}
          {ndcPdfUrl && !showPdfPreview && (
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border border-emerald-200/90 rounded-2xl p-3 shadow-md shadow-emerald-500/5 flex flex-wrap items-center justify-between gap-2.5 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 truncate">Note de Calcul générée</p>
                  <p className="text-[11px] text-slate-500 truncate">Mode récapitulatif</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Afficher la Note de Calcul</span>
                </button>
                <button
                  type="button"
                  onClick={handleEditParameters}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Modifier les paramètres"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>Modifier</span>
                </button>
                <button
                  type="button"
                  onClick={handleNewCalculation}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Nouveau Calcul</span>
                </button>
              </div>
            </div>
          )}

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
                  equipmentToggles={buildEquipmentTogglesMap(group.sector, zoneTechnique, operator)}
                  equipmentValues={{
                    fhHauteurMatM: group.sector.fhHauteurMatM ?? 1.70,
                    rrhHauteurMatM: group.sector.rrhHauteurMatM ?? 1.50,
                    rruHauteurMatM: group.sector.rruHauteurMatM ?? 1.50,
                    fh: {
                      diamètre: `${fhDiameter} mm`,
                      référence: selectedFhOpt?.reference || 'N/A',
                      marque: selectedFhOpt?.vendor || '',
                      quantité: fhQuantity,
                      poids: selectedFhOpt?.weight ? `${selectedFhOpt.weight} kg` : 'N/A'
                    },
                    fhItems: group.sector.hasFhEquipment ? (group.sector.fhItems && group.sector.fhItems.length > 0 ? group.sector.fhItems : [{ id: 'fh-1', reference: group.sector.fhReference || '', quantity: group.sector.fhQuantity || 1 }]).map(item => {
                      const fhOpt = config?.fh_references?.find(r => r.id === item.reference || r.reference === item.reference || r.name === item.reference);
                      return {
                        ...item,
                        vendor: item.vendor || fhOpt?.vendor || '',
                        name: fhOpt?.name || item.reference,
                        reference: fhOpt?.reference || fhOpt?.name || item.reference,
                        diameter: fhOpt?.diameter,
                        weight: fhOpt?.weight
                      };
                    }) : null,
                    rrhItems: (operator !== 'bouygues' && group.sector.hasRrhEquipment) ? (group.sector.rrhItems ?? []).map(item => ({ ...item, reference: resolveRrh(item.reference) })) : null,
                    rruItems: group.sector.hasRruEquipment ? (group.sector.rruItems ?? []).map(item => {
                      const rruOpt = config?.rru_references?.find(r => r.id === item.reference || r.reference === item.reference);
                      return {
                        ...item,
                        reference: resolveRru(item.reference),
                        dimensions: rruOpt?.dimensions || '',
                        weight: rruOpt?.weight ?? null
                      };
                    }) : null,
                    td: (operator !== 'bouygues' && operator !== 'orange' && hasTdEquipment) ? {
                      type: tdType === 'monophase' ? 'TD Monophasé' : 'TD 5G V5',
                      référence: resolveTd(tdReference) || 'N/A'
                    } : null,
                    tgbt: (operator === 'bouygues' && hasTgbt) ? (() => {
                      const tgbtItem = config?.tgbt_references?.find(r => r.id === tgbtReference || r.name === tgbtReference || r.reference === tgbtReference);
                      return {
                        modèle: tgbtItem?.name || tgbtReference || 'TGBT ACTIA',
                        dimensions: tgbtItem?.dimensions || '500x400x230mm',
                        poids: tgbtItem?.weight ? `${tgbtItem.weight} kg` : '15 kg',
                        emplacement: tgbtEmplacement === 'integre_mat' ? 'Intégré au mât' : 'Intégré au BCube'
                      };
                    })() : null,
                    gps: { marque: gpsMarque || 'N/A', référence: gpsReference || 'N/A' },
                    boitier_lovage: { référence: boitierLovageReference || 'N/A', quantité: boitierLovageQuantity },
                    coffrets_fibre: { référence: group.sector.coffretReference || 'N/A' },
                    boitier_jonction: (operator === 'free' && group.sector.hasBoitierJonction) ? {
                      marque: 'Aginode',
                      modèle: '427 × 380 × 127 mm',
                      quantité: group.sector.boitierJonctionQuantity || 1
                    } : null,
                    coffret_trans_fo: (operator === 'free' && hasCoffretTransFo) ? {
                      modèle: 'TRANS FO',
                      dimensions: '260x380x97mm',
                      poids: `${(2.1 * (coffretTransFoQuantity || 1)).toFixed(1)} kg`,
                      quantité: coffretTransFoQuantity || 1
                    } : null,
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
                      bcube: config?.atelier_energie_references?.find(r => r.id === bcubeReference || r.reference === bcubeReference || r.name === bcubeReference)
                    } : null,
                    bcube_radio: (operator === 'bouygues' && hasBcubeRadio) ? {
                      modèle: bcubeRadioReference || 'RP6647 5G TDD',
                      reference: bcubeRadioReference || 'RP6647 5G TDD'
                    } : null,
                    convertisseur_mdea: (operator === 'free' && hasConvertisseurMdea) ? {
                      modèle: 'MDEA',
                      dimensions: '338*295*140mm',
                      poids: `${10 * (convertisseurMdeaQuantity || 1)} kg`,
                      quantité: convertisseurMdeaQuantity || 1
                    } : null,
                    pile_amod: (operator === 'free' && hasPileAmod) ? {
                      modules: amodModules
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
                  buildingHeight={Number(buildingHeight) || 0}
                  mastHeight={group.sector.selectedHeight}
                  plotHeight={plotHeight}
                  sectors={group.indices.map(i => activeSectors[i])}
                  showSectorsConfig={activeStep >= 3}
                  showAerialEquipmentConfig={activeStep >= 3}
                  showTechniqueEquipmentConfig={activeStep >= 4}
                  selectedEchelle={project.selectedEchelle}
                />
              )}
            </div>
          ))}

          {/* GENERATE GLOBAL NDC / STEP GUIDANCE */}
          {!ndcPdfUrl && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              {!isConfirmed ? (
                activeStep === 3 ? (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 animate-fadeIn">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100/80 px-2 py-0.5 rounded-full inline-block mb-1">
                          Étape 3 : Aériens
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">Équipements</h4>
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
                  {(!isGeneratingSiteNdc || isWaitingInQueue) && (
                    <WorkerStatusBanner
                      status={workerStatus}
                      isLoading={isWorkerStatusLoading}
                      isRefreshing={isWorkerStatusRefreshing}
                      onRefresh={refreshWorkerStatus}
                      isStandardSite={isFullyStandard()}
                      isWaitingInQueue={isWaitingInQueue}
                    />
                  )}
                  {isGeneratingSiteNdc ? (
                    <button
                      disabled
                      className={`w-full py-3.5 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-md transition-all text-base opacity-85 scale-[0.98] ${isWaitingInQueue
                        ? 'bg-amber-500'
                        : isFullyStandard()
                          ? 'bg-emerald-600'
                          : 'bg-violet-600'
                        }`}
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>
                        {isWaitingInQueue
                          ? "En file d'attente — un calcul est en cours..."
                          : siteNdcPollingMsg || 'Calcul en cours...'}
                      </span>
                    </button>
                  ) : siteNdcError ? (
                    <div className="flex flex-col gap-3 animate-fadeIn">
                      <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm leading-relaxed shadow-sm">
                        <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-rose-900">Échec du calcul</p>
                          <p className="text-xs text-rose-700 mt-0.5">{siteNdcError}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSiteNdcError(null);
                          handleGenerateSiteNdc({ forceRecalculate: true });
                        }}
                        disabled={!canGenerate}
                        className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-md shadow-rose-500/25 transition-all text-base cursor-pointer hover:shadow-lg"
                      >
                        <RefreshCw className="w-5 h-5" />
                        <span>Réessayer le calcul</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateSiteNdc()}
                      disabled={!canGenerate}
                      className={`w-full py-3.5 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-md transition-all text-base cursor-pointer ${!canGenerate
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : isFullyStandard()
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                          : 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/20'
                        }`}
                    >
                      <FileText className="w-5 h-5" />
                      <span>Calculer</span>
                    </button>
                  )}

                  {isGeneratingSiteNdc && (
                    <div className="w-full mt-2 animate-fadeIn">
                      {!isWaitingInQueue && typeof siteNdcProgressPercent === 'number' ? (
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ease-out ${isFullyStandard()
                              ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600'
                              : 'bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600'
                              }`}
                            style={{ width: `${Math.max(2, Math.min(100, siteNdcProgressPercent))}%` }}
                          />
                        </div>
                      ) : (
                        <>
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
                              className={`absolute top-0 bottom-0 left-0 w-1/4 rounded-full ${isWaitingInQueue
                                ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500'
                                : isFullyStandard()
                                  ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600'
                                  : 'bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600'
                                }`}
                              style={{ animation: 'indeterminateProgress 1.5s ease-in-out infinite' }}
                            ></div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(RightPreviewPanel);
