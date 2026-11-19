import { Box } from 'lucide-react';
import { STATIC_EQUIPMENT_SPECS } from '../../../config/catalogueDefaults';
import { QuantityOnlyEquipmentToggle } from './shared/QuantityOnlyEquipmentToggle';

export interface BoitierJonctionEquipmentToggleProps {
  hasBoitierJonction: boolean;
  setHasBoitierJonction: (val: boolean) => void;
  boitierJonctionQuantity?: number;
  setBoitierJonctionQuantity?: (val: number) => void;
  disabled?: boolean;
  disabledReason?: string;
  foundationType?: 'metallique' | 'beton' | 'dallettes';
  setFoundationType?: (val: 'metallique' | 'beton' | 'dallettes') => void;
}

const SPECS = [
  { label: 'Marque', value: STATIC_EQUIPMENT_SPECS.boitierJonction.marque },
  { label: 'Dimensions', value: STATIC_EQUIPMENT_SPECS.boitierJonction.dimensionsDisplay },
];

export function BoitierJonctionEquipmentToggle({
  hasBoitierJonction,
  setHasBoitierJonction,
  boitierJonctionQuantity = 1,
  setBoitierJonctionQuantity,
  disabled = false,
  disabledReason,
  foundationType,
  setFoundationType,
}: BoitierJonctionEquipmentToggleProps) {
  return (
    <QuantityOnlyEquipmentToggle
      title="Présence Boitier de jonction FO"
      enabled={hasBoitierJonction}
      onToggle={setHasBoitierJonction}
      quantity={boitierJonctionQuantity}
      onQuantityChange={setBoitierJonctionQuantity}
      staticSpecs={SPECS}
      icon={Box}
      scopeBadgeText="Par secteur"
      disabled={disabled}
      disabledReason={disabledReason}
      foundationType={foundationType}
      onFoundationTypeChange={setFoundationType}
    />
  );
}

export default BoitierJonctionEquipmentToggle;
