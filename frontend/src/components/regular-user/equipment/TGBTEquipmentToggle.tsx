import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { DEFAULT_TGBT_OPTIONS, STATIC_EQUIPMENT_SPECS } from '../../../config/catalogueDefaults';
import { SelectEquipmentToggle } from './shared/SelectEquipmentToggle';

export interface TGBTItem {
  id: string;
  name: string;
  reference: string;
  vendor?: string;
  supplier?: string;
  operator?: string;
  weight?: number;
  dimensions?: string;
}

export interface TGBTEquipmentToggleProps {
  hasTgbt: boolean;
  setHasTgbt: (val: boolean) => void;
  tgbtReference: string;
  setTgbtReference: (val: string) => void;
  options?: TGBTItem[];
}

export function TGBTEquipmentToggle({
  hasTgbt,
  setHasTgbt,
  tgbtReference,
  setTgbtReference,
  options = [],
}: TGBTEquipmentToggleProps) {
  const availableOptions = useMemo(
    () => (options.length > 0 ? options : DEFAULT_TGBT_OPTIONS),
    [options]
  );

  const selectOptions = useMemo(
    () =>
      availableOptions.map(opt => ({
        value: opt.reference || opt.name || opt.id,
        label: (opt.name || opt.reference || '').replace(/^TGBT\s+/i, ''),
      })),
    [availableOptions]
  );

  const selectedItem = useMemo(
    () =>
      availableOptions.find(
        o => o.id === tgbtReference || o.name === tgbtReference || o.reference === tgbtReference
      ) || availableOptions[0],
    [availableOptions, tgbtReference]
  );

  const specs = selectedItem
    ? [
        { label: 'Dimensions', value: selectedItem.dimensions || STATIC_EQUIPMENT_SPECS.tgbt.dimensions },
        { label: 'Poids', value: selectedItem.weight ? `${selectedItem.weight} kg` : `${STATIC_EQUIPMENT_SPECS.tgbt.weightKg} kg` },
      ]
    : undefined;

  return (
    <SelectEquipmentToggle
      title="TGBT"
      enabled={hasTgbt}
      onToggle={setHasTgbt}
      value={tgbtReference}
      onChange={setTgbtReference}
      options={selectOptions}
      fieldLabel="Modèle TGBT"
      placeholder="Sélectionner un TGBT"
      icon={Zap}
      specs={specs}
    />
  );
}

export default TGBTEquipmentToggle;
