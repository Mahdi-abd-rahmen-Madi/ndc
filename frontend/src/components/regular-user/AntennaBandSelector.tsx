import React, { useEffect, useMemo } from 'react';
import { Radio, SignalHigh } from 'lucide-react';
import type { AntennaConfigState, CatalogueConfig, RealWorldReference } from './types';
import { styles } from './styles/MontageSelector.styles';

type StandardMontage = CatalogueConfig['standard_montages'][number];

interface AntennaBandSelectorProps {
  band: '4g' | '5g';
  configMode: 'agile' | 'reference';
  operator: string;
  montages: StandardMontage[];
  realWorldReferences: RealWorldReference[];
  selectedMontage: string;
  onMontageChange: (val: string) => void;
  antennaConfig: AntennaConfigState;
  setAntennaConfig: (val: AntennaConfigState | ((prev: AntennaConfigState) => AntennaConfigState)) => void;
  selectedVendor: string;
  setSelectedVendor?: (vendor: string) => void;
  selectedReference: string;
  setSelectedReference: (ref: string) => void;
}

export function AntennaBandSelector({
  band,
  configMode,
  operator,
  montages,
  realWorldReferences,
  selectedMontage,
  onMontageChange,
  antennaConfig,
  setAntennaConfig,
  selectedVendor,
  setSelectedVendor,
  selectedReference,
  setSelectedReference,
}: AntennaBandSelectorProps) {
  const is4G = band === '4g';
  const bandKey = is4G ? 'ant4g' : 'ant5g';

  const uniqueBandMap = useMemo(() => {
    const map = new Map<string, RealWorldReference>();
    realWorldReferences.forEach(r => {
      const ant = r[bandKey];
      if (ant?.model) {
        const existing = map.get(ant.model);
        if (!existing || (existing[bandKey].height === 0 && ant.height > 0)) {
          map.set(ant.model, r);
        }
      }
    });
    return map;
  }, [realWorldReferences, bandKey]);

  const availableVendors = useMemo(() => {
    return Array.from(
      new Set(
        Array.from(uniqueBandMap.values()).map(r => {
          const v = r.name.split(' ')[0];
          return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        })
      )
    ).sort();
  }, [uniqueBandMap]);

  const uniqueRefs = useMemo(() => {
    const vendorUpper = selectedVendor.toUpperCase();
    return Array.from(uniqueBandMap.values()).filter(
      r => r.name.toUpperCase().startsWith(vendorUpper) || r.name.toUpperCase().includes(vendorUpper)
    );
  }, [uniqueBandMap, selectedVendor]);

  useEffect(() => {
    if (availableVendors.length === 0 || !selectedVendor) return;

    const vendorExists = availableVendors.some(v => v.toUpperCase() === selectedVendor.toUpperCase());
    if (!vendorExists) {
      setSelectedVendor?.('');
      setSelectedReference('');
      return;
    }

    if (uniqueRefs.length > 0 && selectedReference) {
      const exists = uniqueRefs.some(r => r.id === selectedReference);
      if (!exists) {
        setSelectedReference('');
      }
    }
  }, [operator, availableVendors, selectedVendor, selectedReference, uniqueRefs, setSelectedVendor, setSelectedReference]);

  const handleVendorChange = (vendor: string) => {
    setSelectedVendor?.(vendor);
    setSelectedReference('');
    setAntennaConfig({ model: '', height: 0, width: 0, thickness: 0, weight: 0 });
    onMontageChange('');
  };

  const handleReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedReference(val);
    const ref = realWorldReferences.find(r => r.id === val);
    if (ref) {
      setAntennaConfig(ref[bandKey]);
      onMontageChange(ref.montageId);
    }
  };

  const renderDimension = (label: string, value: number, unit: string, onChange: (val: number) => void) => {
    if (configMode === 'reference') {
      return (
        <div className={styles.dimensionContainerRef}>
          <span className={styles.dimensionLabelRef}>{label}</span>
          <div className={styles.dimensionValueBoxRef}>
            <span className={styles.dimensionValueRef}>{value > 0 ? value : '-'}</span>
            <span className={styles.dimensionUnitRef}>{value > 0 ? unit : ''}</span>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.dimensionContainerInput}>
        <label className={styles.dimensionLabelInput}>{label} ({unit})</label>
        <input
          type="number"
          value={value > 0 ? value : ''}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.dimensionInput}
        />
      </div>
    );
  };

  return (
    <div className={styles.antennaContainer}>
      <h4 className={styles.antennaHeader}>
        <div className={is4G ? styles.iconContainer4G : styles.iconContainer5G}>
          {is4G ? <Radio className={styles.icon4G} /> : <SignalHigh className={styles.icon5G} />}
        </div>
        <span>
          {is4G ? 'Antenne 3G/4G' : 'Antenne 5G'} <span className="text-red-500 font-bold">*</span>
        </span>
      </h4>

      <div className={styles.dropdownContainer}>
        {configMode === 'agile' ? (
          <select
            value={selectedMontage || ''}
            onChange={(e) => onMontageChange(e.target.value)}
            className={styles.selectInput}
          >
            <option value="" disabled>Sélectionner un gabarit agile...</option>
            {montages.map((m) => (
              <option key={m.id} value={m.id}>
                {m[bandKey].height} x {m[bandKey].width} x {m[bandKey].thickness} mm ({m[bandKey].weight} kg)
              </option>
            ))}
            <option value="custom">Sur-mesure (Configuration Manuelle)</option>
          </select>
        ) : (
          <div className={styles.dropdownCol}>
            <select
              value={selectedVendor || ''}
              onChange={(e) => handleVendorChange(e.target.value)}
              className={styles.selectInput}
            >
              <option value="" disabled>Sélectionner une marque...</option>
              {availableVendors.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={selectedReference || ''}
              onChange={handleReferenceChange}
              className={styles.selectInput}
              disabled={!selectedVendor}
            >
              <option value="" disabled>
                {!selectedVendor ? "Choisir une marque d'abord" : 'Sélectionner une référence...'}
              </option>
              {uniqueRefs.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref[bandKey].model}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={styles.dimensionsGridContainer}>
        <div className={styles.dimensionsGrid}>
          {renderDimension('Hauteur', antennaConfig.height, 'mm', (val) => setAntennaConfig(prev => ({ ...prev, height: val })))}
          {renderDimension('Largeur', antennaConfig.width, 'mm', (val) => setAntennaConfig(prev => ({ ...prev, width: val })))}
          {renderDimension('Épaisseur', antennaConfig.thickness, 'mm', (val) => setAntennaConfig(prev => ({ ...prev, thickness: val })))}
          {renderDimension('Poids', antennaConfig.weight, 'Kg', (val) => setAntennaConfig(prev => ({ ...prev, weight: val })))}
        </div>
      </div>
    </div>
  );
}
