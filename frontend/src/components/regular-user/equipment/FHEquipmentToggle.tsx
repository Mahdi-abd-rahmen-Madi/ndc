import React, { useMemo, useCallback } from 'react';
import type { EquipmentItem } from '../types';
import { MultiRowEquipmentToggle } from './shared/MultiRowEquipmentToggle';
import { DEFAULT_FH_REFERENCES, FHCatalogItem } from '../../../config/catalogueDefaults';

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
  fhWeight?: number;
  setFhWeight?: (val: number) => void;
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
  fhDiameter,
  setFhDiameter,
  fhReference = '',
  setFhReference,
  fhQuantity = 1,
  setFhQuantity,
  fhWeight,
  setFhWeight,
  fhOptions = [],
  disabled = false,
  disabledReason,
  foundationType,
  setFoundationType,
}: FHEquipmentToggleProps) {
  const allFhOptions: (FHEquipmentOption | FHCatalogItem)[] = useMemo(() => {
    return fhOptions && fhOptions.length > 0 ? fhOptions : DEFAULT_FH_REFERENCES;
  }, [fhOptions]);

  const options = useMemo(
    () => allFhOptions.map(o => ({ id: o.id, vendor: o.vendor, label: o.name })),
    [allFhOptions]
  );

  const uniqueVendors = useMemo(
    () => Array.from(new Set(allFhOptions.map(o => o.vendor))),
    [allFhOptions]
  );

  const items: EquipmentItem[] = useMemo(() => {
    if (fhItems && fhItems.length > 0) return fhItems.slice(0, 1);
    const matchingOption = allFhOptions.find(o => o.id === fhReference || o.reference === fhReference);
    return [{
      id: 'default-fh-item',
      vendor: matchingOption?.vendor || (uniqueVendors.length === 1 ? uniqueVendors[0] : undefined),
      reference: fhReference || matchingOption?.id || '',
      quantity: fhQuantity || 1,
    }];
  }, [fhItems, fhReference, fhQuantity, allFhOptions, uniqueVendors]);

  const handleItemsChange = useCallback(
    (updater: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => {
      const resolved = (typeof updater === 'function' ? updater(items) : updater).slice(0, 1);
      // Enrich items with diameter and weight if matched in catalog
      const enriched = resolved.map(item => {
        const opt = allFhOptions.find(o => o.id === item.reference || o.reference === item.reference);
        return {
          ...item,
          vendor: item.vendor || opt?.vendor,
          diameter_mm: opt ? opt.diameter : item.diameter_mm,
          weight_kg: opt ? opt.weight : item.weight_kg,
        };
      });

      setFhItems?.(enriched);

      const firstItem = enriched[0];
      if (firstItem) {
        setFhReference?.(firstItem.reference || '');
        setFhQuantity?.(firstItem.quantity || 1);
        const opt = allFhOptions.find(o => o.id === firstItem.reference || o.reference === firstItem.reference);
        if (opt) {
          setFhDiameter?.(opt.diameter);
          setFhWeight?.(opt.weight);
        }
      }
    },
    [items, setFhItems, setFhReference, setFhQuantity, setFhDiameter, setFhWeight, allFhOptions]
  );

  return (
    <MultiRowEquipmentToggle
      title="Présence FH"
      enabled={hasFhEquipment}
      onToggle={setHasFhEquipment}
      items={items}
      onItemsChange={handleItemsChange}
      options={options}
      scopeBadgeText="par secteur"
      allowMultiple={false}
      selectRingClass="focus:ring-2 focus:ring-amber-500"
      color="amber"
      quantityLabel="Qté :"
      disabled={disabled}
      disabledReason={disabledReason}
      foundationType={foundationType}
      onFoundationTypeChange={setFoundationType}
    />
  );
}

export default FHEquipmentToggle;
