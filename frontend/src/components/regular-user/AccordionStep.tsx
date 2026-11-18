import React from 'react';
import { Check, Pencil, ArrowRight, Lock } from 'lucide-react';

export interface AccordionStepProps {
  step: number;
  title: string;
  activeStep: number;
  setActiveStep: (step: number) => void;
  isCompleted: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  summary?: React.ReactNode;
  hideContinue?: boolean;
}

export function AccordionStep({
  step,
  title,
  activeStep,
  setActiveStep,
  isCompleted,
  disabled,
  children,
  summary,
  hideContinue
}: AccordionStepProps) {
  const isOpen = activeStep === step;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 mb-3 ${disabled
        ? 'opacity-70 border-slate-200/90 bg-slate-50/40 cursor-not-allowed overflow-hidden'
        : isOpen
          ? 'border-violet-400 shadow-md ring-4 ring-violet-500/10 overflow-visible z-20 relative'
          : 'border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs overflow-hidden'
        }`}
    >
      <div
        className={`px-4 py-3 sm:py-3.5 flex items-center justify-between transition-all ${disabled
          ? 'cursor-not-allowed'
          : isOpen
            ? 'bg-gradient-to-r from-violet-50/80 via-indigo-50/30 to-white border-b border-violet-100 cursor-pointer'
            : 'hover:bg-slate-50/80 cursor-pointer'
          }`}
        onClick={() => {
          if (!disabled) {
            setActiveStep(step);
          }
        }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-xl font-bold text-xs shrink-0 transition-all ${disabled
              ? 'bg-slate-100 text-slate-400 border border-slate-200'
              : isCompleted && !isOpen
                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200'
                : isOpen
                  ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
          >
            {isCompleted && !isOpen && !disabled ? (
              <Check className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
            ) : disabled ? (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              step
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`font-bold text-sm tracking-tight transition-colors ${disabled ? 'text-slate-500' : isOpen ? 'text-slate-900' : 'text-slate-800'
                  }`}
              >
                {title}
              </h3>
              {disabled && (
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60">
                  Verrouillé
                </span>
              )}
            </div>
            {!isOpen && isCompleted && !disabled && summary && (
              <div className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1 font-medium">
                {summary}
              </div>
            )}
            {!isOpen && disabled && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                Localisation précise (bâtiment ou surface) requise
              </div>
            )}
          </div>
        </div>

        {!isOpen && !disabled && (
          <button
            className="text-xs font-semibold text-slate-600 hover:text-violet-700 px-3 py-1.5 bg-slate-100/80 hover:bg-violet-50 rounded-xl border border-slate-200/80 hover:border-violet-200 transition-all flex items-center gap-1.5 shadow-2xs shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setActiveStep(step);
            }}
          >
            <Pencil className="w-3 h-3" />
            Modifier
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-5 animate-fadeIn">
          {children}
          {!hideContinue && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveStep(step + 1)}
                className="group px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md shadow-violet-500/20 hover:shadow-violet-500/30 transition-all flex items-center gap-2"
              >
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
