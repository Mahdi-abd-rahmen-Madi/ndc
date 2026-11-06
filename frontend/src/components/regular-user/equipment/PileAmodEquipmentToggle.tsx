import React from 'react';
import { Layers } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { EquipmentOptionCard } from '../../ui/EquipmentOptionCard';

export interface AmodSubModule {
  id: string;
  reference: string;
  name: string;
  type: string;
  weight: number;
}

export const AMOD_MODULES_LIST: AmodSubModule[] = [
  { id: 'asib', reference: 'ASIB', name: 'Sous-module ASIB', type: 'Gestion 4G', weight: 2.4 },
  { id: 'asik', reference: 'ASIK', name: 'Sous-module ASIK', type: 'Gestion 5G', weight: 2.4 },
  { id: 'abia', reference: 'ABIA', name: 'Sous-module ABIA', type: 'Capacité 4G', weight: 2.4 },
  { id: 'abil', reference: 'ABIL', name: 'Sous-module ABIL', type: 'Capacité 5G', weight: 2.4 },
  { id: 'abio', reference: 'ABIO', name: 'Carte ABIO', type: 'Capacité 4G/5G', weight: 2.4 },
];

export interface PileAmodEquipmentToggleProps {
  hasPileAmod: boolean;
  setHasPileAmod: (val: boolean) => void;
  amodModules: Record<string, { enabled: boolean; quantity: number }>;
  setAmodModules: (val: Record<string, { enabled: boolean; quantity: number }>) => void;
}

export function PileAmodEquipmentToggle({
  hasPileAmod,
  setHasPileAmod,
  amodModules,
  setAmodModules,
}: PileAmodEquipmentToggleProps) {
  const toggleModule = (id: string, enabled: boolean) => {
    setAmodModules({
      ...amodModules,
      [id]: {
        enabled,
        quantity: amodModules[id]?.quantity || 1,
      },
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    setAmodModules({
      ...amodModules,
      [id]: {
        enabled: amodModules[id]?.enabled ?? true,
        quantity: Math.max(1, quantity),
      },
    });
  };

  const selectedCount = Object.values(amodModules).filter(m => m.enabled).length;

  return (
    <EquipmentToggleCard
      title="Pile système AMOD"
      enabled={hasPileAmod}
      onToggle={(checked) => {
        setHasPileAmod(checked);
        if (checked && selectedCount === 0) {
          // By default enable ASIB (Gestion 4G) and ASIK (Gestion 5G)
          setAmodModules({
            ...amodModules,
            asib: { enabled: true, quantity: 1 },
            asik: { enabled: true, quantity: 1 },
          });
        }
      }}
      icon={Layers}
      color="rose"
      scopeBadgeText="1x par site (Nokia)"
      headerRightContent={
        hasPileAmod ? (
          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
          </span>
        ) : null
      }
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <span>Sous-modules et cartes de capacité</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold normal-case tracking-normal border border-slate-200">
            Constructeur : Nokia
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-0.5">
          {AMOD_MODULES_LIST.map((mod) => {
            const current = amodModules[mod.id] || { enabled: false, quantity: 1 };
            return (
              <EquipmentOptionCard
                key={mod.id}
                title={mod.name}
                isSelected={current.enabled}
                onToggle={(val) => toggleModule(mod.id, val)}
                badgeText={mod.type}
                badgePosition="below-title"
                badgeClass="bg-rose-50 text-rose-700 border-rose-200"
                quantity={current.quantity}
                onQuantityChange={(qty) => updateQuantity(mod.id, qty)}
                color="red"
              />
            );
          })}
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default PileAmodEquipmentToggle;
