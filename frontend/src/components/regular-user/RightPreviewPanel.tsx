import React from 'react';
import {
  MapPin, Map as MapIcon, Building2, CheckCircle2, ArrowRight,
  Sparkles, Radio, Server, AlertCircle, Loader2, FileText, Eye, Settings, RefreshCw
} from 'lucide-react';
import ResultsPanel from './ResultsPanel';
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
  missingRequirements: string[];
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
  siteNdcError: string | null;
  setSiteNdcError: (err: string | null) => void;
  ndcPdfUrl: string | null;
  setNdcPdfUrl: (url: string | null) => void;
  showPdfPreview: boolean;
  setShowPdfPreview: (show: boolean) => void;
  isFullyStandard: () => boolean;
  handleGenerateSiteNdc: () => void;
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
  missingRequirements,
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
  if (showMap) return null;

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
    selectedEchelle,
  } = project;

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
                    {buildingHeight !== '' ? `${buildingHeight} m` : <span className="text-slate-400 italic font-normal">À renseigner</span>}
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
                  buildingHeight={Number(buildingHeight) || 0}
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
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-md shadow-emerald-500/20 transition-all text-lg cursor-pointer"
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
                    className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-sm border border-slate-200 shadow-sm cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    Modifier les paramètres
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-sm border border-rose-200 cursor-pointer"
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
  );
}

export default React.memo(RightPreviewPanel);
