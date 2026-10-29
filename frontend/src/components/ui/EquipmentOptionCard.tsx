import React from 'react';
import { Check } from 'lucide-react';
import QuantityInput from './QuantityInput';

export interface EquipmentOptionCardProps {
  /**
   * Title or label of the option (e.g. "Module d'énergie FPRB", "CAB ONE", "B7 - 2600")
   */
  title: string;
  /**
   * Whether this option is selected
   */
  isSelected: boolean;
  /**
   * Select toggle callback
   */
  onToggle: (selected: boolean) => void;
  /**
   * Type of selection control: 'checkbox' | 'radio'
   */
  selectionType?: 'checkbox' | 'radio';
  /**
   * Optional category badge text (e.g. "Radio", "Énergie")
   */
  badgeText?: string;
  badgeClass?: string;
  /**
   * Optional quantity support. If quantity is specified and isSelected is true,
   * a QuantityInput is rendered.
   */
  quantity?: number;
  onQuantityChange?: (qty: number) => void;
  quantityLabel?: string;
  /**
   * Color theme: 'orange' | 'amber' | 'violet' | 'red' | 'emerald' | 'blue'
   */
  color?: 'orange' | 'amber' | 'violet' | 'red' | 'emerald' | 'blue';
  className?: string;
}

const COLOR_CLASSES: Record<string, {
  selectedBg: string;
  selectedBorder: string;
  selectedText: string;
  ring: string;
  checkColor: string;
  divider: string;
}> = {
  orange: {
    selectedBg: 'bg-orange-50/70',
    selectedBorder: 'border-orange-400',
    selectedText: 'text-orange-950',
    ring: 'ring-2 ring-orange-500/20',
    checkColor: 'bg-orange-600 border-orange-600',
    divider: 'border-orange-200/70'
  },
  amber: {
    selectedBg: 'bg-amber-50/70',
    selectedBorder: 'border-amber-300',
    selectedText: 'text-amber-950',
    ring: 'ring-2 ring-amber-500/20',
    checkColor: 'bg-amber-600 border-amber-600',
    divider: 'border-amber-200/70'
  },
  red: {
    selectedBg: 'bg-red-50/70',
    selectedBorder: 'border-red-300',
    selectedText: 'text-red-950',
    ring: 'ring-2 ring-red-500/20',
    checkColor: 'bg-red-600 border-red-600',
    divider: 'border-red-200/70'
  },
  violet: {
    selectedBg: 'bg-violet-50/70',
    selectedBorder: 'border-violet-300',
    selectedText: 'text-violet-950',
    ring: 'ring-2 ring-violet-500/20',
    checkColor: 'bg-violet-600 border-violet-600',
    divider: 'border-violet-200/70'
  },
  blue: {
    selectedBg: 'bg-blue-50/70',
    selectedBorder: 'border-blue-300',
    selectedText: 'text-blue-950',
    ring: 'ring-2 ring-blue-500/20',
    checkColor: 'bg-blue-600 border-blue-600',
    divider: 'border-blue-200/70'
  },
  emerald: {
    selectedBg: 'bg-emerald-50/70',
    selectedBorder: 'border-emerald-300',
    selectedText: 'text-emerald-950',
    ring: 'ring-2 ring-emerald-500/20',
    checkColor: 'bg-emerald-600 border-emerald-600',
    divider: 'border-emerald-200/70'
  }
};

export function EquipmentOptionCard({
  title,
  isSelected,
  onToggle,
  selectionType = 'checkbox',
  badgeText,
  badgeClass = 'bg-slate-100 text-slate-700 border-slate-200',
  quantity,
  onQuantityChange,
  quantityLabel = 'Quantité',
  color = 'orange',
  className = ''
}: EquipmentOptionCardProps) {
  const c = COLOR_CLASSES[color] || COLOR_CLASSES.orange;

  return (
    <div
      onClick={() => onToggle(!isSelected)}
      className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-xl border text-left cursor-pointer transition-all ${
        isSelected
          ? `${c.selectedBg} ${c.selectedBorder} ${c.ring} shadow-2xs`
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {selectionType === 'radio' ? (
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                isSelected ? `${c.selectedBorder} bg-white ring-2 ring-orange-200` : 'border-slate-300 bg-white'
              }`}
            >
              {isSelected && <div className={`w-2 h-2 rounded-full ${c.checkColor}`} />}
            </div>
          ) : (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggle(e.target.checked);
              }}
              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
            />
          )}

          <span
            className={`text-xs font-bold leading-snug break-words ${
              isSelected ? `${c.selectedText} font-extrabold` : 'text-slate-800'
            }`}
            title={title}
          >
            {title}
          </span>
        </div>

        {badgeText && (
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border shrink-0 ${badgeClass}`}>
            {badgeText}
          </span>
        )}
      </div>

      {isSelected && onQuantityChange && quantity !== undefined && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center justify-between mt-2.5 pt-2 border-t ${c.divider}`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
            {quantityLabel}
          </span>
          <QuantityInput
            value={quantity}
            onChange={onQuantityChange}
            size="sm"
            label=""
          />
        </div>
      )}
    </div>
  );
}

export default EquipmentOptionCard;
