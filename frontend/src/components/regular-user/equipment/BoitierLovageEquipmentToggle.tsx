import { useEffect, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { DEFAULT_BOITIER_LOVAGE_OPTIONS } from '../../../config/catalogueDefaults';
import { SelectEquipmentToggle } from './shared/SelectEquipmentToggle';

export interface BoitierLovageEquipmentToggleProps {
  hasBoitierLovage: boolean;
  setHasBoitierLovage: (val: boolean) => void;
  boitierLovageReference: string;
  setBoitierLovageReference: (val: string) => void;
  boitierLovageQuantity: number;
  setBoitierLovageQuantity: (val: number) => void;
  boitierOptions?: any[];
  operator?: string;
}

export function BoitierLovageEquipmentToggle({
  hasBoitierLovage,
  setHasBoitierLovage,
  boitierLovageReference,
  setBoitierLovageReference,
  boitierLovageQuantity,
  setBoitierLovageQuantity,
  boitierOptions = [],
  operator,
}: BoitierLovageEquipmentToggleProps) {
  const selectOptions = useMemo(() => {
    const src = boitierOptions.length > 0 ? boitierOptions : DEFAULT_BOITIER_LOVAGE_OPTIONS;
    return src
      .filter(opt => {
        if (!opt.operator || opt.operator === 'all') return true;
        if (operator) return opt.operator.toLowerCase() === operator.toLowerCase();
        return true;
      })
      .map(opt => ({ value: opt.id, label: opt.reference }));
  }, [boitierOptions, operator]);

  useEffect(() => {
    if (selectOptions.length === 0) {
      if (hasBoitierLovage) setHasBoitierLovage(false);
      if (boitierLovageReference) setBoitierLovageReference('');
    }
  }, [selectOptions.length, hasBoitierLovage, boitierLovageReference, setHasBoitierLovage, setBoitierLovageReference]);

  if (selectOptions.length === 0 && operator !== 'free') {
    return null;
  }

  return (
    <SelectEquipmentToggle
      title="Présence Boitiers de lovage"
      enabled={hasBoitierLovage}
      onToggle={setHasBoitierLovage}
      value={boitierLovageReference}
      onChange={setBoitierLovageReference}
      options={selectOptions}
      fieldLabel="Référence"
      placeholder="Sélectionner une référence"
      icon={Activity}
      scopeBadgeText="par site"
      quantity={boitierLovageQuantity}
      onQuantityChange={setBoitierLovageQuantity}
      quantityPosition="top-inline"
    />
  );
}

export default BoitierLovageEquipmentToggle;
