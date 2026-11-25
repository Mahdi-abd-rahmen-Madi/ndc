import { useEffect, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { DEFAULT_BOITIER_LOVAGE_OPTIONS } from '../../../config/catalogueDefaults';
import { SelectEquipmentToggle } from './shared/SelectEquipmentToggle';
import { EquipmentAncrageSelector, EquipmentFoundationType } from './shared/EquipmentAncrageSelector';
import { MastHeightInput } from './shared/MastHeightInput';
import { EquipmentEchelleSelector } from './shared/EquipmentEchelleSelector';

export interface BoitierLovageEquipmentToggleProps {
  hasBoitierLovage: boolean;
  setHasBoitierLovage: (val: boolean) => void;
  boitierLovageReference: string;
  setBoitierLovageReference: (val: string) => void;
  boitierLovageQuantity: number;
  setBoitierLovageQuantity: (val: number) => void;
  foundationType?: EquipmentFoundationType;
  setFoundationType?: (val: EquipmentFoundationType) => void;
  hauteurMatM?: number;
  setHauteurMatM?: (val: number) => void;
  echelle?: string;
  setEchelle?: (val: string) => void;
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
  foundationType = 'dallettes',
  setFoundationType,
  hauteurMatM = 1.50,
  setHauteurMatM,
  echelle = "Pas d'échelle",
  setEchelle,
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
    >
      {setHauteurMatM && (
        <MastHeightInput
          value={hauteurMatM}
          onChange={setHauteurMatM}
          defaultValue={1.50}
        />
      )}

      {setFoundationType && (
        <EquipmentAncrageSelector
          value={foundationType}
          onChange={setFoundationType}
          className="pt-2 border-t border-slate-200/70"
        />
      )}

      <EquipmentEchelleSelector
        foundationType={foundationType}
        hauteurMatM={hauteurMatM}
        defaultHauteurMatM={1.50}
        value={echelle}
        onChange={setEchelle}
        accentColor="violet"
      />
    </SelectEquipmentToggle>
  );
}

export default BoitierLovageEquipmentToggle;
