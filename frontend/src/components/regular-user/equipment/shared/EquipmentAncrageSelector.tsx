import React from 'react';
import { Anchor } from 'lucide-react';

export type EquipmentFoundationType = 'metallique' | 'beton' | 'dallettes';

export interface EquipmentAncrageSelectorProps {
  value?: EquipmentFoundationType;
  onChange: (val: EquipmentFoundationType) => void;
  disabled?: boolean;
  className?: string;
}

export function EquipmentAncrageSelector({
  value = 'metallique',
  onChange,
  disabled = false,
  className = '',
}: EquipmentAncrageSelectorProps) {
  const currentFoundation = value || 'metallique';

  return (
    <div className={`flex flex-col pt-3 border-t border-slate-100 ${className}`}>
      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5">
          <Anchor className="w-3.5 h-3.5 text-violet-600" />
          Type d'ancrage <span className="text-red-500 font-bold">*</span>
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => !disabled && onChange('metallique')}
          disabled={disabled}
          className={`py-2 px-3 rounded-xl border text-left transition-all flex items-center justify-between ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${
            currentFoundation === 'metallique'
              ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <span className="text-xs font-bold">Plot métallique</span>
          <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Disponible</span>
        </button>

        <button
          type="button"
          onClick={() => !disabled && onChange('beton')}
          disabled={disabled}
          className={`py-2 px-3 rounded-xl border text-left transition-all flex items-center justify-between ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${
            currentFoundation === 'beton'
              ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <span className="text-xs font-bold">Plot Béton</span>
          <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Indispo.</span>
        </button>

        <button
          type="button"
          onClick={() => !disabled && onChange('dallettes')}
          disabled={disabled}
          className={`py-2 px-3 rounded-xl border text-left transition-all flex items-center justify-between ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${
            currentFoundation === 'dallettes'
              ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <span className="text-xs font-bold">Dallettes</span>
          <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Indispo.</span>
        </button>
      </div>
    </div>
  );
}

export default EquipmentAncrageSelector;

