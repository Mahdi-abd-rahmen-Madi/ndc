import { useMemo } from 'react';
import type { EquipmentItem } from '../types';
import { MultiRowEquipmentToggle } from './shared/MultiRowEquipmentToggle';

export interface RRHEquipmentToggleProps {
  hasRrhEquipment: boolean;
  setHasRrhEquipment: (val: boolean) => void;
  rrhItems: EquipmentItem[];
  setRrhItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rrhOptions: { id: string; vendor: string; reference: string; operator?: string }[];
  operator?: string;
  nombreSecteurs?: number;
  disabled?: boolean;
  disabledReason?: string;
  foundationType?: 'metallique' | 'beton' | 'dallettes';
  setFoundationType?: (val: 'metallique' | 'beton' | 'dallettes') => void;
  hauteurMatM?: number;
  setHauteurMatM?: (val: number) => void;
}

export function RRHEquipmentToggle({
  hasRrhEquipment,
  setHasRrhEquipment,
  rrhItems,
  setRrhItems,
  rrhOptions,
  operator = 'free',
  nombreSecteurs = 1,
  disabled = false,
  disabledReason,
  foundationType,
  setFoundationType,
  hauteurMatM,
  setHauteurMatM,
}: RRHEquipmentToggleProps) {
  const options = useMemo(
    () =>
      rrhOptions
        .filter(o => (o.operator ? o.operator.toLowerCase() === operator.toLowerCase() : false))
        .map(o => ({ id: o.id, vendor: o.vendor, label: o.reference })),
    [rrhOptions, operator]
  );

  return (
    <MultiRowEquipmentToggle
      title="Présence RRH"
      enabled={hasRrhEquipment}
      onToggle={setHasRrhEquipment}
      items={rrhItems}
      onItemsChange={setRrhItems}
      options={options}
      scopeBadgeText="Par secteur"
      selectRingClass="focus:ring-2 focus:ring-rose-500"
      unitLabel="/ secteur"
      maxRows={6}
      nombreSecteurs={nombreSecteurs}
      disabled={disabled}
      disabledReason={disabledReason}
      foundationType={foundationType}
      onFoundationTypeChange={setFoundationType}
      hauteurMatM={hauteurMatM}
      onHauteurMatMChange={setHauteurMatM}
      defaultHauteurMatM={1.50}
    />
  );
}

export default RRHEquipmentToggle;
