import React, { useEffect, useMemo } from 'react';
import { Settings, Radio, SignalHigh } from 'lucide-react';
import { CatalogueConfig, AntennaConfigState } from './types';
import { styles } from './styles/MontageSelector.styles';

interface MontageSelectorProps {
  selectedMontage4G: string;
  selectedMontage5G: string;
  handleMontage4GChange: (val: string) => void;
  handleMontage5GChange: (val: string) => void;
  ant4gConfig: AntennaConfigState;
  setAnt4gConfig: (val: AntennaConfigState | ((prev: AntennaConfigState) => AntennaConfigState)) => void;
  ant5gConfig: AntennaConfigState;
  setAnt5gConfig: (val: AntennaConfigState | ((prev: AntennaConfigState) => AntennaConfigState)) => void;
  config: CatalogueConfig | null;
  configMode: 'agile' | 'reference';
  setConfigMode: (mode: 'agile' | 'reference') => void;
  selectedReference4G: string;
  selectedReference5G: string;
  setSelectedReference4G: (ref: string) => void;
  setSelectedReference5G: (ref: string) => void;
  selectedVendor4G?: string;
  selectedVendor5G?: string;
  setSelectedVendor4G?: (vendor: string) => void;
  setSelectedVendor5G?: (vendor: string) => void;
  operator?: string;
}

export default function MontageSelector({
  selectedMontage4G,
  selectedMontage5G,
  handleMontage4GChange,
  handleMontage5GChange,
  ant4gConfig,
  setAnt4gConfig,
  ant5gConfig,
  setAnt5gConfig,
  config,
  configMode,
  setConfigMode,
  selectedReference4G,
  selectedReference5G,
  setSelectedReference4G,
  setSelectedReference5G,
  selectedVendor4G = 'Ericsson',
  selectedVendor5G = 'Ericsson',
  setSelectedVendor4G,
  setSelectedVendor5G,
  operator = 'bouygues'
}: MontageSelectorProps) {
  const montages = config?.standard_montages || [];
  const realWorldReferences = (config?.real_world_references || []).filter(r => 
    !r.ant4g.model.toLowerCase().includes('agile') &&
    !r.ant5g.model.toLowerCase().includes('agile') &&
    !r.name.toLowerCase().includes('agile') &&
    r.operator?.toLowerCase() === operator.toLowerCase()
  );

  // Create maps for unique references, preferring ones that have actual dimensions (height > 0)
  const unique4GMap = new Map<string, typeof realWorldReferences[0]>();
  const unique5GMap = new Map<string, typeof realWorldReferences[0]>();

  realWorldReferences.forEach(r => {
    // For 4G
    if (r.ant4g?.model) {
      const existing = unique4GMap.get(r.ant4g.model);
      if (!existing || (existing.ant4g.height === 0 && r.ant4g.height > 0)) {
        unique4GMap.set(r.ant4g.model, r);
      }
    }
    // For 5G
    if (r.ant5g?.model) {
      const existing = unique5GMap.get(r.ant5g.model);
      if (!existing || (existing.ant5g.height === 0 && r.ant5g.height > 0)) {
        unique5GMap.set(r.ant5g.model, r);
      }
    }
  });

  const availableVendors4G = useMemo(() => {
    return Array.from(new Set(Array.from(unique4GMap.values()).map(r => {
      const v = r.name.split(' ')[0];
      return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    }))).sort();
  }, [unique4GMap]);

  const availableVendors5G = useMemo(() => {
    return Array.from(new Set(Array.from(unique5GMap.values()).map(r => {
      const v = r.name.split(' ')[0];
      return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    }))).sort();
  }, [unique5GMap]);

  // Handle vendor fallback if selected vendor isn't available for this operator
  useEffect(() => {
    if (availableVendors4G.length > 0 && !availableVendors4G.map(v => v.toUpperCase()).includes(selectedVendor4G.toUpperCase())) {
      setSelectedVendor4G?.(availableVendors4G[0]);
    }
    if (availableVendors5G.length > 0 && !availableVendors5G.map(v => v.toUpperCase()).includes(selectedVendor5G.toUpperCase())) {
      setSelectedVendor5G?.(availableVendors5G[0]);
    }
  }, [availableVendors4G, availableVendors5G, selectedVendor4G, selectedVendor5G, setSelectedVendor4G, setSelectedVendor5G]);

  const unique4GRefs = Array.from(unique4GMap.values()).filter(r => r.name.toUpperCase().includes(selectedVendor4G.toUpperCase()));
  const unique5GRefs = Array.from(unique5GMap.values()).filter(r => r.name.toUpperCase().includes(selectedVendor5G.toUpperCase()));

  useEffect(() => {
    if (configMode === 'reference' && unique4GRefs.length > 0 && unique5GRefs.length > 0) {
      const current4G = unique4GRefs.find(r => r.id === selectedReference4G);
      if (!current4G) {
        const fallback4G = unique4GRefs[0];
        setSelectedReference4G(fallback4G.id);
        setAnt4gConfig(fallback4G.ant4g);
        handleMontage4GChange(fallback4G.montageId);
      }
      
      const current5G = unique5GRefs.find(r => r.id === selectedReference5G);
      if (!current5G) {
        const fallback5G = unique5GRefs[0];
        setSelectedReference5G(fallback5G.id);
        setAnt5gConfig(fallback5G.ant5g);
        handleMontage5GChange(fallback5G.montageId);
      }
    }
  }, [configMode, selectedReference4G, selectedReference5G, unique4GRefs, unique5GRefs]);

  const handleConfigModeChange = (mode: 'agile' | 'reference') => {
    setConfigMode(mode);
    if (mode === 'reference') {
      const ref4G = unique4GRefs.find(r => r.id === selectedReference4G) || unique4GRefs[0];
      const ref5G = unique5GRefs.find(r => r.id === selectedReference5G) || unique5GRefs[0];
      
      if (ref4G) {
        setSelectedReference4G(ref4G.id);
        setAnt4gConfig(ref4G.ant4g);
        handleMontage4GChange(ref4G.montageId);
      }
      if (ref5G) {
        setSelectedReference5G(ref5G.id);
        setAnt5gConfig(ref5G.ant5g);
        handleMontage5GChange(ref5G.montageId);
      }
    } else {
      const spec = montages[0];
      if (spec) {
        handleMontage4GChange(spec.id);
        handleMontage5GChange(spec.id);
      }
    }
  };

  const handleReference4GChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedReference4G(val);
    const ref = realWorldReferences.find(r => r.id === val);
    if (ref) {
      setAnt4gConfig(ref.ant4g);
      handleMontage4GChange(ref.montageId);
    }
  };

  const handleReference5GChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedReference5G(val);
    const ref = realWorldReferences.find(r => r.id === val);
    if (ref) {
      setAnt5gConfig(ref.ant5g);
      handleMontage5GChange(ref.montageId);
    }
  };

  const renderDimension = (label: string, value: number, unit: string, onChange: (val: number) => void) => {
    if (configMode === 'reference') {
      return (
        <div className={styles.dimensionContainerRef}>
          <span className={styles.dimensionLabelRef}>{label}</span>
          <div className={styles.dimensionValueBoxRef}>
            <span className={styles.dimensionValueRef}>{value}</span>
            <span className={styles.dimensionUnitRef}>{unit}</span>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.dimensionContainerInput}>
        <label className={styles.dimensionLabelInput}>{label} ({unit})</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.dimensionInput}
        />
      </div>
    );
  };

  return (
    <div className={styles.mainContainer}>
      <div className={styles.configContainer}>
        <label className={styles.configHeader}>
          <Settings className={styles.configIcon} />
          4. Configuration de l'Antenne
        </label>

        {/* Segmented Control */}
        <div className={styles.segmentedControlContainer}>
          <div 
            className={styles.segmentedControlSlider}
            style={{ 
              width: 'calc(50% - 4px)', 
              left: configMode === 'agile' ? '4px' : 'calc(50%)' 
            }}
          />
          <button
            type="button"
            onClick={() => handleConfigModeChange('agile')}
            className={`${styles.segmentedControlButtonBase} ${
              configMode === 'agile' ? styles.segmentedControlButtonActive : styles.segmentedControlButtonInactive
            }`}
          >
            Dimensions Agiles
          </button>
          <button
            type="button"
            onClick={() => handleConfigModeChange('reference')}
            className={`${styles.segmentedControlButtonBase} ${
              configMode === 'reference' ? styles.segmentedControlButtonActive : styles.segmentedControlButtonInactive
            }`}
          >
            Références (Dimensions réelles)
          </button>
        </div>



        <div className={styles.gridContainer}>
          {/* Antenne 4G */}
          <div className={styles.antennaContainer}>
            <h4 className={styles.antennaHeader}>
              <div className={styles.iconContainer4G}>
                <Radio className={styles.icon4G} />
              </div>
              Antenne 4G
            </h4>
            
            {/* Dropdown 4G */}
            <div className={styles.dropdownContainer}>
              {configMode === 'agile' ? (
                <select
                  value={selectedMontage4G}
                  onChange={(e) => handleMontage4GChange(e.target.value)}
                  className={styles.selectInput}
                >
                  {montages.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ant4g.height} x {m.ant4g.width} x {m.ant4g.thickness} mm ({m.ant4g.weight} kg)
                    </option>
                  ))}
                  <option value="custom">Sur-mesure (Configuration Manuelle)</option>
                </select>
              ) : (
                <div className={styles.dropdownCol}>
                  <select
                    value={selectedVendor4G}
                    onChange={(e) => setSelectedVendor4G?.(e.target.value)}
                    className={styles.selectInput}
                  >
                    {availableVendors4G.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <select
                    value={selectedReference4G}
                    onChange={handleReference4GChange}
                    className={styles.selectInput}
                  >
                    {unique4GRefs.map((ref) => (
                      <option key={ref.id} value={ref.id}>
                        {ref.ant4g.model}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.dimensionsGridContainer}>
              <div className={styles.dimensionsGrid}>
                {renderDimension('Hauteur', ant4gConfig.height, 'mm', (val) => setAnt4gConfig(prev => ({ ...prev, height: val })))}
                {renderDimension('Largeur', ant4gConfig.width, 'mm', (val) => setAnt4gConfig(prev => ({ ...prev, width: val })))}
                {renderDimension('Épaisseur', ant4gConfig.thickness, 'mm', (val) => setAnt4gConfig(prev => ({ ...prev, thickness: val })))}
                {renderDimension('Poids', ant4gConfig.weight, 'Kg', (val) => setAnt4gConfig(prev => ({ ...prev, weight: val })))}
              </div>
            </div>
          </div>

          {/* Antenne 5G */}
          <div className={styles.antennaContainer}>
            <h4 className={styles.antennaHeader}>
              <div className={styles.iconContainer5G}>
                <SignalHigh className={styles.icon5G} />
              </div>
              Antenne 5G
            </h4>
            
            {/* Dropdown 5G */}
            <div className={styles.dropdownContainer}>
              {configMode === 'agile' ? (
                <select
                  value={selectedMontage5G}
                  onChange={(e) => handleMontage5GChange(e.target.value)}
                  className={styles.selectInput}
                >
                  {montages.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ant5g.height} x {m.ant5g.width} x {m.ant5g.thickness} mm ({m.ant5g.weight} kg)
                    </option>
                  ))}
                  <option value="custom">Sur-mesure (Configuration Manuelle)</option>
                </select>
              ) : (
                <div className={styles.dropdownCol}>
                  <select
                    value={selectedVendor5G}
                    onChange={(e) => setSelectedVendor5G?.(e.target.value)}
                    className={styles.selectInput}
                  >
                    {availableVendors5G.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <select
                    value={selectedReference5G}
                    onChange={handleReference5GChange}
                    className={styles.selectInput}
                  >
                    {unique5GRefs.map((ref) => (
                      <option key={ref.id} value={ref.id}>
                        {ref.ant5g.model}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.dimensionsGridContainer}>
              <div className={styles.dimensionsGrid}>
                {renderDimension('Hauteur', ant5gConfig.height, 'mm', (val) => setAnt5gConfig(prev => ({ ...prev, height: val })))}
                {renderDimension('Largeur', ant5gConfig.width, 'mm', (val) => setAnt5gConfig(prev => ({ ...prev, width: val })))}
                {renderDimension('Épaisseur', ant5gConfig.thickness, 'mm', (val) => setAnt5gConfig(prev => ({ ...prev, thickness: val })))}
                {renderDimension('Poids', ant5gConfig.weight, 'Kg', (val) => setAnt5gConfig(prev => ({ ...prev, weight: val })))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
