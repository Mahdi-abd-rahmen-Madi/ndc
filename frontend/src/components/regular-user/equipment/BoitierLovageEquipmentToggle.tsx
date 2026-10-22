import React from 'react';
import { Activity } from 'lucide-react';
import { QuantityInput } from '../../ui/QuantityInput';

export interface BoitierLovageEquipmentToggleProps {
  hasBoitierLovage: boolean;
  setHasBoitierLovage: (val: boolean) => void;
  boitierLovageReference: string;
  setBoitierLovageReference: (val: string) => void;
  boitierLovageQuantity: number;
  setBoitierLovageQuantity: (val: number) => void;
  boitierOptions?: any[];
  operator?: string;
}

export function BoitierLovageEquipmentToggle({
  hasBoitierLovage,
  setHasBoitierLovage,
  boitierLovageReference,
  setBoitierLovageReference,
  boitierLovageQuantity,
  setBoitierLovageQuantity,
  boitierOptions = [],
  operator
}: BoitierLovageEquipmentToggleProps) {
  const defaultOptions = [
    { id: 'BLM-515709', name: 'Boîte de dérivation OPTIBOX IP55', reference: 'BLM-515709', operator: 'free' }
  ];

  const allOptions = boitierOptions.length > 0 ? boitierOptions : defaultOptions;

  const options = allOptions.filter(opt => {
    if (!opt.operator || opt.operator === 'all') return true;
    if (operator) return opt.operator.toLowerCase() === operator.toLowerCase();
    return true;
  });

  React.useEffect(() => {
    if (options.length === 0) {
      if (hasBoitierLovage) setHasBoitierLovage(false);
      if (boitierLovageReference) setBoitierLovageReference('');
    } else if (hasBoitierLovage && !boitierLovageReference) {
      setBoitierLovageReference(options[0].id);
    }
  }, [hasBoitierLovage, boitierLovageReference, options, setBoitierLovageReference, setHasBoitierLovage]);

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${hasBoitierLovage ? 'border-violet-300 ring-1 ring-violet-500/10' : 'border-slate-200 hover:border-violet-200'}`}>
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-2 cursor-pointer shrink-0">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={hasBoitierLovage}
                onChange={(e) => setHasBoitierLovage(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${hasBoitierLovage ? 'bg-violet-600' : 'bg-slate-300'}`}></div>
              <div className={`absolute left-1 top-1 bg-white shadow-sm w-4 h-4 rounded-full transition-transform ${hasBoitierLovage ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <Activity className="w-4 h-4 text-violet-600" />
            Présence Boitiers de lovage
          </label>
        </div>

        {hasBoitierLovage && (
          <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <QuantityInput
                value={boitierLovageQuantity}
                onChange={setBoitierLovageQuantity}
                label="Qté :"
                size="md"
              />

              <div className="flex flex-col flex-1 min-w-0">
                <select
                  value={boitierLovageReference}
                  onChange={(e) => setBoitierLovageReference(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 shadow-sm"
                >
                  <option value="" disabled>Sélectionner une référence</option>
                  {options.map((opt, idx) => (
                    <option key={idx} value={opt.id}>{opt.reference}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BoitierLovageEquipmentToggle;
