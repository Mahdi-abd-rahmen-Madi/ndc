import React, { useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { QuantityInput } from '../../ui/QuantityInput';
import type { EquipmentItem } from '../../RegularUserView';

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
}

export function FHEquipmentToggle({
  hasFhEquipment,
  setHasFhEquipment,
  fhItems,
  setFhItems,
  fhDiameter = 300,
  setFhDiameter,
  fhReference = '',
  setFhReference,
  fhQuantity = 1,
  setFhQuantity,
  fhOptions = [],
  disabled = false,
  disabledReason
}: FHEquipmentToggleProps) {
  const uniqueVendors = useMemo(() => {
    return Array.from(new Set(fhOptions.map(o => o.vendor)));
  }, [fhOptions]);

  // Normalize items: support both multi-item fhItems and legacy single props fallback
  const items: EquipmentItem[] = useMemo(() => {
    if (fhItems && fhItems.length > 0) {
      return fhItems;
    }
    const matchingOption = fhOptions.find(o => o.id === fhReference);
    return [{
      id: 'default-fh-item',
      vendor: matchingOption?.vendor || (uniqueVendors.length === 1 ? uniqueVendors[0] : undefined),
      reference: fhReference || '',
      quantity: fhQuantity || 1
    }];
  }, [fhItems, fhReference, fhQuantity, fhOptions, uniqueVendors]);

  const updateItems = (newItems: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => {
    const resolvedItems = typeof newItems === 'function' ? newItems(items) : newItems;
    if (setFhItems) {
      setFhItems(resolvedItems);
    }
    // Also keep backward compatibility with single-value props for sector 1
    const firstItem = resolvedItems[0];
    if (firstItem) {
      if (setFhReference) setFhReference(firstItem.reference || '');
      if (setFhQuantity) setFhQuantity(firstItem.quantity || 1);
      if (setFhDiameter) {
        const opt = fhOptions.find(o => o.id === firstItem.reference);
        if (opt) setFhDiameter(opt.diameter);
      }
    }
  };

  const addFhRow = () => {
    updateItems(prev => [...prev, {
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: uniqueVendors.length === 1 ? uniqueVendors[0] : undefined
    }]);
  };

  const removeFhRow = (id: string) => {
    if (items.length > 1) {
      updateItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateFhItem = (id: string, field: 'reference' | 'quantity' | 'vendor', value: any) => {
    updateItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'vendor') {
          return { ...item, vendor: value, reference: '' };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Sanitize references if options change
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const current = itemsRef.current;
    let hasChanges = false;

    const sanitized = current.map(item => {
      let updated = { ...item };
      let itemChanged = false;

      if (uniqueVendors.length === 1 && updated.vendor !== uniqueVendors[0]) {
        updated.vendor = uniqueVendors[0];
        updated.reference = '';
        itemChanged = true;
      } else if (updated.vendor && !uniqueVendors.includes(updated.vendor)) {
        updated.vendor = uniqueVendors.length === 1 ? uniqueVendors[0] : undefined;
        updated.reference = '';
        itemChanged = true;
      }

      if (updated.reference) {
        const exists = fhOptions.some(o => o.id === updated.reference && (!updated.vendor || o.vendor === updated.vendor));
        if (!exists) {
          updated.reference = '';
          itemChanged = true;
        }
      }

      if (itemChanged) {
        hasChanges = true;
        return updated;
      }
      return item;
    });

    if (hasChanges) {
      updateItems(sanitized);
    }
  }, [fhOptions, uniqueVendors]);

  const isFhIncomplete = hasFhEquipment && (items.length === 0 || items.some(i => !i.vendor || !i.reference));

  return (
    <EquipmentToggleCard
      title="Présence FH"
      enabled={hasFhEquipment}
      onToggle={setHasFhEquipment}
      disabled={disabled}
      disabledReason={disabledReason}
      color="violet"
      scopeBadgeText="par site"
      isIncomplete={isFhIncomplete}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${
            (!item.vendor || !item.reference)
              ? 'bg-amber-50/20 border-amber-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex gap-3">
            {/* Marque */}
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                Marque
                {!item.vendor && <span className="text-amber-600 font-bold">*</span>}
              </label>
              <CustomSelect
                value={item.vendor || ''}
                onChange={(val) => updateFhItem(item.id, 'vendor', val)}
                className="focus:ring-2 focus:ring-violet-500"
                options={uniqueVendors.map(vendor => ({ value: vendor, label: vendor }))}
                placeholder="Sélectionner"
                error={!item.vendor}
              />
            </div>

            {/* Modèle */}
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                Modèle
                {!item.reference && <span className="text-amber-600 font-bold">*</span>}
              </label>
              <CustomSelect
                value={item.reference}
                onChange={(val) => updateFhItem(item.id, 'reference', val)}
                disabled={!item.vendor}
                className="focus:ring-2 focus:ring-violet-500"
                options={fhOptions
                  .filter(o => o.vendor === item.vendor)
                  .map(opt => {
                    const isSelectedElsewhere = items.some(
                      otherItem => otherItem.id !== item.id && otherItem.reference === opt.id
                    );
                    return {
                      value: opt.id,
                      label: opt.name + (isSelectedElsewhere ? ' (Déjà utilisé)' : ''),
                      disabled: isSelectedElsewhere
                    };
                  })}
                placeholder="Sélectionner"
                error={!item.reference}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <QuantityInput
              value={item.quantity || 1}
              onChange={(val) => updateFhItem(item.id, 'quantity', val)}
              label="Qté :"
            />

            <button
              type="button"
              onClick={() => removeFhRow(item.id)}
              disabled={items.length === 1}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addFhRow}
        className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Ajouter
      </button>
    </EquipmentToggleCard>
  );
}

export default FHEquipmentToggle;
