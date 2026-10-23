import React from 'react';
import { Radio, SignalHigh, ArrowDownToLine, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { SectorData } from '../types';
import { EquipmentConfig } from '../../../config/equipmentConfig';
import { EquipmentPreviewCard } from '../../ui/EquipmentPreviewCard';
import { renderEquipmentPreviewCard } from './renderEquipmentPreviewCard';

export interface AerialResultsSectionProps {
  displaySectors: SectorData[];
  aerialConfigs: EquipmentConfig[];
  showSectorsConfig?: boolean;
  isAerialEquipVisible?: boolean;
  operator?: string;
  nombreSecteurs?: number;
  equipmentValues?: Record<string, any>;
}

export function AerialResultsSection({
  displaySectors,
  aerialConfigs,
  showSectorsConfig = true,
  isAerialEquipVisible = true,
  operator = 'bouygues',
  nombreSecteurs = 3,
  equipmentValues = {}
}: AerialResultsSectionProps) {
  if (!showSectorsConfig && (!isAerialEquipVisible || aerialConfigs.length === 0)) {
    return null;
  }

  const formatSectorTitle = (indices: number[]) => {
    if (indices.length === 1) return `Secteur ${indices[0]}`;
    if (indices.length === 2) return `Secteurs ${indices[0]} & ${indices[1]}`;
    const allButLast = indices.slice(0, -1).join(', ');
    return `Secteurs ${allButLast} & ${indices[indices.length - 1]}`;
  };

  const groupedDisplaySectors: { indices: number[]; sector: SectorData }[] = [];
  displaySectors.forEach((s, idx) => {
    const sectorNum = idx + 1;
    const existingGroup = groupedDisplaySectors.find(g => {
      const prev = g.sector;
      const sameHeight = prev.selectedHeight === s.selectedHeight;
      const sameMode = (prev.configMode || 'agile') === (s.configMode || 'agile');
      const isModeAgile = (prev.configMode || 'agile') === 'agile';
      const same4G = isModeAgile
        ? prev.ant4gConfig?.height === s.ant4gConfig?.height &&
        prev.ant4gConfig?.width === s.ant4gConfig?.width &&
        prev.ant4gConfig?.thickness === s.ant4gConfig?.thickness &&
        prev.ant4gConfig?.weight === s.ant4gConfig?.weight
        : prev.selectedVendor4G === s.selectedVendor4G && prev.selectedReference4G === s.selectedReference4G;
      const same5G = isModeAgile
        ? prev.ant5gConfig?.height === s.ant5gConfig?.height &&
        prev.ant5gConfig?.width === s.ant5gConfig?.width &&
        prev.ant5gConfig?.thickness === s.ant5gConfig?.thickness &&
        prev.ant5gConfig?.weight === s.ant5gConfig?.weight
        : prev.selectedVendor5G === s.selectedVendor5G && prev.selectedReference5G === s.selectedReference5G;
      return sameHeight && sameMode && same4G && same5G;
    });

    if (existingGroup) {
      existingGroup.indices.push(sectorNum);
    } else {
      groupedDisplaySectors.push({ indices: [sectorNum], sector: s });
    }
  });

  return (
    <div className="mb-5 animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Radio className="w-4 h-4 text-violet-600" />
          Aériens
        </h3>
        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 tracking-normal shadow-2xs">
          Antennes & Mâts
        </span>
      </div>

      {/* Sub-section 1: Antennes 4G & 5G */}
      {showSectorsConfig && displaySectors.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-violet-600" />
              Antennes 4G & 5G
            </p>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {displaySectors.length} secteur{displaySectors.length > 1 ? 's' : ''} {displaySectors.length > 1 ? 'identiques' : 'configuré'}
            </span>
          </div>

          <div className="space-y-3">
            {groupedDisplaySectors.map((group, groupIdx) => {
              const sector = group.sector;
              const isAgile = sector.configMode === 'agile' || !sector.configMode;
              const brand4G = sector.selectedVendor4G || 'Standard';
              const model4G = sector.ant4gConfig?.model || sector.selectedReference4G || 'Standard';
              const brand5G = sector.selectedVendor5G || 'Standard';
              const model5G = sector.ant5gConfig?.model || sector.selectedReference5G || 'Standard';

              const dim4G = sector.ant4gConfig && sector.ant4gConfig.height > 0
                ? `${sector.ant4gConfig.height} × ${sector.ant4gConfig.width} × ${sector.ant4gConfig.thickness} mm`
                : 'Non spécifié';
              const weight4G = sector.ant4gConfig && sector.ant4gConfig.weight > 0
                ? `${sector.ant4gConfig.weight} kg`
                : 'N/A';

              const dim5G = sector.ant5gConfig && sector.ant5gConfig.height > 0
                ? `${sector.ant5gConfig.height} × ${sector.ant5gConfig.width} × ${sector.ant5gConfig.thickness} mm`
                : 'Non spécifié';
              const weight5G = sector.ant5gConfig && sector.ant5gConfig.weight > 0
                ? `${sector.ant5gConfig.weight} kg`
                : 'N/A';

              return (
                <div key={groupIdx} className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm hover:border-violet-300 transition-all">
                  {/* Sector Header with Mast Height */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse"></span>
                        {formatSectorTitle(group.indices)}
                      </h4>
                      {group.indices.length > 1 && (
                        <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {group.indices.length} secteurs identiques
                        </span>
                      )}
                      {isAgile ? (
                        <span className="text-[9px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200 flex items-center gap-1 shadow-2xs">
                          <SlidersHorizontal className="w-2.5 h-2.5 text-violet-600" />
                          Configuration Agile
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          Références Réelles
                        </span>
                      )}
                    </div>
                    {sector.selectedHeight && sector.selectedHeight !== 3 && sector.selectedHeight !== 4 ? (
                      <span className="text-[10px] font-bold text-amber-800 px-2.5 py-0.5 bg-amber-50/90 border border-amber-300 rounded-full flex items-center gap-1.5 shadow-2xs animate-fadeIn">
                        <span className="text-amber-700 font-medium">Mât :</span>
                        <span className="font-extrabold text-amber-950">{sector.selectedHeight}m</span>
                        <span className="text-[8px] px-1.5 py-0.2 bg-amber-200/90 text-amber-900 rounded font-bold uppercase tracking-wider">Sur-mesure</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-600 px-2.5 py-0.5 bg-slate-100 rounded-full border border-slate-200 flex items-center gap-1.5">
                        <ArrowDownToLine className="w-3 h-3 text-violet-600" />
                        <span className="text-slate-500">Mât :</span>
                        <span className="font-bold text-slate-800">{sector.selectedHeight}m</span>
                      </span>
                    )}
                  </div>

                  {/* 4G & 5G Cards side by side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <EquipmentPreviewCard
                      title="Antenne 4G"
                      icon={Radio}
                      color="blue"
                      typeBadge={{ text: '4G LTE', bg: 'bg-blue-50', textCol: 'text-blue-700', border: 'border-blue-200' }}
                      scopeBadge={group.indices.length > 1 ? { text: `${group.indices.length} secteurs` } : undefined}
                      marque={isAgile ? undefined : brand4G}
                      modele={isAgile ? undefined : model4G}
                      extraSpecs={isAgile ? {
                        "Dimensions": dim4G,
                        "Poids": weight4G,
                        "Mode": "Gabarit agile"
                      } : undefined}
                    />

                    <EquipmentPreviewCard
                      title="Antenne 5G"
                      icon={SignalHigh}
                      color="purple"
                      typeBadge={{ text: '5G NR', bg: 'bg-purple-50', textCol: 'text-purple-700', border: 'border-purple-200' }}
                      scopeBadge={group.indices.length > 1 ? { text: `${group.indices.length} secteurs` } : undefined}
                      marque={isAgile ? undefined : brand5G}
                      modele={isAgile ? undefined : model5G}
                      extraSpecs={isAgile ? {
                        "Dimensions": dim5G,
                        "Poids": weight5G,
                        "Mode": "Gabarit agile"
                      } : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-section 2: Aerial equipments (FH, RRH, RRU, etc.) */}
      {isAerialEquipVisible && aerialConfigs.length > 0 && (
        <div className={`${showSectorsConfig && displaySectors.length > 0 ? 'mt-6 pt-5 border-t border-slate-200/80' : ''}`}>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Équipements Aériens Additionnels
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {aerialConfigs.map(config => renderEquipmentPreviewCard({
              config,
              operator,
              nombreSecteurs,
              equipmentValues
            }))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AerialResultsSection;
