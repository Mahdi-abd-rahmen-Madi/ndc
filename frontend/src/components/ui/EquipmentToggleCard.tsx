import React from 'react';
import { LucideIcon, AlertCircle } from 'lucide-react';

export interface EquipmentToggleCardProps {
  /**
   * Title shown next to the switch (e.g. "Présence Faisceau Hertzien (FH)", "Présence GPS")
   */
  title: string;
  /**
   * Boolean state for whether equipment is enabled
   */
  enabled: boolean;
  /**
   * Change callback for toggling the switch
   */
  onToggle: (enabled: boolean) => void;
  /**
   * Icon displayed beside the title
   */
  icon?: LucideIcon;
  /**
   * Color theme: 'violet' | 'amber' | 'blue' | 'emerald' | 'orange' | 'rose'
   */
  color?: 'violet' | 'amber' | 'blue' | 'emerald' | 'orange' | 'rose';
  /**
   * Scope badge shown on the top-right (e.g. "1x par site", "Par secteur")
   */
  scopeBadgeText?: string;
  /**
   * True if user must still fill mandatory options
   */
  isIncomplete?: boolean;
  /**
   * Custom badge or right-aligned extra content in the header
   */
  headerRightContent?: React.ReactNode;
  /**
   * Subtitle or small helper description below the title
   */
  description?: string;
  /**
   * Children content rendered when `enabled` is true
   */
  children?: React.ReactNode;
  className?: string;
}

const SWITCH_COLORS: Record<string, { active: string; borderActive: string; ring: string; icon: string }> = {
  violet: {
    active: 'bg-violet-600',
    borderActive: 'border-violet-300',
    ring: 'ring-1 ring-violet-500/10',
    icon: 'text-violet-600'
  },
  amber: {
    active: 'bg-amber-600',
    borderActive: 'border-amber-300',
    ring: 'ring-1 ring-amber-500/10',
    icon: 'text-amber-600'
  },
  blue: {
    active: 'bg-blue-600',
    borderActive: 'border-blue-300',
    ring: 'ring-1 ring-blue-500/10',
    icon: 'text-blue-600'
  },
  emerald: {
    active: 'bg-emerald-600',
    borderActive: 'border-emerald-300',
    ring: 'ring-1 ring-emerald-500/10',
    icon: 'text-emerald-600'
  },
  orange: {
    active: 'bg-orange-600',
    borderActive: 'border-orange-300',
    ring: 'ring-1 ring-orange-500/10',
    icon: 'text-orange-600'
  },
  rose: {
    active: 'bg-rose-600',
    borderActive: 'border-rose-300',
    ring: 'ring-1 ring-rose-500/10',
    icon: 'text-rose-600'
  }
};

export function EquipmentToggleCard({
  title,
  enabled,
  onToggle,
  icon: Icon,
  color = 'violet',
  scopeBadgeText,
  isIncomplete = false,
  headerRightContent,
  description,
  children,
  className = ''
}: EquipmentToggleCardProps) {
  const theme = SWITCH_COLORS[color] || SWITCH_COLORS.violet;

  return (
    <div
      className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${
        enabled
          ? isIncomplete
            ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/10'
            : `${theme.borderActive} ${theme.ring}`
          : 'border-slate-200 hover:border-slate-300'
      } ${className}`}
    >
      <div className="flex flex-col space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-2 cursor-pointer select-none shrink-0">
            <div className="relative flex items-center shrink-0">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggle(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-9 h-5 rounded-full transition-colors ${
                  enabled ? theme.active : 'bg-slate-300'
                }`}
              />
              <div
                className={`absolute left-0.5 top-0.5 bg-white shadow-sm w-4 h-4 rounded-full transition-transform ${
                  enabled ? 'transform translate-x-4' : ''
                }`}
              />
            </div>
            {Icon && <Icon className={`w-4 h-4 ${theme.icon} shrink-0`} />}
            <span className="font-semibold text-slate-800 whitespace-nowrap">{title}</span>
          </label>

          {/* Right Header items: Incomplete warning, scope badge, custom content */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isIncomplete && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 animate-pulse whitespace-nowrap">
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                Sélection requise
              </span>
            )}
            {scopeBadgeText && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50/80 px-2.5 py-0.5 rounded-full border border-blue-200/80 whitespace-nowrap shadow-2xs">
                {scopeBadgeText}
              </span>
            )}
            {headerRightContent}
          </div>
        </div>

        {description && (
          <p className="text-[11px] text-slate-500 font-normal pl-11 -mt-1">
            {description}
          </p>
        )}

        {/* Content body rendered when enabled */}
        {enabled && children && (
          <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default EquipmentToggleCard;
