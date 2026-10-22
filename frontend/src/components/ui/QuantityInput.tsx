import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface QuantityInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unitLabel?: string; // e.g. "/ secteur"
  nombreSecteurs?: number; // if specified and > 1, displays the "Total site : X (Y secteurs)" badge
  totalBadgeText?: string; // custom badge text if not using standard secteur multiplication
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function QuantityInput({
  value = 1,
  onChange,
  min = 1,
  max,
  step = 1,
  label = 'Qté :',
  unitLabel,
  nombreSecteurs,
  totalBadgeText,
  disabled = false,
  className = '',
  size = 'sm'
}: QuantityInputProps) {
  const currentVal = value ?? min;

  const handleIncrement = () => {
    if (disabled) return;
    const nextVal = currentVal + step;
    if (max !== undefined && nextVal > max) return;
    onChange(nextVal);
  };

  const handleDecrement = () => {
    if (disabled) return;
    const nextVal = currentVal - step;
    if (min !== undefined && nextVal < min) return;
    onChange(nextVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let parsed = parseInt(e.target.value, 10);
    if (isNaN(parsed)) parsed = min;
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    onChange(parsed);
  };

  const showTotalBadge = totalBadgeText || (nombreSecteurs !== undefined && nombreSecteurs > 1);
  const badgeContent = totalBadgeText || (
    nombreSecteurs !== undefined && nombreSecteurs > 1
      ? `Total site : ${currentVal * nombreSecteurs} (${nombreSecteurs} secteurs)`
      : null
  );

  const isSmall = size === 'sm';

  return (
    <div className={`flex items-center gap-2.5 flex-wrap ${className}`}>
      <div className="flex items-center gap-1.5">
        {label && (
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold select-none">
            {label}
          </label>
        )}
        <div
          className={`flex bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500'
          } ${isSmall ? 'h-7' : 'h-8'}`}
        >
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={currentVal}
            onChange={handleInputChange}
            disabled={disabled}
            className={`bg-transparent border-none py-0 px-2 text-xs text-center text-slate-900 focus:ring-0 w-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium ${
              disabled ? 'cursor-not-allowed' : ''
            }`}
          />
          <div className="flex flex-col border-l border-slate-300 w-5">
            <button
              type="button"
              onClick={handleIncrement}
              disabled={disabled || (max !== undefined && currentVal >= max)}
              className="flex-1 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border-b border-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleDecrement}
              disabled={disabled || (min !== undefined && currentVal <= min)}
              className="flex-1 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {(unitLabel || showTotalBadge) && (
        <div className="flex items-center gap-1 text-xs">
          {unitLabel && <span className="text-slate-500 font-medium">{unitLabel}</span>}
          {showTotalBadge && badgeContent && (
            <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200 shadow-2xs">
              {badgeContent}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default QuantityInput;
