import { useMemo } from 'react';
import type { EquipmentItem } from '../types';
import { RFM_MODELS } from '../../../config/catalogueDefaults';
import { MultiRowEquipmentToggle } from './shared/MultiRowEquipmentToggle';

export interface RRUEquipmentToggleProps {
  hasRruEquipment: boolean;
  setHasRruEquipment: (val: boolean) => void;
  rruItems: EquipmentItem[];
  setRruItems: (val: EquipmentItem[] | ((prev: EquipmentItem[]) => EquipmentItem[])) => void;
  rruOptions: { id: string; vendor: string; reference: string; operator?: string; dimensions?: string; weight?: number }[];
  isRfmMode?: boolean;
  operator?: string;
  nombreSecteurs?: number;
  disabled?: boolean;
  disabledReason?: string;
  foundationType?: 'metallique' | 'beton' | 'dallettes';
  setFoundationType?: (val: 'metallique' | 'beton' | 'dallettes') => void;
}

export function RRUEquipmentToggle({
  hasRruEquipment,
  setHasRruEquipment,
  rruItems,
  setRruItems,
  rruOptions,
  isRfmMode = false,
  operator = 'bouygues',
  nombreSecteurs = 1,
  disabled = false,
  disabledReason,
  foundationType,
  setFoundationType,
}: RRUEquipmentToggleProps) {
  const options = useMemo(() => {
    if (isRfmMode) {
      return RFM_MODELS.map(m => ({ id: m.id, vendor: m.vendor, label: m.reference }));
    }
    const op = operator.toLowerCase();
    const filtered = rruOptions.filter(o =>
      o.operator ? o.operator.toLowerCase() === op : op === 'bouygues'
    );
    const sorted = op === 'orange'
      ? [...filtered].sort((a, b) => {
          const getPriority = (ref = '') => {
            const clean = ref.replace(/^Radio\s+/i, '').trim();
            if (clean.startsWith('2212')) return 1;
            if (clean.startsWith('2217')) return 2;
            if (clean.startsWith('4415')) return 3;
            return 10;
          };
          const diff = getPriority(a.reference) - getPriority(b.reference);
          return diff !== 0 ? diff : (a.reference || '').localeCompare(b.reference || '');
        })
      : filtered;
    return sorted.map(o => ({ id: o.id, vendor: o.vendor, label: o.reference }));
  }, [rruOptions, isRfmMode, operator]);

  return (
    <MultiRowEquipmentToggle
      title={`Présence ${isRfmMode ? 'Module RF NSN' : 'RRU'}`}
      enabled={hasRruEquipment}
      onToggle={setHasRruEquipment}
      items={rruItems}
      onItemsChange={setRruItems}
      options={options}
      scopeBadgeText="Par secteur"
      selectRingClass="focus:ring-2 focus:ring-emerald-500"
      dropdownClassName="min-w-max"
      stackSelects={operator === 'orange'}
      unitLabel="/ secteur"
      maxRows={6}
      nombreSecteurs={nombreSecteurs}
      disabled={disabled}
      disabledReason={disabledReason}
      foundationType={foundationType}
      onFoundationTypeChange={setFoundationType}
    />
  );
}

export default RRUEquipmentToggle;
