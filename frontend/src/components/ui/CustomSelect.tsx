import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { styles } from './styles/CustomSelect.styles';

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
      className={`${styles.optionBase} ${opt.disabled ? styles.optionDisabled : styles.optionEnabled} ${opt.value === value ? styles.optionSelected : ''}`}
      onClick={() => {
        if (!opt.disabled) {
          onChange(opt.value);
          setIsOpen(false);
        }
      }}
    >
      <span className={styles.optionLabel}>{opt.label}</span>
      {opt.value === value && <Check className={styles.optionCheckIcon} />}
    </div>
  );

  return (
    <div className={`${styles.selectContainer} ${className}`} ref={containerRef}>
      <div 
        className={`${styles.triggerBase} ${disabled ? styles.triggerDisabled : styles.triggerEnabled}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={styles.triggerValue}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`${styles.triggerIcon} ${isOpen ? styles.triggerIconOpen : ''}`} />
      </div>
      
      {isOpen && !disabled && (
        <div className={styles.dropdownMenu}>
          {options.length === 0 && groups.length === 0 ? (
            <div className={styles.emptyState}>Aucune option</div>
          ) : (
            <div className={styles.listContainer}>
              {options.map(renderOption)}
              {groups.map(group => (
                <div key={group.label} className={styles.groupContainer}>
                  <div className={styles.groupLabel}>
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
