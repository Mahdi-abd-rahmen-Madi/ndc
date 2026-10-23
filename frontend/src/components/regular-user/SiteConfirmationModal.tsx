import React, { useRef, useState, useEffect } from 'react';
import {
  X, FileText, CheckCircle2, ChevronDown, AlertTriangle, Layers, Radio, Server
} from 'lucide-react';
import type { SectorData, CatalogueConfig, ZoneTechniqueData, SelectedBaieItem, EquipmentItem } from './types';
import { DEFAULT_ORANGE_BAIES } from './equipment/BaieEquipmentToggle';

export interface SiteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  nombreSecteurs: number;
  activeSectors: SectorData[];
  dalleThickness: number | string;
  etancheite: number | string;
  selectedEchelle: string;
  zoneTechnique: ZoneTechniqueData;
  operator: string;
  config: CatalogueConfig | null;
  resolveTd: (id: string) => string;
  resolveRru: (id: string) => string;
  resolveRrh: (id: string) => string;
  resolveBaieItems: (items: SelectedBaieItem[]) => any[];
  getMontageDisplayLabel: (sector: any) => string;
}

export function SiteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  nombreSecteurs,
  activeSectors,
  dalleThickness,
  etancheite,
  selectedEchelle,
  zoneTechnique,
  operator,
  config,
  resolveTd,
  resolveRru,
  resolveRrh,
  resolveBaieItems,
  getMontageDisplayLabel
}: SiteConfirmationModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      setTimeout(() => {
        if (scrollRef.current) {
          const { scrollHeight, clientHeight } = scrollRef.current;
          if (scrollHeight <= clientHeight + 10) {
            setHasScrolledToBottom(true);
          }
        }
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const s1 = activeSectors[0];
  const hasFhEquipment = !!s1?.hasFhEquipment;
  const fhQuantity = s1?.fhQuantity ?? 1;
  const fhReference = s1?.fhReference ?? '';
  const hasRruEquipment = !!s1?.hasRruEquipment;
  const rruItems = s1?.rruItems ?? [];
  const hasRrhEquipment = !!s1?.hasRrhEquipment;
  const rrhItems = s1?.rrhItems ?? [];
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
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          ref={scrollRef}
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
                <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">Présence échelle + Palier</span>
                <span className="font-bold text-slate-900">{selectedEchelle || 'Non spécifié'}</span>
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
              onClick={onClose}
              className="px-5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors font-semibold text-sm"
            >
              Annuler
            </button>
            <button
              disabled={!hasScrolledToBottom}
              onClick={onConfirm}
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
  );
}

export default SiteConfirmationModal;
