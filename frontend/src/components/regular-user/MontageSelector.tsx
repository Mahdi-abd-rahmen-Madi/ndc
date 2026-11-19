import React, { useMemo } from 'react';
import { Settings } from 'lucide-react';
import { CatalogueConfig, AntennaConfigState } from './types';
import { AntennaBandSelector } from './AntennaBandSelector';
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
  echelleControl?: React.ReactNode;
  mastHeightControl?: React.ReactNode;
  children?: React.ReactNode;
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
  selectedVendor4G = '',
  selectedVendor5G = '',
  setSelectedVendor4G,
  setSelectedVendor5G,
  operator = 'bouygues',
  echelleControl,
  mastHeightControl,
  children,
}: MontageSelectorProps) {
  const montages = config?.standard_montages || [];
  const realWorldReferences = useMemo(() => {
    return (config?.real_world_references || []).filter(
      r =>
        !r.ant4g.model.toLowerCase().includes('agile') &&
        !r.ant5g.model.toLowerCase().includes('agile') &&
        !r.name.toLowerCase().includes('agile') &&
        r.operator?.toLowerCase() === operator.toLowerCase()
    );
  }, [config?.real_world_references, operator]);

  return (
    <div className={styles.mainContainer}>
      <div className={styles.configContainer}>
        <label className={styles.configHeader}>
          <Settings className={styles.configIcon} />
          Configuration du Site
        </label>

        {mastHeightControl}
        {echelleControl}

        {/* Segmented Control */}
        <div className={styles.segmentedControlContainer}>
          <div
            className={styles.segmentedControlSlider}
            style={{
              width: 'calc(50% - 4px)',
              left: configMode === 'agile' ? '4px' : 'calc(50%)',
            }}
          />
          <button
            type="button"
            onClick={() => setConfigMode('agile')}
            className={`${styles.segmentedControlButtonBase} ${
              configMode === 'agile'
                ? styles.segmentedControlButtonActive
                : styles.segmentedControlButtonInactive
            }`}
          >
            Dimensions Agiles
          </button>
          <button
            type="button"
            onClick={() => setConfigMode('reference')}
            className={`${styles.segmentedControlButtonBase} ${
              configMode === 'reference'
                ? styles.segmentedControlButtonActive
                : styles.segmentedControlButtonInactive
            }`}
          >
            Références (Dimensions réelles)
          </button>
        </div>

        <div className={styles.gridContainer}>
          <AntennaBandSelector
            band="4g"
            configMode={configMode}
            operator={operator}
            montages={montages}
            realWorldReferences={realWorldReferences}
            selectedMontage={selectedMontage4G}
            onMontageChange={handleMontage4GChange}
            antennaConfig={ant4gConfig}
            setAntennaConfig={setAnt4gConfig}
            selectedVendor={selectedVendor4G}
            setSelectedVendor={setSelectedVendor4G}
            selectedReference={selectedReference4G}
            setSelectedReference={setSelectedReference4G}
          />
          <AntennaBandSelector
            band="5g"
            configMode={configMode}
            operator={operator}
            montages={montages}
            realWorldReferences={realWorldReferences}
            selectedMontage={selectedMontage5G}
            onMontageChange={handleMontage5GChange}
            antennaConfig={ant5gConfig}
            setAntennaConfig={setAnt5gConfig}
            selectedVendor={selectedVendor5G}
            setSelectedVendor={setSelectedVendor5G}
            selectedReference={selectedReference5G}
            setSelectedReference={setSelectedReference5G}
          />
        </div>

        {children}
      </div>
    </div>
  );
}
