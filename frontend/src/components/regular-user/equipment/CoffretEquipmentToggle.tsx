import React from 'react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';

export interface CoffretEquipmentToggleProps {
  hasCoffret: boolean;
  setHasCoffret: (val: boolean) => void;
  coffretReference: string;
  setCoffretReference: (val: string) => void;
  coffretOptions: { id: string; name: string; operator?: string }[];
  operator?: string;
  nombreSecteurs?: number;
}

export function CoffretEquipmentToggle({
  hasCoffret,
  setHasCoffret,
  coffretReference,
  setCoffretReference,
  coffretOptions,
  operator,
}: CoffretEquipmentToggleProps) {
  const filteredOptions = coffretOptions.filter(opt => {
    if (!opt.operator || opt.operator === 'all') return true;
    if (operator) return opt.operator.toLowerCase() === operator.toLowerCase();
    return true;
  });

  const httaOptions = filteredOptions.filter(opt => opt.name.includes('HTTA'));
  const otherOptions = filteredOptions.filter(opt => !opt.name.includes('HTTA'));
  const isHttaSelected = httaOptions.some(opt => opt.id === coffretReference) || coffretReference === 'HTTA';
  const mainSelectValue = isHttaSelected ? 'HTTA' : coffretReference;

  const isCoffretIncomplete = hasCoffret && (!coffretReference || !mainSelectValue);

  return (
    <EquipmentToggleCard
      title="Présence Coffrets fibre"
      enabled={hasCoffret}
      onToggle={setHasCoffret}
      color="violet"
      scopeBadgeText="Par secteur"
      isIncomplete={isCoffretIncomplete}
    >
      <div className="flex flex-col min-w-0">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
          Type
          {!mainSelectValue && <span className="text-amber-600 font-bold">*</span>}
        </label>
        <CustomSelect
          value={mainSelectValue}
          onChange={(val) => {
            if (val === 'HTTA' && httaOptions.length > 0) {
              setCoffretReference(httaOptions[0].id);
            } else {
              setCoffretReference(val);
            }
          }}
          className="focus:ring-2 focus:ring-fuchsia-500"
          options={[
            ...otherOptions.map(ref => ({ value: ref.id, label: ref.name.replace(/\s*\([^)]*\)/g, '').trim() })),
            ...(httaOptions.length > 0 ? [{ value: 'HTTA', label: 'Coffrets HTTA' }] : [])
          ]}
          placeholder="Sélectionner..."
          error={!mainSelectValue}
        />
      </div>

      {isHttaSelected && httaOptions.length > 0 && (
        <div className="flex flex-col min-w-0 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Référence HTTA</label>
          <select
            value={coffretReference === 'HTTA' ? httaOptions[0].id : coffretReference}
            onChange={(e) => setCoffretReference(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 shadow-sm"
          >
            {httaOptions.map(ref => (
              <option key={ref.id} value={ref.id}>
                {ref.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {(() => {
        const actualRef = isHttaSelected && coffretReference === 'HTTA' && httaOptions.length > 0 ? httaOptions[0].id : coffretReference;
        const selectedRef = coffretOptions.find(r => r.id === actualRef);
        if (!selectedRef || isHttaSelected) return null;

        return (
          <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <label className="text-[10px] text-slate-500 uppercase font-semibold mb-1 block">Référence</label>
              <input
                type="text"
                value={actualRef}
                disabled
                className="w-full bg-white border border-slate-200 rounded py-1.5 px-2 text-xs text-slate-800 font-medium cursor-not-allowed"
              />
            </div>
          </div>
        );
      })()}
    </EquipmentToggleCard>
  );
}

export default CoffretEquipmentToggle;
