import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { DEFAULT_TD_OPTIONS } from '../../../config/catalogueDefaults';
import { EquipmentAncrageSelector, EquipmentFoundationType } from './shared/EquipmentAncrageSelector';
import { MastHeightInput } from './shared/MastHeightInput';

export interface TDEquipmentToggleProps {
  hasTdEquipment: boolean;
  setHasTdEquipment: (val: boolean) => void;
  tdType: 'tetraphase' | 'monophase';
  setTdType: (val: 'tetraphase' | 'monophase') => void;
  tdReference: string;
  setTdReference: (val: string) => void;
  tgbtReference?: string;
  setTgbtReference?: (val: string) => void;
  foundationType?: EquipmentFoundationType;
  setFoundationType?: (val: EquipmentFoundationType) => void;
  hauteurMatM?: number;
  setHauteurMatM?: (val: number) => void;
  tdOptions?: { id: string; vendor?: string; name: string; reference?: string; weight?: number; dimensions?: string; phase?: string }[];
  operator?: string;
}

export function TDEquipmentToggle({
  hasTdEquipment,
  setHasTdEquipment,
  tdType,
  setTdType,
  tdReference,
  setTdReference,
  foundationType = 'dallettes',
  setFoundationType,
  hauteurMatM = 1.70,
  setHauteurMatM,
  tdOptions = [],
  operator = 'free'
}: TDEquipmentToggleProps) {
  const availableOptions = useMemo(() => {
    return tdOptions && tdOptions.length > 0 ? tdOptions : DEFAULT_TD_OPTIONS;
  }, [tdOptions]);

  const isMatchingType = (opt: any, type: 'tetraphase' | 'monophase') => {
    if (opt.phase) return opt.phase === type;
    if (type === 'tetraphase') return opt.reference === '68237' || opt.id === 'td_tri_free' || opt.id === 'td_68237';
    return opt.reference !== '68237' && opt.id !== 'td_tri_free' && opt.id !== 'td_68237';
  };

  const filteredTdOptions = useMemo(() => {
    return availableOptions.filter(opt => isMatchingType(opt, tdType));
  }, [availableOptions, tdType]);

  React.useEffect(() => {
    if (hasTdEquipment) {
      if (!filteredTdOptions.some(o => o.id === tdReference)) {
        if (filteredTdOptions.length > 0) {
          setTdReference(filteredTdOptions[0].id);
        }
      }
    }
  }, [hasTdEquipment, tdType, filteredTdOptions, tdReference, setTdReference]);

  return (
    <EquipmentToggleCard
      title="Présence TD"
      enabled={hasTdEquipment}
      onToggle={setHasTdEquipment}
      icon={Activity}
      color="violet"
      scopeBadgeText="par site"
    >
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer font-medium whitespace-nowrap">
          <input
            type="radio"
            checked={tdType === 'tetraphase'}
            onChange={() => setTdType('tetraphase')}
            className="text-violet-600 focus:ring-violet-500"
          />
          TD 5G V5
        </label>
        <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer font-medium whitespace-nowrap">
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
        <div className="flex flex-col w-full min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Équipement</label>
          <CustomSelect
            value={tdReference}
            onChange={(val) => setTdReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={filteredTdOptions.map(opt => ({
              value: opt.id,
              label: (opt.name || opt.reference || '').replace(/^FREE\s*[-–]?\s*/i, '').trim()
            }))}
            placeholder="Sélectionner un équipement"
          />
        </div>
      </div>

      {setFoundationType && (
        <EquipmentAncrageSelector
          value={foundationType}
          onChange={setFoundationType}
          className="pt-2 border-t border-slate-200/70"
        />
      )}

      {setHauteurMatM && (
        <MastHeightInput
          value={hauteurMatM}
          onChange={setHauteurMatM}
          defaultValue={1.70}
        />
      )}
    </EquipmentToggleCard>
  );
}

export default TDEquipmentToggle;
