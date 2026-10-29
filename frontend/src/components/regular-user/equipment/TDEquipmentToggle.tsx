import React from 'react';
import { Activity } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';

export interface TDEquipmentToggleProps {
  hasTdEquipment: boolean;
  setHasTdEquipment: (val: boolean) => void;
  tdType: 'tetraphase' | 'monophase';
  setTdType: (val: 'tetraphase' | 'monophase') => void;
  tdReference: string;
  setTdReference: (val: string) => void;
  tgbtReference?: string;
  setTgbtReference?: (val: string) => void;
  tdOptions: { id: string; vendor: string; name: string; reference: string; weight: number; dimensions: string }[];
  operator?: string;
}

export function TDEquipmentToggle({
  hasTdEquipment,
  setHasTdEquipment,
  tdType,
  setTdType,
  tdReference,
  setTdReference,
  tdOptions,
  operator = 'bouygues'
}: TDEquipmentToggleProps) {
  const isMatchingType = (opt: any, type: 'tetraphase' | 'monophase') => {
    if (opt.phase) return opt.phase === type;
    if (type === 'tetraphase') return opt.reference === '68237' || opt.id === 'td_tri_free' || opt.id === 'td_68237';
    return opt.reference !== '68237' && opt.id !== 'td_tri_free' && opt.id !== 'td_68237';
  };

  React.useEffect(() => {
    if (hasTdEquipment) {
      const validOptions = tdOptions.filter(o => isMatchingType(o, tdType));
      if (!validOptions.some(o => o.id === tdReference)) {
        if (validOptions.length > 0) {
          setTdReference(validOptions[0].id);
        }
      }
    }
  }, [hasTdEquipment, tdType, tdOptions, tdReference, setTdReference]);

  const filteredTdOptions = tdOptions.filter(opt => isMatchingType(opt, tdType));

  return (
    <EquipmentToggleCard
      title="Présence TD"
      enabled={hasTdEquipment}
      onToggle={setHasTdEquipment}
      icon={Activity}
      color="violet"
      scopeBadgeText="1x par site"
    >
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
          <input
            type="radio"
            checked={tdType === 'tetraphase'}
            onChange={() => setTdType('tetraphase')}
            className="text-violet-600 focus:ring-violet-500"
          />
          TD Tétraphasé
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
          <input
            type="radio"
            checked={tdType === 'monophase'}
            onChange={() => setTdType('monophase')}
            className="text-violet-600 focus:ring-violet-500"
          />
          TD Monophasé
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col w-full md:w-1/2 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Équipement</label>
          <CustomSelect
            value={tdReference}
            onChange={(val) => setTdReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={filteredTdOptions.map(opt => ({
              value: opt.id,
              label: opt.vendor ? `${opt.vendor} - ${opt.name}` : opt.name
            }))}
            placeholder="Sélectionner un équipement"
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default TDEquipmentToggle;
