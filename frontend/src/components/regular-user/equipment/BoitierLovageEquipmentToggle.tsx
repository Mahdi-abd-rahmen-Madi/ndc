import React from 'react';
import { Activity, Box } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';
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
  // Coffret hybride TRANS FO integration (especially for Free)
  hasCoffretTransFo?: boolean;
  setHasCoffretTransFo?: (val: boolean) => void;
  coffretTransFoQuantity?: number;
  setCoffretTransFoQuantity?: (val: number) => void;
  coffretOptions?: { id: string; name: string; operator?: string }[];
}

export function BoitierLovageEquipmentToggle({
  hasBoitierLovage,
  setHasBoitierLovage,
  boitierLovageReference,
  setBoitierLovageReference,
  boitierLovageQuantity,
  setBoitierLovageQuantity,
  boitierOptions = [],
  operator,
  hasCoffretTransFo,
  setHasCoffretTransFo,
  coffretTransFoQuantity = 1,
  setCoffretTransFoQuantity,
  coffretOptions = []
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

  const isFree = operator === 'free';
  const isEnabled = isFree ? (hasBoitierLovage || !!hasCoffretTransFo) : hasBoitierLovage;

  React.useEffect(() => {
    if (options.length === 0) {
      if (hasBoitierLovage) setHasBoitierLovage(false);
      if (boitierLovageReference) setBoitierLovageReference('');
    } else if (hasBoitierLovage && !boitierLovageReference) {
      setBoitierLovageReference(options[0].id);
    }
  }, [hasBoitierLovage, boitierLovageReference, options, setBoitierLovageReference, setHasBoitierLovage]);

  if (options.length === 0 && !isFree) {
    return null;
  }

  const transFoOption = coffretOptions.find(opt => opt.id === 'TRANS_FO' || opt.operator === 'free');
  const rawTransFoDetails = transFoOption?.name || 'Coffret TRANS FO';
  // Strip dimensions and weight (e.g. "(260x380x97mm, 2.1kg)" -> "Coffret TRANS FO")
  const transFoDetails = rawTransFoDetails.replace(/\s*\([^)]*\)/g, '').trim();

  const handleMasterToggle = (checked: boolean) => {
    setHasBoitierLovage(checked);
    if (isFree && setHasCoffretTransFo) {
      setHasCoffretTransFo(checked);
    }
  };

  return (
    <EquipmentToggleCard
      title={isFree ? 'Boîtier Lovage & Coffret TRANS FO' : 'Présence Boitiers de lovage'}
      enabled={isEnabled}
      onToggle={handleMasterToggle}
      icon={Activity}
      color="violet"
      scopeBadgeText="1x par site"
    >
      <div className={`grid gap-3 ${isFree ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Section 1: Boîtier de lovage */}
        <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-violet-600" />
              Boîtier de lovage
            </span>
            {isFree && setHasCoffretTransFo && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-medium text-slate-500">Inclus</span>
                <input
                  type="checkbox"
                  checked={hasBoitierLovage}
                  onChange={(e) => setHasBoitierLovage(e.target.checked)}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-4 w-4 cursor-pointer"
                />
              </div>
            )}
          </div>

          {hasBoitierLovage && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-col flex-1 min-w-0">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">
                  Référence
                </label>
                <CustomSelect
                  value={boitierLovageReference}
                  onChange={(val) => setBoitierLovageReference(val)}
                  className="focus:ring-2 focus:ring-violet-500"
                  options={options.map((opt) => ({
                    value: opt.id,
                    label: opt.reference
                  }))}
                  placeholder="Sélectionner une référence"
                />
              </div>

              <div className="w-28">
                <QuantityInput
                  value={boitierLovageQuantity}
                  onChange={setBoitierLovageQuantity}
                  label="Qté :"
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Coffret TRANS FO (Free) */}
        {isFree && (
          <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-violet-600" />
                Coffret hybride : TRANS FO
              </span>
              {setHasCoffretTransFo && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-medium text-slate-500">Inclus</span>
                  <input
                    type="checkbox"
                    checked={!!hasCoffretTransFo}
                    onChange={(e) => setHasCoffretTransFo(e.target.checked)}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-4 w-4 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {hasCoffretTransFo && (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex flex-col flex-1 min-w-0">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">
                    Modèle
                  </label>
                  <div className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 truncate shadow-2xs">
                    {transFoDetails}
                  </div>
                </div>

                {setCoffretTransFoQuantity && (
                  <div className="w-28">
                    <QuantityInput
                      value={coffretTransFoQuantity || 1}
                      onChange={setCoffretTransFoQuantity}
                      label="Qté :"
                      size="sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </EquipmentToggleCard>
  );
}

export default BoitierLovageEquipmentToggle;

