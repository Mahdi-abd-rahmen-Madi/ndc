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

export type TGBTEmplacement = 'integre_bcube' | 'integre_mat';

export interface TGBTEquipmentToggleProps {
  hasTgbt: boolean;
  setHasTgbt: (val: boolean) => void;
  tgbtReference: string;
  setTgbtReference: (val: string) => void;
  tgbtEmplacement?: TGBTEmplacement;
  setTgbtEmplacement?: (val: TGBTEmplacement) => void;
  options?: TGBTItem[];
}

export function TGBTEquipmentToggle({
  hasTgbt,
  setHasTgbt,
  tgbtReference,
  setTgbtReference,
  tgbtEmplacement = 'integre_bcube',
  setTgbtEmplacement,
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
    >
      <div className="flex flex-col gap-1.5 pt-1">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          Emplacement du TGBT
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer font-medium whitespace-nowrap">
            <input
              type="radio"
              name="tgbtEmplacement"
              value="integre_bcube"
              checked={tgbtEmplacement === 'integre_bcube'}
              onChange={() => setTgbtEmplacement?.('integre_bcube')}
              className="text-violet-600 focus:ring-violet-500"
            />
            intégré au bcube
          </label>
          <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer font-medium whitespace-nowrap">
            <input
              type="radio"
              name="tgbtEmplacement"
              value="integre_mat"
              checked={tgbtEmplacement === 'integre_mat'}
              onChange={() => setTgbtEmplacement?.('integre_mat')}
              className="text-violet-600 focus:ring-violet-500"
            />
            intégré au mat
          </label>
        </div>
      </div>
    </SelectEquipmentToggle>
  );
}

export default TGBTEquipmentToggle;
