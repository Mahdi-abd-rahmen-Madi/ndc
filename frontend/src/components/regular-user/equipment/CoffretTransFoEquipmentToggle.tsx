import React, { useMemo } from 'react';
import { Box } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { QuantityInput } from '../../ui/QuantityInput';

export interface CoffretTransFoEquipmentToggleProps {
  hasCoffretTransFo: boolean;
  setHasCoffretTransFo: (val: boolean) => void;
  coffretTransFoQuantity: number;
  setCoffretTransFoQuantity: (val: number) => void;
  coffretReference?: string;
  setCoffretReference?: (val: string) => void;
  coffretOptions?: { id: string; name: string; operator?: string }[];
}

export function CoffretTransFoEquipmentToggle({
  hasCoffretTransFo,
  setHasCoffretTransFo,
  coffretTransFoQuantity,
  setCoffretTransFoQuantity,
  coffretReference = 'TRANS_FO',
  setCoffretReference,
  coffretOptions = []
}: CoffretTransFoEquipmentToggleProps) {
  const options = useMemo(() => {
    const freeOpts = coffretOptions.filter(opt => opt.operator === 'free' || opt.id === 'TRANS_FO');
    if (freeOpts.length > 0) {
      return freeOpts.map(opt => ({
        value: opt.id,
        label: opt.id === 'TRANS_FO' ? 'TRANS FO' : (opt.name?.replace(/\s*\([^)]*\).*/, '').replace(/^Coffrets?\s+/i, '').trim() || opt.id)
      }));
    }
    return [{ value: 'TRANS_FO', label: 'TRANS FO' }];
  }, [coffretOptions]);

  const selectedValue = coffretReference || options[0]?.value || 'TRANS_FO';

  return (
    <EquipmentToggleCard
      title="Coffret hybride"
      enabled={hasCoffretTransFo}
      onToggle={setHasCoffretTransFo}
      icon={Box}
      color="violet"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Référence
          </label>
          <CustomSelect
            value={selectedValue}
            onChange={(val) => setCoffretReference?.(val)}
            options={options}
            placeholder="Sélectionner une référence"
            className="w-full"
          />
        </div>

        <div>
          <QuantityInput
            value={coffretTransFoQuantity || 1}
            onChange={setCoffretTransFoQuantity}
            label="Qté :"
            size="md"
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default CoffretTransFoEquipmentToggle;

