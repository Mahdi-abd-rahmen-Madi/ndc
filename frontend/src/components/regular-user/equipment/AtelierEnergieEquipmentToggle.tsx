import React from 'react';
import { Zap } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { EquipmentOptionCard } from '../../ui/EquipmentOptionCard';

export interface AtelierEnergieEquipmentToggleProps {
  hasAtelierEnergie: boolean;
  setHasAtelierEnergie: (val: boolean) => void;
  atelierFprb: boolean;
  setAtelierFprb: (val: boolean) => void;
  atelierFprbQuantity?: number;
  setAtelierFprbQuantity?: (val: number) => void;
  atelierFpbc: boolean;
  setAtelierFpbc: (val: boolean) => void;
  atelierFpbcQuantity?: number;
  setAtelierFpbcQuantity?: (val: number) => void;
}

export function AtelierEnergieEquipmentToggle({
  hasAtelierEnergie,
  setHasAtelierEnergie,
  atelierFprb,
  setAtelierFprb,
  atelierFprbQuantity = 1,
  setAtelierFprbQuantity,
  atelierFpbc,
  setAtelierFpbc,
  atelierFpbcQuantity = 1,
  setAtelierFpbcQuantity
}: AtelierEnergieEquipmentToggleProps) {
  return (
    <EquipmentToggleCard
      title="Atelier d'énergie"
      enabled={hasAtelierEnergie}
      onToggle={(checked) => {
        setHasAtelierEnergie(checked);
        if (checked && !atelierFprb && !atelierFpbc) {
          setAtelierFprb(true);
        }
      }}
      icon={Zap}
      color="violet"
      scopeBadgeText="1x par site"
    >
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Modules d'énergie</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
        <EquipmentOptionCard
          title="Module d'énergie FPRB"
          isSelected={atelierFprb}
          onToggle={setAtelierFprb}
          quantity={atelierFprbQuantity}
          onQuantityChange={setAtelierFprbQuantity}
          color="amber"
        />

        <EquipmentOptionCard
          title="Module FPBC (batterie)"
          isSelected={atelierFpbc}
          onToggle={setAtelierFpbc}
          quantity={atelierFpbcQuantity}
          onQuantityChange={setAtelierFpbcQuantity}
          color="amber"
        />
      </div>
    </EquipmentToggleCard>
  );
}

export default AtelierEnergieEquipmentToggle;
