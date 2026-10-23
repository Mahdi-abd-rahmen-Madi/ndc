import React from 'react';
import { Activity } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { QuantityInput } from '../../ui/QuantityInput';

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
  operator
}: BoitierLovageEquipmentToggleProps) {
  const defaultOptions = [
    { id: 'BLM-515709', name: 'Boîte de dérivation OPTIBOX IP55', reference: 'BLM-515709', operator: 'free' }
  ];

  const allOptions = boitierOptions.length > 0 ? boitierOptions : defaultOptions;

  const options = allOptions.filter(opt => {
    if (!opt.operator || opt.operator === 'all') return true;
    if (operator) return opt.operator.toLowerCase() === operator.toLowerCase();
    return true;
  });

  React.useEffect(() => {
    if (options.length === 0) {
      if (hasBoitierLovage) setHasBoitierLovage(false);
      if (boitierLovageReference) setBoitierLovageReference('');
    } else if (hasBoitierLovage && !boitierLovageReference) {
      setBoitierLovageReference(options[0].id);
    }
  }, [hasBoitierLovage, boitierLovageReference, options, setBoitierLovageReference, setHasBoitierLovage]);

  if (options.length === 0) {
    return null;
  }

  return (
    <EquipmentToggleCard
      title="Présence Boitiers de lovage"
      enabled={hasBoitierLovage}
      onToggle={setHasBoitierLovage}
      icon={Activity}
      color="violet"
      scopeBadgeText="1x par site"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <QuantityInput
          value={boitierLovageQuantity}
          onChange={setBoitierLovageQuantity}
          label="Qté :"
          size="md"
        />

        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Référence
          </label>
          <CustomSelect
            value={boitierLovageReference}
            onChange={(val) => setBoitierLovageReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={options.map((opt) => ({
              value: opt.id,
              label: opt.reference
            }))}
            placeholder="Sélectionner une référence"
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default BoitierLovageEquipmentToggle;
