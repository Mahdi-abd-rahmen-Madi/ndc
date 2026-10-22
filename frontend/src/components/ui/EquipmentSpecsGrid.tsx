import React from 'react';

export interface EquipmentSpecsItem {
  label: string;
  value: string | number | undefined | null;
  /**
   * If true, spans 2 columns on small/medium screens
   */
  fullWidth?: boolean;
}

export interface EquipmentSpecsGridProps {
  items: EquipmentSpecsItem[];
  className?: string;
  columns?: 2 | 3 | 4;
}

export function EquipmentSpecsGrid({
  items,
  className = '',
  columns = 2
}: EquipmentSpecsGridProps) {
  const visibleItems = items.filter(
    (item) => item.value !== undefined && item.value !== null && item.value !== ''
  );

  if (visibleItems.length === 0) return null;

  const colClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
  }[columns];

  return (
    <div className={`space-y-2 bg-slate-50 p-2.5 sm:p-3 rounded-lg border border-slate-200 mt-2 ${className}`}>
      <div className={`grid ${colClasses} gap-2`}>
        {visibleItems.map((item, idx) => (
          <div key={idx} className={item.fullWidth ? 'col-span-full' : 'min-w-0'}>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block truncate">
              {item.label}
            </label>
            <input
              type="text"
              value={String(item.value)}
              disabled
              readOnly
              className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed truncate shadow-2xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default EquipmentSpecsGrid;
