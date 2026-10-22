import React from 'react';
import { Activity } from 'lucide-react';
import { EquipmentToggleCard } from '../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../ui/CustomSelect';

export interface GPSEquipmentToggleProps {
  hasGps: boolean;
  setHasGps: (val: boolean) => void;
  gpsReference: string;
  setGpsReference: (val: string) => void;
  gpsMarque?: string;
  setGpsMarque?: (val: string) => void;
  operator?: string;
}

export function GPSEquipmentToggle({
  hasGps,
  setHasGps,
  gpsReference,
  setGpsReference,
  gpsMarque = 'NOKIA',
  setGpsMarque,
  operator = 'bouygues'
}: GPSEquipmentToggleProps) {
  const isBouygues = operator.toLowerCase() === 'bouygues';

  const marqueOptions = isBouygues
    ? [{ value: 'ERICSSON', label: 'ERICSSON' }, { value: 'NOKIA', label: 'NOKIA' }]
    : [{ value: 'NOKIA', label: 'NOKIA' }];

  React.useEffect(() => {
    if (hasGps) {
      if (!gpsMarque) {
        setGpsMarque?.(isBouygues ? 'ERICSSON' : 'NOKIA');
        setGpsReference(isBouygues ? 'KRE 101 2395/2' : 'FYGC 474074A');
      }
    }
  }, [hasGps, isBouygues, gpsMarque, setGpsMarque, setGpsReference]);

  React.useEffect(() => {
    if (hasGps) {
      if (gpsMarque === 'ERICSSON' && gpsReference !== 'KRE 101 2395/2') {
        setGpsReference('KRE 101 2395/2');
      } else if (gpsMarque === 'NOKIA' && !['FYGC 474074A', 'FYGB 472748A'].includes(gpsReference)) {
        setGpsReference('FYGC 474074A');
      }
    }
  }, [hasGps, gpsMarque, gpsReference, setGpsReference]);

  const modelOptions = gpsMarque === 'ERICSSON'
    ? [{ value: 'KRE 101 2395/2', label: 'KRE 101 2395/2' }]
    : [
      { value: 'FYGC 474074A', label: 'FYGC 474074A' },
      { value: 'FYGB 472748A', label: 'FYGB 472748A' }
    ];

  const isGpsIncomplete = hasGps && (!gpsMarque || !gpsReference);

  return (
    <EquipmentToggleCard
      title="Présence GPS"
      enabled={hasGps}
      onToggle={setHasGps}
      icon={Activity}
      color="blue"
      scopeBadgeText="1x par site"
      isIncomplete={isGpsIncomplete}
    >
      <div className="flex gap-3">
        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
            Marque
            {!gpsMarque && <span className="text-amber-600 font-bold">*</span>}
          </label>
          <CustomSelect
            value={gpsMarque}
            onChange={(val) => {
              setGpsMarque?.(val);
              if (val === 'ERICSSON') {
                setGpsReference('KRE 101 2395/2');
              } else if (val === 'NOKIA') {
                setGpsReference('FYGC 474074A');
              }
            }}
            className="focus:ring-2 focus:ring-blue-500"
            options={marqueOptions}
            placeholder="Sélectionner"
            error={!gpsMarque}
          />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
            Modèle
            {!gpsReference && <span className="text-amber-600 font-bold">*</span>}
          </label>
          <CustomSelect
            value={gpsReference}
            onChange={(val) => setGpsReference(val)}
            disabled={!gpsMarque}
            className="focus:ring-2 focus:ring-blue-500"
            options={modelOptions}
            placeholder="Sélectionner"
            error={!gpsReference}
          />
        </div>
      </div>
    </EquipmentToggleCard>
  );
}

export default GPSEquipmentToggle;
