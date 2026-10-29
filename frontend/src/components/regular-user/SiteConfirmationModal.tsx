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

function MastEquipmentCard({
  borderClass,
  title,
  badgeText,
  badgeClass = 'bg-violet-50 text-violet-700 border-violet-200',
  quantityText,
  totalCount,
  detailLabel = 'Référence',
  detailValue
}: {
  borderClass: string;
  title: string;
  badgeText: string;
  badgeClass?: string;
  quantityText: string;
  totalCount?: number;
  detailLabel?: string;
  detailValue: React.ReactNode;
}) {
  return (
    <div className={`bg-white p-3 rounded-lg border border-slate-200/80 flex flex-col gap-1.5 border-l-[3px] ${borderClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          {title}
          <span className={`text-[9px] border px-1.5 py-0.2 rounded font-bold uppercase ${badgeClass}`}>
            {badgeText}
          </span>
        </span>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-800">{quantityText}</span>
          {totalCount !== undefined && totalCount > 1 && (
            <span className="text-[10px] font-extrabold text-violet-700 ml-1.5">
              (Total : {totalCount})
            </span>
          )}
        </div>
      </div>
      <div className="text-[11px] text-slate-600">
        {detailLabel} : <strong className="text-slate-800">{detailValue}</strong>
      </div>
    </div>
  );
}

function ZoneTechniqueCard({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
      <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-0.5">{title}</span>
      {children}
    </div>
  );
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
  const [isEquipmentValidated, setIsEquipmentValidated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      setIsEquipmentValidated(false);
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
    hasTdEquipment, tdType, tdReference, hasTgbt, tgbtReference,
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
                Équipements additionnels
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* FH */}
                {hasFhEquipment && fhQuantity > 0 && (
                  <MastEquipmentCard
                    borderClass="border-l-amber-500"
                    title="Faisceau Hertzien (FH)"
                    badgeText="1x par site"
                    badgeClass="bg-amber-50 text-amber-700 border-amber-200"
                    quantityText={`${fhQuantity} unité`}
                    detailLabel="Modèle"
                    detailValue={config?.fh_references?.find(r => r.id === fhReference)?.reference || 'Sélectionné'}
                  />
                )}

                {/* RRU Items */}
                {hasRruEquipment && rruItems.map((item, idx) => (
                  <MastEquipmentCard
                    key={`rru-${idx}`}
                    borderClass="border-l-emerald-500"
                    title={operator === 'free' ? 'RF NSN' : 'RRU'}
                    badgeText="Par secteur"
                    quantityText={`${item.quantity} / sect.`}
                    totalCount={(item.quantity || 1) * nombreSecteurs}
                    detailValue={resolveRru(item.reference) || item.reference || 'N/A'}
                  />
                ))}

                {/* RRH Items */}
                {operator !== 'bouygues' && hasRrhEquipment && rrhItems.map((item, idx) => (
                  <MastEquipmentCard
                    key={`rrh-${idx}`}
                    borderClass="border-l-rose-500"
                    title="RRH"
                    badgeText="Par secteur"
                    quantityText={`${item.quantity} / sect.`}
                    totalCount={(item.quantity || 1) * nombreSecteurs}
                    detailValue={resolveRrh(item.reference) || item.reference || 'N/A'}
                  />
                ))}

                {/* Coffrets */}
                {hasCoffret && (
                  <MastEquipmentCard
                    borderClass="border-l-pink-500"
                    title="Coffret Fibre / Hybride"
                    badgeText="Par secteur"
                    quantityText="1 / sect."
                    totalCount={nombreSecteurs}
                    detailLabel="Modèle"
                    detailValue={config?.coffret_references?.find((r: any) => r.id === coffretReference)?.name || coffretReference || 'Sélectionné'}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 3. Zone Technique */}
          {(hasTdEquipment || hasGps || hasBoitierLovage || (operator === 'orange' && hasBaie) || (operator === 'free' && (hasCab || hasAtelierEnergie || hasConvertisseurMdea)) || ((operator === 'free' || operator === 'bouygues') && hasAtelierEnergie) || (operator === 'bouygues' && hasTgbt)) && (
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
                  <ZoneTechniqueCard title={`Équipement TD (${tdType === 'monophase' ? 'Monophasé' : 'Tétraphasé'})`}>
                    <span className="text-xs font-bold text-slate-900 block truncate" title={resolveTd(tdReference) || tdReference}>
                      {resolveTd(tdReference) || tdReference || 'Sélectionné'}
                    </span>
                    {operator !== 'bouygues' && tdType === 'monophase' && tgbtReference && (
                      <span className="text-[10px] text-slate-500 block mt-0.5">TGBT : {tgbtReference}</span>
                    )}
                  </ZoneTechniqueCard>
                )}
                {hasGps && (
                  <ZoneTechniqueCard title="Antenne GPS">
                    <span className="text-xs font-bold text-slate-900 block">
                      {gpsMarque ? `${gpsMarque} ` : ''}{gpsReference || 'Sélectionné'}
                    </span>
                  </ZoneTechniqueCard>
                )}
                {hasBoitierLovage && (
                  <ZoneTechniqueCard title={`Boîtier de Lovage (Qté: ${boitierLovageQuantity})`}>
                    <span className="text-xs font-bold text-slate-900 block truncate" title={config?.boitier_lovage_references?.find((r: any) => r.id === boitierLovageReference)?.reference || boitierLovageReference}>
                      {config?.boitier_lovage_references?.find((r: any) => r.id === boitierLovageReference)?.reference || boitierLovageReference || 'Sélectionné'}
                    </span>
                  </ZoneTechniqueCard>
                )}
                {operator === 'orange' && hasBaie && (
                  <ZoneTechniqueCard title={`Zone Technique Orange (${baieItems.length} ${baieItems.length > 1 ? 'équipements' : 'équipement'})`}>
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
                  </ZoneTechniqueCard>
                )}
                {operator === 'free' && hasCab && (
                  <ZoneTechniqueCard title={`Baie CAB (${cabSupport ? { plinthes: 'Plinthes', support_autostable: 'Support Autostable', support_fimo: 'Support FIMO', support_muraux: 'Supports Muraux' }[cabSupport] || cabSupport : 'Support'})`}>
                    <span className="text-xs font-bold text-slate-900 block">
                      {[cabOne ? 'CAB ONE' : null, cabTwo ? 'CAB TWO' : null, cabThree ? 'CAB THREE' : null].filter(Boolean).join(', ') || 'Sélectionnée'}
                    </span>
                  </ZoneTechniqueCard>
                )}
                {operator === 'free' && hasAtelierEnergie && (
                  <ZoneTechniqueCard title="Atelier d'Énergie">
                    <span className="text-xs font-bold text-slate-900 block">
                      {[
                        atelierFprb ? (atelierFprbQuantity > 1 ? `${atelierFprbQuantity}x Module FPRB` : "Module FPRB") : null,
                        atelierFpbc ? (atelierFpbcQuantity > 1 ? `${atelierFpbcQuantity}x Module FPBC` : "Module FPBC") : null
                      ].filter(Boolean).join(', ') || 'Sélectionné'}
                    </span>
                  </ZoneTechniqueCard>
                )}
                {operator === 'free' && hasConvertisseurMdea && (
                  <ZoneTechniqueCard title="Convertisseur MDEA">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        MDEA (10 kg)
                      </span>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                        Qté: {convertisseurMdeaQuantity}
                      </span>
                    </div>
                  </ZoneTechniqueCard>
                )}
                {operator === 'bouygues' && hasAtelierEnergie && (
                  <ZoneTechniqueCard title="BCube (TD + AE)">
                    <span className="text-xs font-bold text-slate-900 block">
                      {config?.atelier_energie_references?.find(r => r.id === bcubeReference)?.name || bcubeReference || 'Sélectionné'}
                    </span>
                  </ZoneTechniqueCard>
                )}
                {operator === 'bouygues' && hasTgbt && (
                  <ZoneTechniqueCard title="TGBT">
                    <span className="text-xs font-bold text-slate-900 block">
                      {tgbtReference || 'TGBT ACTIA'}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">500x400x230mm • 15kg</span>
                  </ZoneTechniqueCard>
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

          {/* Validation des équipements - Case à cocher */}
          <div className="bg-violet-50/70 border border-violet-200/90 rounded-xl p-3.5 flex items-start gap-3 transition-colors hover:bg-violet-50">
            <input
              id="confirm-equipments-checkbox"
              type="checkbox"
              checked={isEquipmentValidated}
              onChange={(e) => setIsEquipmentValidated(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-violet-600 bg-white border-slate-300 rounded focus:ring-violet-500 focus:ring-2 cursor-pointer transition-all"
            />
            <label
              htmlFor="confirm-equipments-checkbox"
              className="text-xs text-slate-800 leading-snug cursor-pointer select-none font-medium"
            >
              <strong className="text-violet-950 font-bold block mb-0.5">Validation des équipements</strong>
              Je confirme et valide l'ensemble des équipements et paramètres sélectionnés pour cette note de calcul.
            </label>
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
            ) : !isEquipmentValidated ? (
              <div className="flex items-center gap-1.5 text-xs text-violet-700 bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-200">
                <AlertTriangle className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                <span>Veuillez cocher la case de validation des équipements</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-medium">Équipements validés</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors font-semibold text-sm cursor-pointer"
            >
              Annuler
            </button>
            <button
              disabled={!hasScrolledToBottom || !isEquipmentValidated}
              onClick={onConfirm}
              className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm ${hasScrolledToBottom && isEquipmentValidated
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg cursor-pointer active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/60 shadow-none'
                }`}
              title={
                !hasScrolledToBottom
                  ? "Veuillez faire défiler le récapitulatif jusqu'en bas pour confirmer"
                  : !isEquipmentValidated
                    ? "Veuillez cocher la case de validation des équipements"
                    : undefined
              }
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
