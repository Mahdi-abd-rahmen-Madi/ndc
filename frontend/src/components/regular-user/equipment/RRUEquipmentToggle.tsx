import React, { useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
import { QuantityInput } from '../../ui/QuantityInput';
import type { EquipmentItem } from '../../RegularUserView';

export interface RRUEquipmentToggleProps {
  hasRruEquipment: boolean;
  setHasRruEquipment: (val: boolean) => void;
  rruItems: EquipmentItem[];
  setRruItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rruOptions: { id: string; vendor: string; reference: string; operator?: string; dimensions?: string; weight?: number }[];
  isRfmMode?: boolean;
  operator?: string;
  nombreSecteurs?: number;
}

export function RRUEquipmentToggle({
  hasRruEquipment,
  setHasRruEquipment,
  rruItems,
  setRruItems,
  rruOptions,
  isRfmMode = false,
  operator = 'bouygues',
  nombreSecteurs = 1
}: RRUEquipmentToggleProps) {
  const rfmModels: { id: string; vendor: string; reference: string; operator?: string; dimensions?: string; weight?: number }[] = [
    { id: 'ARGA', vendor: 'NOKIA', reference: 'ARGA' },
    { id: 'ARDB', vendor: 'NOKIA', reference: 'ARDB' },
    { id: 'ARHA', vendor: 'NOKIA', reference: 'ARHA' },
    { id: 'AREA', vendor: 'NOKIA', reference: 'AREA' },
    { id: 'ARPA', vendor: 'NOKIA', reference: 'ARPA' },
  ];

  const filteredRruOptions = rruOptions.filter(o =>
    o.operator ? o.operator.toLowerCase() === operator.toLowerCase() : (operator.toLowerCase() === 'bouygues')
  );

  // For Orange, prioritize references starting with 2212, 2217, and 4415 (e.g. Radio 2212..., Radio 2217..., Radio 4415...)
  const sortedRruOptions = operator.toLowerCase() === 'orange'
    ? [...filteredRruOptions].sort((a, b) => {
      const getPriority = (ref: string = '') => {
        const clean = ref.replace(/^Radio\s+/i, '').trim();
        if (clean.startsWith('2212')) return 1;
        if (clean.startsWith('2217')) return 2;
        if (clean.startsWith('4415')) return 3;
        return 10;
      };
      const pA = getPriority(a.reference);
      const pB = getPriority(b.reference);
      if (pA !== pB) return pA - pB;
      return (a.reference || '').localeCompare(b.reference || '');
    })
    : filteredRruOptions;

  const actualOptions = isRfmMode ? rfmModels : sortedRruOptions;
  const uniqueVendors = Array.from(new Set(actualOptions.map(o => o.vendor)));

  const addRruRow = () => {
    setRruItems(prev => [...prev, {
      id: crypto.randomUUID(),
      reference: '',
      quantity: 1,
      vendor: uniqueVendors.length === 1 ? uniqueVendors[0] : undefined
    }]);
  };

  useEffect(() => {
    setRruItems(prev => prev.map(item => {
      let updated = { ...item };
      if (uniqueVendors.length === 1 && updated.vendor !== uniqueVendors[0]) {
        updated.vendor = uniqueVendors[0];
        updated.reference = '';
      } else if (updated.vendor && !uniqueVendors.includes(updated.vendor)) {
        updated.vendor = uniqueVendors.length === 1 ? uniqueVendors[0] : undefined;
        updated.reference = '';
      }
      if (updated.reference) {
        const exists = actualOptions.some(o => o.id === updated.reference && (!updated.vendor || o.vendor === updated.vendor));
        if (!exists) {
          updated.reference = '';
        }
      }
      return updated;
    }));
  }, [operator, actualOptions, uniqueVendors, setRruItems]);

  const removeRruRow = (id: string) => {
    if (rruItems.length > 1) {
      setRruItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateRruItem = (id: string, field: 'reference' | 'quantity' | 'vendor', value: any) => {
    setRruItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'vendor') {
          return { ...item, vendor: value, reference: '' };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };
  const isRruIncomplete = hasRruEquipment && (rruItems.length === 0 || rruItems.some(i => !i.vendor || !i.reference));

  return (
    <EquipmentToggleCard
      title={`Présence ${isRfmMode ? 'Module RF NSN' : 'RRU'}`}
      enabled={hasRruEquipment}
      onToggle={setHasRruEquipment}
      color="violet"
      scopeBadgeText="Par secteur"
      isIncomplete={isRruIncomplete}
    >
      {rruItems.map((item) => (
        <div key={item.id} className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${(!item.vendor || !item.reference)
          ? 'bg-amber-50/20 border-amber-200'
          : 'bg-slate-50 border-slate-200'
          }`}>
          <div className={operator === 'orange' ? 'flex flex-col gap-3' : 'flex gap-3'}>
            {/* Marque */}
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                Marque
                {!item.vendor && <span className="text-amber-600 font-bold">*</span>}
              </label>
              <CustomSelect
                value={item.vendor || ''}
                onChange={(val) => updateRruItem(item.id, 'vendor', val)}
                className="focus:ring-2 focus:ring-emerald-500"
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
                onChange={(val) => updateRruItem(item.id, 'reference', val)}
                disabled={!item.vendor}
                className="focus:ring-2 focus:ring-emerald-500"
                dropdownClassName="min-w-max"
                options={actualOptions.filter(o => o.vendor === item.vendor).map(opt => {
                  const isSelectedElsewhere = rruItems.some(otherItem => otherItem.id !== item.id && otherItem.reference === opt.id);
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
              onChange={(val) => updateRruItem(item.id, 'quantity', val)}
              unitLabel="/ secteur"
              nombreSecteurs={nombreSecteurs}
            />

            <button
              type="button"
              onClick={() => removeRruRow(item.id)}
              disabled={rruItems.length === 1}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRruRow}
        className="flex items-center gap-2 self-start px-3 py-1.5 mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Ajouter
      </button>
    </EquipmentToggleCard>
  );
}

export default RRUEquipmentToggle;
