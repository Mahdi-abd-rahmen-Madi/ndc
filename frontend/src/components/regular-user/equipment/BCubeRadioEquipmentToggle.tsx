import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import { DEFAULT_BCUBE_RADIO_OPTIONS } from '../../../config/catalogueDefaults';
import { SelectEquipmentToggle } from './shared/SelectEquipmentToggle';

export { DEFAULT_BCUBE_RADIO_OPTIONS };

export interface BCubeRadioOption {
  id: string;
  name: string;
  reference: string;
}

export interface BCubeRadioEquipmentToggleProps {
  hasBcubeRadio: boolean;
  setHasBcubeRadio: (val: boolean) => void;
  bcubeRadioReference: string;
  setBcubeRadioReference: (val: string) => void;
  options?: BCubeRadioOption[];
}

export function BCubeRadioEquipmentToggle({
  hasBcubeRadio,
  setHasBcubeRadio,
  bcubeRadioReference,
  setBcubeRadioReference,
  options = [],
}: BCubeRadioEquipmentToggleProps) {
  const selectOptions = useMemo(() => {
    const src = options.length > 0 ? options : DEFAULT_BCUBE_RADIO_OPTIONS;
    return src.map(opt => ({
      value: opt.reference || opt.id,
      label: opt.name || opt.reference,
    }));
  }, [options]);

  return (
    <SelectEquipmentToggle
      title="BCube RADIO"
      enabled={hasBcubeRadio}
      onToggle={setHasBcubeRadio}
      value={bcubeRadioReference}
      onChange={setBcubeRadioReference}
      options={selectOptions}
      fieldLabel="CARTES RADIO BYTEL"
      placeholder="Sélectionner un CARTES RADIO BYTEL"
      icon={Radio}
    />
  );
}

export default BCubeRadioEquipmentToggle;
