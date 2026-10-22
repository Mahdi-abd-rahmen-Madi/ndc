import React from 'react';
import { Zap } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { QuantityInput } from '../../ui/QuantityInput';

export interface ConvertisseurMdeaEquipmentToggleProps {
  hasConvertisseurMdea: boolean;
  setHasConvertisseurMdea: (val: boolean) => void;
  convertisseurMdeaQuantity: number;
  setConvertisseurMdeaQuantity: (val: number) => void;
}

export function ConvertisseurMdeaEquipmentToggle({
  hasConvertisseurMdea,
  setHasConvertisseurMdea,
  convertisseurMdeaQuantity,
  setConvertisseurMdeaQuantity
}: ConvertisseurMdeaEquipmentToggleProps) {
  return (
    <EquipmentToggleCard
      title="Présence convertisseur MDEA"
      enabled={hasConvertisseurMdea}
      onToggle={setHasConvertisseurMdea}
      icon={Zap}
      color="violet"
    >
      <div className="flex flex-col gap-3">
        <QuantityInput
          value={convertisseurMdeaQuantity || 1}
          onChange={setConvertisseurMdeaQuantity}
          label="Qté :"
          size="md"
        />
      </div>
    </EquipmentToggleCard>
  );
}

export default ConvertisseurMdeaEquipmentToggle;
