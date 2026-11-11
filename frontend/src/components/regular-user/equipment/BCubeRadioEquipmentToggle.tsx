import React, { useEffect } from 'react';
import { Radio } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';

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

export const DEFAULT_BCUBE_RADIO_OPTIONS: BCubeRadioOption[] = [
  { id: 'bcube_radio_rp6647_5g_tdd', name: 'RP6647 5G TDD', reference: 'RP6647 5G TDD' },
  { id: 'bcube_radio_bb6631_4_5g', name: 'BB6631 4/5G', reference: 'BB6631 4/5G' },
  { id: 'bcube_radio_bb6631_2_3_4g', name: 'BB6631 2/3/4G', reference: 'BB6631 2/3/4G' },
  { id: 'bcube_radio_bb631_2_3_4g', name: 'BB631 2/3/4G', reference: 'BB631 2/3/4G' }
];

export function BCubeRadioEquipmentToggle({
  hasBcubeRadio,
  setHasBcubeRadio,
  bcubeRadioReference,
  setBcubeRadioReference,
  options = []
}: BCubeRadioEquipmentToggleProps) {
  const availableOptions = options.length > 0 ? options : DEFAULT_BCUBE_RADIO_OPTIONS;

  useEffect(() => {
    if (hasBcubeRadio && !bcubeRadioReference && availableOptions.length > 0) {
      setBcubeRadioReference(availableOptions[0].reference || availableOptions[0].id);
    }
  }, [hasBcubeRadio, bcubeRadioReference, availableOptions, setBcubeRadioReference]);

  const selectedValue = bcubeRadioReference || availableOptions[0]?.reference;

  return (
    <EquipmentToggleCard
      title="BCube RADIO"
      enabled={hasBcubeRadio}
      onToggle={(checked: boolean) => {
        setHasBcubeRadio(checked);
        if (checked && !bcubeRadioReference && availableOptions.length > 0) {
          setBcubeRadioReference(availableOptions[0].reference || availableOptions[0].id);
        }
      }}
      icon={Radio}
      color="violet"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Modèle BCube RADIO
          </label>
          <CustomSelect
            value={selectedValue}
            onChange={(val) => setBcubeRadioReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={availableOptions.map(opt => ({
              value: opt.reference || opt.id,
              label: opt.name || opt.reference
            }))}
            placeholder="Sélectionner un modèle BCube RADIO"
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default BCubeRadioEquipmentToggle;

