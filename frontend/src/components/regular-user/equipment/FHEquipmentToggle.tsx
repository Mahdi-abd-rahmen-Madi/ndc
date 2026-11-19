import { useMemo, useCallback } from 'react';
import type { EquipmentItem } from '../types';
import { MultiRowEquipmentToggle } from './shared/MultiRowEquipmentToggle';

export interface FHEquipmentOption {
  id: string;
  vendor: string;
  name: string;
  reference?: string;
  diameter: number;
  weight: number;
}

export interface FHEquipmentToggleProps {
  hasFhEquipment: boolean;
  setHasFhEquipment: (val: boolean) => void;
  fhItems?: EquipmentItem[];
  setFhItems?: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  fhDiameter?: number;
  setFhDiameter?: (val: number) => void;
  fhReference?: string;
  setFhReference?: (val: string) => void;
  fhQuantity?: number;
  setFhQuantity?: (val: number) => void;
  fhOptions?: FHEquipmentOption[];
  nombreSecteurs?: number;
  disabled?: boolean;
  disabledReason?: string;
  foundationType?: 'metallique' | 'beton' | 'dallettes';
  setFoundationType?: (val: 'metallique' | 'beton' | 'dallettes') => void;
}

export function FHEquipmentToggle({
  hasFhEquipment,
  setHasFhEquipment,
  fhItems,
  setFhItems,
  setFhDiameter,
  fhReference = '',
  setFhReference,
  fhQuantity = 1,
  setFhQuantity,
  fhOptions = [],
  disabled = false,
  disabledReason,
  foundationType,
  setFoundationType,
}: FHEquipmentToggleProps) {
  const options = useMemo(
    () => fhOptions.map(o => ({ id: o.id, vendor: o.vendor, label: o.name })),
    [fhOptions]
  );

  const uniqueVendors = useMemo(
    () => Array.from(new Set(fhOptions.map(o => o.vendor))),
    [fhOptions]
  );

  const items: EquipmentItem[] = useMemo(() => {
    if (fhItems && fhItems.length > 0) return fhItems;
    const matchingOption = fhOptions.find(o => o.id === fhReference);
    return [{
      id: 'default-fh-item',
      vendor: matchingOption?.vendor || (uniqueVendors.length === 1 ? uniqueVendors[0] : undefined),
      reference: fhReference || '',
      quantity: fhQuantity || 1,
    }];
  }, [fhItems, fhReference, fhQuantity, fhOptions, uniqueVendors]);

  const handleItemsChange = useCallback(
    (updater: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => {
      const resolved = typeof updater === 'function' ? updater(items) : updater;
      setFhItems?.(resolved);
      const firstItem = resolved[0];
      if (firstItem) {
        setFhReference?.(firstItem.reference || '');
        setFhQuantity?.(firstItem.quantity || 1);
        if (setFhDiameter) {
          const opt = fhOptions.find(o => o.id === firstItem.reference);
          if (opt) setFhDiameter(opt.diameter);
        }
      }
    },
    [items, setFhItems, setFhReference, setFhQuantity, setFhDiameter, fhOptions]
  );

  return (
    <MultiRowEquipmentToggle
      title="Présence FH"
      enabled={hasFhEquipment}
      onToggle={setHasFhEquipment}
      items={items}
      onItemsChange={handleItemsChange}
      options={options}
      scopeBadgeText="par site"
      selectRingClass="focus:ring-2 focus:ring-violet-500"
      quantityLabel="Qté :"
      disabled={disabled}
      disabledReason={disabledReason}
      foundationType={foundationType}
      onFoundationTypeChange={setFoundationType}
    />
  );
}

export default FHEquipmentToggle;
