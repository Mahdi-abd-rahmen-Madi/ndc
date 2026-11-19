import { useMemo } from 'react';
import { Box } from 'lucide-react';
import { STATIC_EQUIPMENT_SPECS } from '../../../config/catalogueDefaults';
import { SelectEquipmentToggle } from './shared/SelectEquipmentToggle';

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
  coffretReference = STATIC_EQUIPMENT_SPECS.transFo.reference,
  setCoffretReference,
  coffretOptions = [],
}: CoffretTransFoEquipmentToggleProps) {
  const selectOptions = useMemo(() => {
    const freeOpts = coffretOptions.filter(opt => opt.operator === 'free' || opt.id === 'TRANS_FO');
    if (freeOpts.length > 0) {
      return freeOpts.map(opt => ({
        value: opt.id,
        label:
          opt.id === 'TRANS_FO'
            ? STATIC_EQUIPMENT_SPECS.transFo.label
            : opt.name?.replace(/\s*\([^)]*\).*/, '').replace(/^Coffrets?\s+/i, '').trim() || opt.id,
      }));
    }
    return [{ value: STATIC_EQUIPMENT_SPECS.transFo.reference, label: STATIC_EQUIPMENT_SPECS.transFo.label }];
  }, [coffretOptions]);

  return (
    <SelectEquipmentToggle
      title="Coffret hybride"
      enabled={hasCoffretTransFo}
      onToggle={setHasCoffretTransFo}
      value={coffretReference}
      onChange={(val) => setCoffretReference?.(val)}
      options={selectOptions}
      fieldLabel="Référence"
      placeholder="Sélectionner une référence"
      icon={Box}
      autoSelectFirst={false}
      quantity={coffretTransFoQuantity}
      onQuantityChange={setCoffretTransFoQuantity}
    />
  );
}

export default CoffretTransFoEquipmentToggle;
