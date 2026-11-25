import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { DEFAULT_TGBT_OPTIONS } from '../../../config/catalogueDefaults';
import { SelectEquipmentToggle } from './shared/SelectEquipmentToggle';
import { EquipmentAncrageSelector, EquipmentFoundationType } from './shared/EquipmentAncrageSelector';
import { MastHeightInput } from './shared/MastHeightInput';
import { EquipmentEchelleSelector } from './shared/EquipmentEchelleSelector';

export interface TGBTItem {
  id: string;
  name: string;
  reference: string;
  vendor?: string;
  supplier?: string;
  operator?: string;
  weight?: number;
  dimensions?: string;
}

export type TGBTEmplacement = 'integre_bcube' | 'integre_mat';

export interface TGBTEquipmentToggleProps {
  hasTgbt: boolean;
  setHasTgbt: (val: boolean) => void;
  tgbtReference: string;
  setTgbtReference: (val: string) => void;
  tgbtEmplacement?: TGBTEmplacement;
  setTgbtEmplacement?: (val: TGBTEmplacement) => void;
  foundationType?: EquipmentFoundationType;
  setFoundationType?: (val: EquipmentFoundationType) => void;
  hauteurMatM?: number;
  setHauteurMatM?: (val: number) => void;
  echelle?: string;
  setEchelle?: (val: string) => void;
  options?: TGBTItem[];
}

export function TGBTEquipmentToggle({
  hasTgbt,
  setHasTgbt,
  tgbtReference,
  setTgbtReference,
  tgbtEmplacement = 'integre_bcube',
  setTgbtEmplacement,
  foundationType = 'dallettes',
  setFoundationType,
  hauteurMatM = 1.50,
  setHauteurMatM,
  echelle = "Pas d'échelle",
  setEchelle,
  options = [],
}: TGBTEquipmentToggleProps) {
  const availableOptions = useMemo(
    () => (options.length > 0 ? options : DEFAULT_TGBT_OPTIONS),
    [options]
  );

  const selectOptions = useMemo(
    () =>
      availableOptions.map(opt => ({
        value: opt.reference || opt.name || opt.id,
        label: (opt.name || opt.reference || '').replace(/^TGBT\s+/i, ''),
      })),
    [availableOptions]
  );

  return (
    <SelectEquipmentToggle
      title="TGBT"
      enabled={hasTgbt}
      onToggle={setHasTgbt}
      value={tgbtReference}
      onChange={setTgbtReference}
      options={selectOptions}
      fieldLabel="Modèle"
      placeholder="Sélectionner un TGBT"
      icon={Zap}
    >
      <div className="flex flex-col gap-1.5 pt-1">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          Emplacement du TGBT
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer font-medium whitespace-nowrap">
            <input
              type="radio"
              name="tgbtEmplacement"
              value="integre_bcube"
              checked={tgbtEmplacement === 'integre_bcube'}
              onChange={() => setTgbtEmplacement?.('integre_bcube')}
              className="text-violet-600 focus:ring-violet-500"
            />
            Intégré au BCube
          </label>
          <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer font-medium whitespace-nowrap">
            <input
              type="radio"
              name="tgbtEmplacement"
              value="integre_mat"
              checked={tgbtEmplacement === 'integre_mat'}
              onChange={() => setTgbtEmplacement?.('integre_mat')}
              className="text-violet-600 focus:ring-violet-500"
            />
            Intégré au mât
          </label>
        </div>
      </div>

      {setFoundationType && (
        <EquipmentAncrageSelector
          value={foundationType}
          onChange={setFoundationType}
          className="pt-2 border-t border-slate-200/70"
        />
      )}

      {setHauteurMatM && (
        <MastHeightInput
          value={hauteurMatM}
          onChange={setHauteurMatM}
          defaultValue={1.50}
        />
      )}

      <EquipmentEchelleSelector
        foundationType={foundationType}
        hauteurMatM={hauteurMatM}
        defaultHauteurMatM={1.50}
        value={echelle}
        onChange={setEchelle}
        accentColor="violet"
      />
    </SelectEquipmentToggle>
  );
}

export default TGBTEquipmentToggle;
