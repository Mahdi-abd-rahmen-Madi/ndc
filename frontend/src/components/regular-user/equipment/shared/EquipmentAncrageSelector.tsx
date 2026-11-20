import React from 'react';
import { Anchor } from 'lucide-react';
import { CustomSelect } from '../../../ui/CustomSelect';

export type EquipmentFoundationType = 'dallettes' | 'metallique' | 'beton';

export interface EquipmentAncrageSelectorProps {
  value?: EquipmentFoundationType;
  onChange: (val: EquipmentFoundationType) => void;
  disabled?: boolean;
  className?: string;
}

const OPTIONS: { value: EquipmentFoundationType; label: string }[] = [
  { value: 'dallettes', label: 'Dallettes' },
  { value: 'metallique', label: 'Plot métallique' },
  { value: 'beton', label: 'Plot Béton' },
];

export function EquipmentAncrageSelector({
  value = 'dallettes',
  onChange,
  disabled = false,
  className = '',
}: EquipmentAncrageSelectorProps) {
  const currentFoundation = value || 'dallettes';

  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      {/* Header with Title (no "Disponible" badge as requested) */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <Anchor className="w-3.5 h-3.5 text-violet-600 shrink-0" />
          <span>Type d'ancrage</span>
          <span className="text-red-500 font-bold">*</span>
        </label>
      </div>

      {/* Full-width Native CustomSelect: Dallettes first, then Plot métallique, then Plot Béton */}
      <CustomSelect
        value={currentFoundation}
        onChange={(val: string) => onChange(val as EquipmentFoundationType)}
        options={OPTIONS}
        disabled={disabled}
        className="w-full focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}

export default EquipmentAncrageSelector;

