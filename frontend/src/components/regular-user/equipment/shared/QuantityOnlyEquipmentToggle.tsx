import { LucideIcon } from 'lucide-react';
import { EquipmentToggleCard, EquipmentToggleCardProps } from '../../../ui/EquipmentToggleCard';
import { QuantityInput } from '../../../ui/QuantityInput';

export interface StaticSpecField {
  label: string;
  value: string;
}

export interface QuantityOnlyEquipmentToggleProps {
  title: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  quantity?: number;
  onQuantityChange?: (val: number) => void;
  staticSpecs?: StaticSpecField[];
  icon?: LucideIcon;
  color?: EquipmentToggleCardProps['color'];
  scopeBadgeText?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function QuantityOnlyEquipmentToggle({
  title,
  enabled,
  onToggle,
  quantity = 1,
  onQuantityChange,
  staticSpecs,
  icon,
  color = 'violet',
  scopeBadgeText = 'par site',
  disabled = false,
  disabledReason,
}: QuantityOnlyEquipmentToggleProps) {
  return (
    <EquipmentToggleCard
      title={title}
      enabled={enabled}
      onToggle={onToggle}
      disabled={disabled}
      disabledReason={disabledReason}
      icon={icon}
      color={color}
      scopeBadgeText={scopeBadgeText}
    >
      <div className="flex flex-col gap-3">
        {staticSpecs && staticSpecs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {staticSpecs.map(spec => (
              <div key={spec.label} className="flex flex-col min-w-0">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                  {spec.label}
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                  {spec.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {onQuantityChange && (
          <div>
            <QuantityInput
              value={quantity || 1}
              onChange={onQuantityChange}
              label="Qté :"
              size="md"
            />
          </div>
        )}
      </div>
    </EquipmentToggleCard>
  );
}
