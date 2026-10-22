import React from 'react';

export interface VendorTabSelectorProps {
  /**
   * List of available vendor names
   */
  vendors: string[];
  /**
   * Currently selected vendor
   */
  selectedVendor: string;
  /**
   * Change callback when a vendor is selected
   */
  onSelectVendor: (vendor: string) => void;
  /**
   * Label displayed on the left (e.g. "Marque :")
   */
  label?: string;
  /**
   * Color theme: 'violet' | 'blue' | 'amber' | 'emerald' | 'orange' | 'rose'
   */
  color?: 'violet' | 'blue' | 'amber' | 'emerald' | 'orange' | 'rose';
  className?: string;
}

const COLOR_CLASSES: Record<string, { active: string; idle: string }> = {
  violet: {
    active: 'bg-violet-600 text-white border-violet-600 shadow-2xs',
    idle: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
  },
  blue: {
    active: 'bg-blue-600 text-white border-blue-600 shadow-2xs',
    idle: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
  },
  amber: {
    active: 'bg-amber-600 text-white border-amber-600 shadow-2xs',
    idle: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
  },
  emerald: {
    active: 'bg-emerald-600 text-white border-emerald-600 shadow-2xs',
    idle: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
  },
  orange: {
    active: 'bg-orange-600 text-white border-orange-600 shadow-2xs',
    idle: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
  },
  rose: {
    active: 'bg-rose-600 text-white border-rose-600 shadow-2xs',
    idle: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
  }
};

export function VendorTabSelector({
  vendors,
  selectedVendor,
  onSelectVendor,
  label = 'Marque :',
  color = 'violet',
  className = ''
}: VendorTabSelectorProps) {
  if (!vendors || vendors.length === 0) return null;

  const colorStyles = COLOR_CLASSES[color] || COLOR_CLASSES.violet;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {label && (
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold shrink-0">
          {label}
        </span>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {vendors.map((vendor) => {
          const isSelected = selectedVendor === vendor;
          return (
            <button
              key={vendor}
              type="button"
              onClick={() => onSelectVendor(vendor)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                isSelected ? colorStyles.active : colorStyles.idle
              }`}
            >
              {vendor}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default VendorTabSelector;
