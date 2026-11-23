import React from 'react';

export interface MastHeightInputProps {
  value?: number;
  onChange?: (val: number) => void;
  defaultValue?: number;
  disabled?: boolean;
  className?: string;
}

export function MastHeightInput({
  value,
  onChange,
  defaultValue = 1.50,
  disabled = false,
  className = '',
}: MastHeightInputProps) {
  const currentVal = value !== undefined && value !== null ? value : defaultValue;
  const isInvalid = currentVal < 0.5 || currentVal > 6.0 || isNaN(currentVal);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
          Hauteur du mât (m)
          <span className="text-rose-500 font-bold">*</span>
        </label>
        <span className="text-[10px] text-slate-400">
          0.50 m à 6.00 m
        </span>
      </div>
      <div className="relative">
        <input
          type="number"
          min="0.5"
          max="6.0"
          step="0.05"
          required
          disabled={disabled}
          value={currentVal}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            onChange?.(isNaN(raw) ? 0 : raw);
          }}
          className={`w-full px-2.5 py-1.5 text-xs font-semibold bg-white rounded-lg border transition-all outline-hidden ${
            isInvalid
              ? 'border-rose-400 focus:ring-2 focus:ring-rose-500 bg-rose-50/20 text-rose-900'
              : 'border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-slate-800'
          }`}
          placeholder={defaultValue.toFixed(2)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
          m
        </span>
      </div>
      {isInvalid && (
        <span className="text-[10px] font-medium text-rose-500">
          La hauteur du mât doit être comprise entre 0.5 m et 6.0 m.
        </span>
      )}
    </div>
  );
}

export default MastHeightInput;
