import React, { useEffect } from 'react';
import { Zap } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { EquipmentSpecsGrid } from '../../ui/EquipmentSpecsGrid';

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

const DEFAULT_TGBT_OPTIONS: TGBTItem[] = [
  { id: 'tgbt_actia', name: 'TGBT ACTIA', reference: 'TGBT ACTIA', vendor: 'ACTIA', operator: 'bouygues', dimensions: '500x400x230mm', weight: 15 },
  { id: 'tgbt_tlti', name: 'TGBT TLTI', reference: 'TGBT TLTI', vendor: 'TLTI', operator: 'bouygues', dimensions: '500x400x230mm', weight: 15 }
];

export function TGBTEquipmentToggle({
  hasTgbt,
  setHasTgbt,
  tgbtReference,
  setTgbtReference,
  options = []
}: TGBTEquipmentToggleProps) {
  const availableOptions = options.length > 0 ? options : DEFAULT_TGBT_OPTIONS;

  useEffect(() => {
    if (hasTgbt && !tgbtReference && availableOptions.length > 0) {
      setTgbtReference(availableOptions[0].reference || availableOptions[0].name || availableOptions[0].id);
    }
  }, [hasTgbt, tgbtReference, setTgbtReference, availableOptions]);

  const selectedItem = availableOptions.find(
    o => o.id === tgbtReference || o.name === tgbtReference || o.reference === tgbtReference
  ) || availableOptions[0];

  return (
    <EquipmentToggleCard
      title="TGBT"
      enabled={hasTgbt}
      onToggle={(checked: boolean) => {
        setHasTgbt(checked);
        if (checked && !tgbtReference && availableOptions.length > 0) {
          setTgbtReference(availableOptions[0].reference || availableOptions[0].name || availableOptions[0].id);
        }
      }}
      icon={Zap}
      scopeBadgeText="Bouygues"
      color="violet"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Modèle TGBT
          </label>
          <CustomSelect
            value={tgbtReference || availableOptions[0]?.reference || 'TGBT ACTIA'}
            onChange={(val) => setTgbtReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={availableOptions.map(opt => ({
              value: opt.reference || opt.name || opt.id,
              label: opt.name || opt.reference
            }))}
            placeholder="Sélectionner un TGBT"
          />
        </div>

        {selectedItem && (
          <EquipmentSpecsGrid
            columns={2}
            items={[
              { label: 'Dimensions', value: selectedItem.dimensions || '500x400x230mm' },
              { label: 'Poids', value: selectedItem.weight ? `${selectedItem.weight} kg` : '15 kg' }
            ]}
          />
        )}
      </div>
    </EquipmentToggleCard>
  );
}

export default TGBTEquipmentToggle;
