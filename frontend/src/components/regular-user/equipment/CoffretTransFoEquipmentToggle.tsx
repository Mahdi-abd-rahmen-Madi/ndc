import React from 'react';
import { Box } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { QuantityInput } from '../../ui/QuantityInput';

export interface CoffretTransFoEquipmentToggleProps {
  hasCoffretTransFo: boolean;
  setHasCoffretTransFo: (val: boolean) => void;
  coffretTransFoQuantity: number;
  setCoffretTransFoQuantity: (val: number) => void;
  coffretReference?: string;
  coffretOptions?: { id: string; name: string; operator?: string }[];
}

export function CoffretTransFoEquipmentToggle({
  hasCoffretTransFo,
  setHasCoffretTransFo,
  coffretTransFoQuantity,
  setCoffretTransFoQuantity,
  coffretOptions = []
}: CoffretTransFoEquipmentToggleProps) {
  const transFoOption = coffretOptions.find(opt => opt.id === 'TRANS_FO' || opt.operator === 'free');
  const details = transFoOption?.name || 'Coffret TRANS FO (260x380x97mm, 2.1kg)';

  return (
    <EquipmentToggleCard
      title="Coffret hybride : TRANS FO"
      enabled={hasCoffretTransFo}
      onToggle={setHasCoffretTransFo}
      icon={Box}
      color="violet"
      scopeBadgeText="Zone Technique"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <QuantityInput
          value={coffretTransFoQuantity || 1}
          onChange={setCoffretTransFoQuantity}
          label="Qté :"
          size="md"
        />

        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Modèle / Dimensions
          </label>
          <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 truncate">
            {details}
          </div>
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default CoffretTransFoEquipmentToggle;

