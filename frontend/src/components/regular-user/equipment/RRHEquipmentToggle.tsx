import React, { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { QuantityInput } from '../../ui/QuantityInput';
import type { EquipmentItem } from '../../RegularUserView';

export interface RRHEquipmentToggleProps {
  hasRrhEquipment: boolean;
  setHasRrhEquipment: (val: boolean) => void;
  rrhItems: EquipmentItem[];
  setRrhItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rrhOptions: { id: string; vendor: string; reference: string; operator?: string }[];
  operator?: string;
  nombreSecteurs?: number;
}

export function RRHEquipmentToggle({
  hasRrhEquipment,
  setHasRrhEquipment,
  rrhItems,
  setRrhItems,
  rrhOptions,
  operator = 'free',
  nombreSecteurs = 1
}: RRHEquipmentToggleProps) {
  const filteredRrhOptions = rrhOptions.filter(o =>
    o.operator ? o.operator.toLowerCase() === operator.toLowerCase() : false
  );
  const uniqueVendors = Array.from(new Set(filteredRrhOptions.map(o => o.vendor)));

  const addRrhRow = () => {
    setRrhItems(prev => [...prev, {
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: uniqueVendors.length === 1 ? uniqueVendors[0] : undefined
    }]);
  };

  useEffect(() => {
    setRrhItems(prev => prev.map(item => {
      let updated = { ...item };
      if (uniqueVendors.length === 1 && updated.vendor !== uniqueVendors[0]) {
        updated.vendor = uniqueVendors[0];
        updated.reference = '';
      } else if (updated.vendor && !uniqueVendors.includes(updated.vendor)) {
        updated.vendor = uniqueVendors.length === 1 ? uniqueVendors[0] : undefined;
        updated.reference = '';
      }
      if (updated.reference) {
        const exists = filteredRrhOptions.some(o => o.id === updated.reference && (!updated.vendor || o.vendor === updated.vendor));
        if (!exists) {
          updated.reference = '';
        }
      }
      return updated;
    }));
  }, [operator, filteredRrhOptions, uniqueVendors, setRrhItems]);

  const removeRrhRow = (id: string) => {
    if (rrhItems.length > 1) {
      setRrhItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateRrhItem = (id: string, field: 'reference' | 'quantity' | 'vendor', value: any) => {
    setRrhItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'vendor') {
          return { ...item, vendor: value, reference: '' };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const isRrhIncomplete = hasRrhEquipment && (rrhItems.length === 0 || rrhItems.some(i => !i.vendor || !i.reference));

  return (
    <EquipmentToggleCard
      title="Présence RRH"
      enabled={hasRrhEquipment}
      onToggle={setHasRrhEquipment}
      color="violet"
      scopeBadgeText="Par secteur"
      isIncomplete={isRrhIncomplete}
    >
      {rrhItems.map((item) => (
        <div key={item.id} className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${(!item.vendor || !item.reference)
          ? 'bg-amber-50/20 border-amber-200'
          : 'bg-slate-50 border-slate-200'
          }`}>
          <div className="flex gap-3">
            {/* Marque */}
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                Marque
                {!item.vendor && <span className="text-amber-600 font-bold">*</span>}
              </label>
              <CustomSelect
                value={item.vendor || ''}
                onChange={(val) => updateRrhItem(item.id, 'vendor', val)}
                className="focus:ring-2 focus:ring-rose-500"
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
                onChange={(val) => updateRrhItem(item.id, 'reference', val)}
                disabled={!item.vendor}
                className="focus:ring-2 focus:ring-rose-500"
                options={filteredRrhOptions.filter(o => o.vendor === item.vendor).map(opt => {
                  const isSelectedElsewhere = rrhItems.some(otherItem => otherItem.id !== item.id && otherItem.reference === opt.id);
                  return { value: opt.id, label: opt.reference + (isSelectedElsewhere ? ' (Déjà utilisé)' : ''), disabled: isSelectedElsewhere };
                })}
                placeholder="Sélectionner"
                error={!item.reference}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <QuantityInput
              value={item.quantity || 1}
              onChange={(val) => updateRrhItem(item.id, 'quantity', val)}
              unitLabel="/ secteur"
              nombreSecteurs={nombreSecteurs}
            />

            <button
              type="button"
              onClick={() => removeRrhRow(item.id)}
              disabled={rrhItems.length === 1}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRrhRow}
        className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Ajouter
      </button>
    </EquipmentToggleCard>
  );
}

export default RRHEquipmentToggle;
