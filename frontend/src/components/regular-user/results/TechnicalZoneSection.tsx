import React from 'react';
import { Activity } from 'lucide-react';
import { EquipmentConfig } from '../../../config/equipmentConfig';
import { renderEquipmentPreviewCard } from './renderEquipmentPreviewCard';

export interface TechnicalZoneSectionProps {
  techniqueConfigs: EquipmentConfig[];
  isTechniqueEquipVisible?: boolean;
  operator?: string;
  nombreSecteurs?: number;
  equipmentValues?: Record<string, any>;
}

export function TechnicalZoneSection({
  techniqueConfigs,
  isTechniqueEquipVisible = true,
  operator = 'bouygues',
  nombreSecteurs = 3,
  equipmentValues = {}
}: TechnicalZoneSectionProps) {
  if (!isTechniqueEquipVisible || techniqueConfigs.length === 0) {
    return null;
  }

  return (
    <div className="mb-5 animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          Zone Technique
        </h3>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 tracking-normal">
          Local technique & Baies
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {techniqueConfigs.map(config => renderEquipmentPreviewCard({
          config,
          operator,
          nombreSecteurs,
          equipmentValues
        }))}
      </div>
    </div>
  );
}

export default TechnicalZoneSection;
