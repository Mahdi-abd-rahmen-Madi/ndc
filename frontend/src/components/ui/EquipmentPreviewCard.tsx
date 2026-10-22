import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EquipmentPreviewCardProps {
  /**
   * Title shown at the very top line next to the icon (e.g. "Faisceau Hertzien (FH)", "RRU", "RRH", "Coffrets fibre")
   */
  title: string;
  /**
   * Icon component displayed on the top line
   */
  icon: LucideIcon;
  /**
   * Color theme: 'amber' | 'emerald' | 'rose' | 'purple' | 'blue' | 'orange' | 'fuchsia' | 'teal'
   */
  color?: 'amber' | 'emerald' | 'rose' | 'purple' | 'blue' | 'orange' | 'fuchsia' | 'teal';
  /**
   * Scope badge displayed on the 2nd line on the left (e.g. { text: '1x par site' } or { text: 'Par secteur' })
   */
  scopeBadge?: {
    text: string;
    bg?: string;
    textCol?: string;
    border?: string;
  };
  /**
   * Type badge displayed on the 2nd line on the left (e.g. { text: 'RRU' })
   */
  typeBadge?: {
    text: string;
    bg?: string;
    textCol?: string;
    border?: string;
  };
  /**
   * Quantity info displayed on the 2nd line on the top right
   * Can be per-sector info: { perSector: 1, total: 3 }
   * or a simple total/fixed number: e.g. { total: 1, label: 'x1' }
   */
  quantityInfo?: {
    perSector?: number;
    total?: number;
    label?: string; // custom string like "x1"
  };
  /**
   * Brand / Marque (e.g. "ERICSSON", "NOKIA")
   */
  marque?: string;
  /**
   * Model / Modèle (e.g. "BFZ 622 33/3S03H Ø 900 mm", "Radio 2217 B3", "AHPD")
   */
  modele?: string;
  /**
   * Any additional specs to display in the body if needed
   */
  extraSpecs?: Record<string, any>;
  className?: string;
}

const COLOR_CLASSES: Record<string, { border: string; iconBg: string }> = {
  amber: {
    border: 'border-l-amber-500 hover:border-amber-400',
    iconBg: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'
  },
  emerald: {
    border: 'border-l-emerald-500 hover:border-emerald-400',
    iconBg: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
  },
  rose: {
    border: 'border-l-rose-500 hover:border-rose-400',
    iconBg: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100'
  },
  purple: {
    border: 'border-l-purple-500 hover:border-purple-400',
    iconBg: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
  },
  blue: {
    border: 'border-l-blue-500 hover:border-blue-400',
    iconBg: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
  },
  orange: {
    border: 'border-l-orange-500 hover:border-orange-400',
    iconBg: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100'
  },
  fuchsia: {
    border: 'border-l-fuchsia-500 hover:border-fuchsia-400',
    iconBg: 'bg-fuchsia-50 text-fuchsia-600 group-hover:bg-fuchsia-100'
  },
  teal: {
    border: 'border-l-teal-500 hover:border-teal-400',
    iconBg: 'bg-teal-50 text-teal-600 group-hover:bg-teal-100'
  }
};

export function EquipmentPreviewCard({
  title,
  icon: Icon,
  color = 'emerald',
  scopeBadge,
  typeBadge,
  quantityInfo,
  marque,
  modele,
  extraSpecs = {},
  className = ''
}: EquipmentPreviewCardProps) {
  const colorStyle = COLOR_CLASSES[color] || COLOR_CLASSES.emerald;

  return (
    <div
      className={`group relative bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-sm flex flex-col gap-3 border-l-[3px] ${colorStyle.border} hover:shadow-md duration-300 transition-all ${className}`}
    >
      {/* Header section */}
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-2.5">
        {/* Very top line: Icon + Equipment Type (e.g. Faisceau Hertzien (FH), RRU, RRH, Coffrets fibre) */}
        <div className="flex items-center gap-2 w-full min-w-0">
          <div className={`p-1.5 ${colorStyle.iconBg} rounded-lg group-hover:scale-105 shadow-2xs transition-transform shrink-0`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-slate-900 tracking-tight leading-snug break-words flex-1 min-w-0" title={title}>
            {title}
          </h4>
        </div>

        {/* 2nd line: Badges on left, quantity / total on right */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {typeBadge && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  typeBadge.bg || 'bg-slate-100'
                } ${typeBadge.textCol || 'text-slate-700'} border ${typeBadge.border || 'border-slate-200'}`}
              >
                {typeBadge.text}
              </span>
            )}
            {scopeBadge && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  scopeBadge.bg || 'bg-violet-50'
                } ${scopeBadge.textCol || 'text-violet-700'} border ${scopeBadge.border || 'border-violet-200'}`}
              >
                {scopeBadge.text}
              </span>
            )}
          </div>

          {/* Right side: number / total per secteur ou par site */}
          {quantityInfo && (
            <div className="flex flex-col items-end shrink-0">
              {quantityInfo.perSector !== undefined ? (
                <>
                  <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 shadow-2xs flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-700">
                      {quantityInfo.perSector}/secteur
                    </span>
                  </div>
                  {quantityInfo.total !== undefined && (
                    <span className="text-[10px] font-bold text-violet-700 mt-0.5 tracking-tight">
                      Total : {quantityInfo.total}
                    </span>
                  )}
                </>
              ) : quantityInfo.label ? (
                <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-700">
                    {quantityInfo.label}
                  </span>
                </div>
              ) : quantityInfo.total !== undefined ? (
                <div className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 shadow-2xs flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-700">
                    x{quantityInfo.total}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Content section: Marque & Modèle */}
      <div className="flex flex-col gap-1.5 flex-1 justify-center">
        {marque && (
          <div className="flex justify-between items-center gap-2.5 bg-slate-50/80 rounded-lg p-2 border border-slate-100 hover:border-slate-200 transition-colors">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
              Marque
            </span>
            <span className="text-xs font-bold text-slate-800 text-right leading-tight max-w-[65%] break-words" title={marque}>
              {marque}
            </span>
          </div>
        )}

        {modele && (
          <div className="flex justify-between items-center gap-2.5 bg-slate-50/80 rounded-lg p-2 border border-slate-100 hover:border-slate-200 transition-colors">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
              Modèle
            </span>
            <span className="text-xs font-bold text-slate-800 text-right leading-tight max-w-[65%] break-words" title={modele}>
              {modele}
            </span>
          </div>
        )}

        {/* Any extra specs (e.g. for baie, TD, etc. if reused) */}
        {extraSpecs && Object.entries(extraSpecs).map(([key, val], idx) => {
          if (val === undefined || val === null || val === '') return null;
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          return (
            <div
              key={idx}
              className="flex justify-between items-center gap-2.5 bg-slate-50/80 rounded-lg p-2 border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider shrink-0">
                {label}
              </span>
              <span className="text-xs font-bold text-slate-800 text-right leading-tight max-w-[65%] break-words" title={String(val)}>
                {String(val)}
              </span>
            </div>
          );
        })}

        {!marque && !modele && Object.keys(extraSpecs).length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-400 text-[10px] italic py-2">
            Aucun paramètre
          </div>
        )}
      </div>
    </div>
  );
}

export default EquipmentPreviewCard;
