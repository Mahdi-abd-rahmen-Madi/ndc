import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface OptionGroup {
  label: string;
  options: Option[];
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
  groups?: OptionGroup[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomSelect({ value, onChange, options = [], groups = [], placeholder = "Sélectionner...", className = "", disabled = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let selectedOption = options.find(o => o.value === value);
  if (!selectedOption) {
    for (const group of groups) {
      const found = group.options.find(o => o.value === value);
      if (found) {
        selectedOption = found;
        break;
      }
    }
  }

  const renderOption = (opt: Option) => (
    <div
      key={opt.value}
      className={`px-3 py-2 text-sm flex items-center justify-between ${opt.disabled ? 'opacity-50 cursor-not-allowed bg-slate-800' : 'cursor-pointer hover:bg-slate-700'} ${opt.value === value ? 'bg-indigo-900/40 text-indigo-200' : 'text-slate-200'}`}
      onClick={() => {
        if (!opt.disabled) {
          onChange(opt.value);
          setIsOpen(false);
        }
      }}
    >
      <span className="truncate">{opt.label}</span>
      {opt.value === value && <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />}
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-sm text-white flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-600'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="truncate mr-2">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-xl custom-scrollbar">
          {options.length === 0 && groups.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">Aucune option</div>
          ) : (
            <div className="py-1">
              {options.map(renderOption)}
              {groups.map(group => (
                <div key={group.label} className="mt-2 first:mt-0">
                  <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/80 sticky top-0">
                    {group.label}
                  </div>
                  {group.options.map(renderOption)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
