import React from 'react';
import { Activity } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';

export interface TDEquipmentToggleProps {
  hasTdEquipment: boolean;
  setHasTdEquipment: (val: boolean) => void;
  tdType: 'tetraphase' | 'monophase';
  setTdType: (val: 'tetraphase' | 'monophase') => void;
  tdReference: string;
  setTdReference: (val: string) => void;
  tgbtReference: string;
  setTgbtReference: (val: string) => void;
  tdOptions: { id: string; vendor: string; name: string; reference: string; weight: number; dimensions: string }[];
  operator?: string;
}

export function TDEquipmentToggle({
  hasTdEquipment,
  setHasTdEquipment,
  tdType,
  setTdType,
  tdReference,
  setTdReference,
  tgbtReference,
  setTgbtReference,
  tdOptions,
  operator = 'bouygues'
}: TDEquipmentToggleProps) {
  const isBouygues = operator.toLowerCase() === 'bouygues';

  React.useEffect(() => {
    if (hasTdEquipment) {
      const validOptions = tdOptions.filter(o =>
        tdType === 'tetraphase' ? o.reference === '68237' : o.reference === '68236'
      );
      if (!validOptions.some(o => o.id === tdReference)) {
        if (validOptions.length > 0) {
          setTdReference(validOptions[0].id);
        }
      }
      if (isBouygues && !tgbtReference) {
        setTgbtReference('TGBT ACTIA');
      }
    }
  }, [hasTdEquipment, tdType, tdOptions, tdReference, setTdReference, isBouygues, tgbtReference, setTgbtReference]);

  const filteredTdOptions = tdOptions.filter(opt => {
    if (tdType === 'tetraphase') return opt.reference === '68237';
    if (tdType === 'monophase') return opt.reference === '68236';
    return true;
  });

  return (
    <EquipmentToggleCard
      title="Présence TD"
      enabled={hasTdEquipment}
      onToggle={setHasTdEquipment}
      icon={Activity}
      color="violet"
      scopeBadgeText="1x par site"
    >
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
          <input
            type="radio"
            checked={tdType === 'tetraphase'}
            onChange={() => setTdType('tetraphase')}
            className="text-violet-600 focus:ring-violet-500"
          />
          TD Tétraphasé
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
          <input
            type="radio"
            checked={tdType === 'monophase'}
            onChange={() => setTdType('monophase')}
            className="text-violet-600 focus:ring-violet-500"
          />
          TD Monophasé + TGBT
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col w-full md:w-1/2 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Équipement</label>
          <CustomSelect
            value={tdReference}
            onChange={(val) => setTdReference(val)}
            className="focus:ring-2 focus:ring-violet-500"
            options={filteredTdOptions.map(opt => ({
              value: opt.id,
              label: opt.vendor ? `${opt.vendor} - ${opt.name}` : opt.name
            }))}
            placeholder="Sélectionner un équipement"
          />
        </div>

        {tdType === 'monophase' && (
          <div className="flex flex-col flex-1 mt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">TGBT</label>
              {isBouygues && (
                <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                  Bouygues
                </span>
              )}
            </div>

            {isBouygues && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 block">Modèle TGBT</label>
                  <CustomSelect
                    value={tgbtReference || 'TGBT ACTIA'}
                    onChange={(val) => setTgbtReference(val)}
                    className="focus:ring-2 focus:ring-violet-500"
                    options={[
                      { value: 'TGBT ACTIA', label: 'TGBT ACTIA' },
                      { value: 'TGBT TLTI', label: 'TGBT TLTI' }
                    ]}
                    placeholder="Sélectionner un TGBT"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </EquipmentToggleCard>
  );
}

export default TDEquipmentToggle;
