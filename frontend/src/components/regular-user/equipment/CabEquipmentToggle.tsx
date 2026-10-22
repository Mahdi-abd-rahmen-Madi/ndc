import React from 'react';
import { Server } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { EquipmentOptionCard } from '../../ui/EquipmentOptionCard';

export interface CabEquipmentToggleProps {
  hasCab: boolean;
  setHasCab: (val: boolean) => void;
  cabOne: boolean;
  setCabOne: (val: boolean) => void;
  cabTwo: boolean;
  setCabTwo: (val: boolean) => void;
  cabThree: boolean;
  setCabThree: (val: boolean) => void;
  cabSupport: string;
  setCabSupport: (val: string) => void;
}

export function CabEquipmentToggle({
  hasCab,
  setHasCab,
  cabOne,
  setCabOne,
  cabTwo,
  setCabTwo,
  cabThree,
  setCabThree,
  cabSupport,
  setCabSupport
}: CabEquipmentToggleProps) {
  const supportOptions = [
    { id: 'plinthes', label: 'Plinthes' },
    { id: 'support_autostable', label: 'Support Autostable' },
    { id: 'support_fimo', label: 'Support FIMO' },
    { id: 'support_muraux', label: 'Supports Muraux' }
  ];

  return (
    <EquipmentToggleCard
      title="Présence Baie CAB"
      enabled={hasCab}
      onToggle={(checked) => {
        setHasCab(checked);
        if (checked) {
          if (!cabOne && !cabTwo && !cabThree) {
            setCabOne(true);
          }
          if (!cabSupport) {
            setCabSupport('plinthes');
          }
        }
      }}
      icon={Server}
      color="rose"
      scopeBadgeText="1x par site"
    >
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Options CAB</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
          <EquipmentOptionCard
            title="CAB ONE"
            isSelected={cabOne}
            onToggle={setCabOne}
            color="red"
          />
          <EquipmentOptionCard
            title="CAB TWO"
            isSelected={cabTwo}
            onToggle={setCabTwo}
            color="red"
          />
          <EquipmentOptionCard
            title="CAB THREE"
            isSelected={cabThree}
            onToggle={setCabThree}
            color="red"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Supports</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {supportOptions.map((opt) => (
            <EquipmentOptionCard
              key={opt.id}
              title={opt.label}
              isSelected={cabSupport === opt.id}
              onToggle={() => setCabSupport(opt.id)}
              selectionType="radio"
              color="red"
            />
          ))}
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default CabEquipmentToggle;
