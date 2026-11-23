import { useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { EquipmentToggleCard, EquipmentToggleCardProps } from '../../../ui/EquipmentToggleCard';
import { CustomSelect } from '../../../ui/CustomSelect';
import { QuantityInput } from '../../../ui/QuantityInput';
import { EquipmentSpecsGrid } from '../../../ui/EquipmentSpecsGrid';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectEquipmentToggleProps {
  title: string;
  enabled: boolean;
  onToggle: (val: boolean) => void;
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  fieldLabel?: string;
  placeholder?: string;
  icon?: LucideIcon;
  color?: EquipmentToggleCardProps['color'];
  scopeBadgeText?: string;
  autoSelectFirst?: boolean;
  quantity?: number;
  onQuantityChange?: (val: number) => void;
  quantityPosition?: 'top-inline' | 'below';
  specs?: { label: string; value: string }[];
  disabled?: boolean;
  disabledReason?: string;
  children?: React.ReactNode;
}

export function SelectEquipmentToggle({
  title,
  enabled,
  onToggle,
  value,
  onChange,
  options,
  fieldLabel = 'Référence',
  placeholder = 'Sélectionner une référence',
  icon,
  color = 'violet',
  scopeBadgeText,
  autoSelectFirst = true,
  quantity,
  onQuantityChange,
  quantityPosition = 'below',
  specs,
  disabled = false,
  disabledReason,
  children,
}: SelectEquipmentToggleProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (autoSelectFirst && enabled && !value && options.length > 0) {
      onChangeRef.current(options[0].value);
    }
  }, [autoSelectFirst, enabled, value, options]);

  const selectedValue = value || (autoSelectFirst ? options[0]?.value || '' : '');

  const selectBlock = (
    <div className="flex flex-col flex-1 min-w-0">
      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
        {fieldLabel}
      </label>
      <CustomSelect
        value={selectedValue}
        onChange={onChange}
        className="focus:ring-2 focus:ring-violet-500"
        options={options}
        placeholder={placeholder}
      />
    </div>
  );

  const qtyBlock = onQuantityChange ? (
    <QuantityInput
      value={quantity || 1}
      onChange={onQuantityChange}
      label="Qté :"
      size="md"
    />
  ) : null;

  return (
    <EquipmentToggleCard
      title={title}
      enabled={enabled}
      onToggle={(checked: boolean) => {
        onToggle(checked);
        if (autoSelectFirst && checked && !value && options.length > 0) {
          onChange(options[0].value);
        }
      }}
      icon={icon}
      color={color}
      scopeBadgeText={scopeBadgeText}
      disabled={disabled}
      disabledReason={disabledReason}
    >
      <div className="flex flex-col gap-3">
        {quantityPosition === 'top-inline' && qtyBlock ? (
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {qtyBlock}
            {selectBlock}
          </div>
        ) : (
          <>
            {selectBlock}
            {qtyBlock && <div>{qtyBlock}</div>}
          </>
        )}

        {children}

        {specs && specs.length > 0 && (
          <EquipmentSpecsGrid columns={2} items={specs} />
        )}
      </div>
    </EquipmentToggleCard>
  );
}
