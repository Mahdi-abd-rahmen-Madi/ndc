import { AlignJustify } from 'lucide-react';
import { CustomSelect } from '../../../ui/CustomSelect';
import {
  isFhEchelleAllowed,
  isSansPlotFromFoundation,
  normalizeFhEchelle,
} from '../../../../config/equipmentRegistry';
import type { EquipmentFoundationType } from './EquipmentAncrageSelector';

export const SUPPORT_ECHELLE_OPTIONS = [
  { value: "Pas d'échelle", label: "Pas d'échelle" },
  { value: 'Echelle', label: 'Echelle' },
];

export interface EquipmentEchelleSelectorProps {
  foundationType?: EquipmentFoundationType;
  hauteurMatM?: number;
  defaultHauteurMatM?: number;
  value?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  accentColor?: 'amber' | 'rose' | 'emerald' | 'violet';
}

const ACCENT_MAP = {
  amber: { icon: 'text-amber-600', ring: 'focus:ring-2 focus:ring-amber-500' },
  rose: { icon: 'text-rose-600', ring: 'focus:ring-2 focus:ring-rose-500' },
  emerald: { icon: 'text-emerald-600', ring: 'focus:ring-2 focus:ring-emerald-500' },
  violet: { icon: 'text-violet-600', ring: 'focus:ring-2 focus:ring-violet-500' },
} as const;

export function EquipmentEchelleSelector({
  foundationType = 'dallettes',
  hauteurMatM,
  defaultHauteurMatM = 1.50,
  value = "Pas d'échelle",
  onChange,
  disabled = false,
  accentColor = 'amber',
}: EquipmentEchelleSelectorProps) {
  const isSansPlot = isSansPlotFromFoundation(foundationType);
  if (isSansPlot) {
    return null;
  }

  const effectiveH = hauteurMatM ?? defaultHauteurMatM;
  const canHaveEchelle = isFhEchelleAllowed(false, effectiveH);
  const accent = ACCENT_MAP[accentColor];

  return (
    <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200/70">
      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
        <AlignJustify className={`w-3.5 h-3.5 ${accent.icon} shrink-0`} />
        <span>Présence échelle</span>
      </label>
      <CustomSelect
        value={canHaveEchelle ? normalizeFhEchelle(value) : "Pas d'échelle"}
        onChange={(val) => onChange?.(val)}
        options={SUPPORT_ECHELLE_OPTIONS}
        disabled={disabled || !canHaveEchelle}
        placeholder="Sélectionner une échelle"
        className={`w-full ${accent.ring}`}
      />
      {!canHaveEchelle && (
        <p className="text-[11px] text-slate-500">
          Échelle disponible uniquement avec plot pour une hauteur de mât ≥ 2,00 m.
        </p>
      )}
    </div>
  );
}
