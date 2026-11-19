import { Zap } from 'lucide-react';
import { QuantityOnlyEquipmentToggle } from './shared/QuantityOnlyEquipmentToggle';

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
  setConvertisseurMdeaQuantity,
}: ConvertisseurMdeaEquipmentToggleProps) {
  return (
    <QuantityOnlyEquipmentToggle
      title="Présence convertisseur MDEA"
      enabled={hasConvertisseurMdea}
      onToggle={setHasConvertisseurMdea}
      quantity={convertisseurMdeaQuantity}
      onQuantityChange={setConvertisseurMdeaQuantity}
      icon={Zap}
      scopeBadgeText="par site"
    />
  );
}

export default ConvertisseurMdeaEquipmentToggle;
