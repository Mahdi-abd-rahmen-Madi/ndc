import { useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EquipmentToggleCard, EquipmentToggleCardProps } from '../../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../../ui/CustomSelect';
import { QuantityInput } from '../../../ui/QuantityInput';
import type { EquipmentItem } from '../../types';
import { EquipmentAncrageSelector, EquipmentFoundationType } from './EquipmentAncrageSelector';

export interface MultiRowOption {
  id: string;
  vendor: string;
  label: string;
}

export interface MultiRowEquipmentToggleProps {
  title: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  items: EquipmentItem[];
  onItemsChange: (updater: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  options: MultiRowOption[];
  scopeBadgeText?: string;
  color?: EquipmentToggleCardProps['color'];
  selectRingClass?: string;
  dropdownClassName?: string;
  stackSelects?: boolean;
  quantityLabel?: string;
  unitLabel?: string;
  nombreSecteurs?: number;
  disabled?: boolean;
  disabledReason?: string;
  foundationType?: EquipmentFoundationType;
  onFoundationTypeChange?: (val: EquipmentFoundationType) => void;
}

export function MultiRowEquipmentToggle({
  title,
  enabled,
  onToggle,
  items,
  onItemsChange,
  options,
  scopeBadgeText = 'Par secteur',
  color = 'violet',
  selectRingClass = 'focus:ring-2 focus:ring-violet-500',
  dropdownClassName,
  stackSelects = false,
  quantityLabel,
  unitLabel,
  nombreSecteurs,
  disabled = false,
  disabledReason,
  foundationType,
  onFoundationTypeChange,
}: MultiRowEquipmentToggleProps) {
  const uniqueVendors = useMemo(
    () => Array.from(new Set(options.map(o => o.vendor))),
    [options]
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;

  useEffect(() => {
    const current = itemsRef.current;
    let hasChanges = false;

    const sanitized = current.map(item => {
      const updated = { ...item };
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
        const exists = options.some(o => o.id === updated.reference && (!updated.vendor || o.vendor === updated.vendor));
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
      onItemsChangeRef.current(sanitized);
    }
  }, [options, uniqueVendors]);

  const addRow = () => {
    onItemsChange(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        reference: '',
        quantity: 1,
        vendor: uniqueVendors.length === 1 ? uniqueVendors[0] : undefined,
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (items.length > 1) {
      onItemsChange(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: 'reference' | 'quantity' | 'vendor', value: any) => {
    onItemsChange(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (field === 'vendor') {
          return { ...item, vendor: value, reference: '' };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const isIncomplete = enabled && (items.length === 0 || items.some(i => !i.vendor || !i.reference));

  return (
    <EquipmentToggleCard
      title={title}
      enabled={enabled}
      onToggle={onToggle}
      disabled={disabled}
      disabledReason={disabledReason}
      color={color}
      scopeBadgeText={scopeBadgeText}
      isIncomplete={isIncomplete}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${
            !item.vendor || !item.reference
              ? 'bg-amber-50/20 border-amber-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={stackSelects ? 'flex flex-col gap-3' : 'flex gap-3'}>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                Marque
                {!item.vendor && <span className="text-amber-600 font-bold">*</span>}
              </label>
              <CustomSelect
                value={item.vendor || ''}
                onChange={(val) => updateItem(item.id, 'vendor', val)}
                className={selectRingClass}
                options={uniqueVendors.map(vendor => ({ value: vendor, label: vendor }))}
                placeholder="Sélectionner"
                error={!item.vendor}
              />
            </div>

            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                Modèle
                {!item.reference && <span className="text-amber-600 font-bold">*</span>}
              </label>
              <CustomSelect
                value={item.reference}
                onChange={(val) => updateItem(item.id, 'reference', val)}
                disabled={!item.vendor}
                className={selectRingClass}
                dropdownClassName={dropdownClassName}
                options={options
                  .filter(o => o.vendor === item.vendor)
                  .map(opt => {
                    const isSelectedElsewhere = items.some(
                      other => other.id !== item.id && other.reference === opt.id
                    );
                    return {
                      value: opt.id,
                      label: opt.label + (isSelectedElsewhere ? ' (Déjà utilisé)' : ''),
                      disabled: isSelectedElsewhere,
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
              onChange={(val) => updateItem(item.id, 'quantity', val)}
              label={quantityLabel}
              unitLabel={unitLabel}
              nombreSecteurs={nombreSecteurs}
            />

            <button
              type="button"
              onClick={() => removeRow(item.id)}
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
        onClick={addRow}
        className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Ajouter
      </button>

      {onFoundationTypeChange && (
        <EquipmentAncrageSelector
          value={foundationType}
          onChange={onFoundationTypeChange}
          disabled={disabled}
        />
      )}
    </EquipmentToggleCard>
  );
}
