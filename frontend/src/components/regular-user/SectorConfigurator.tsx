
import { useState, useEffect } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { SectorData, CatalogueConfig, AntennaConfigState } from './types';
import MontageSelector from './MontageSelector';
import { styles } from './styles/SectorConfigurator.styles';

interface SectorConfiguratorProps {
  index: number;
  sectorData: SectorData;
  updateSector: (index: number, updates: Partial<SectorData>) => void;
  config: CatalogueConfig | null;
  collapsed?: boolean;
  operator?: string;
  children?: React.ReactNode;
}

export default function SectorConfigurator({
  index,
  sectorData,
  updateSector,
  config,
  collapsed,
  operator = 'bouygues',
  children
}: SectorConfiguratorProps) {
  const recommendedMastHeights = config?.recommended_mast_heights || [3, 4];
  const isStandardHeight = recommendedMastHeights.includes(Number(sectorData.selectedHeight));
  const [customInputText, setCustomInputText] = useState<string>(() => {
    if (sectorData.selectedHeight !== undefined && sectorData.selectedHeight !== null && !recommendedMastHeights.includes(Number(sectorData.selectedHeight))) {
      return String(sectorData.selectedHeight);
    }
    return '';
  });

  const isCustomActive = !isStandardHeight || customInputText !== '';

  useEffect(() => {
    // If standard button was clicked, clear the custom input text
    if (isStandardHeight && customInputText !== '' && Number(customInputText) !== sectorData.selectedHeight) {
      setCustomInputText('');
    }
  }, [sectorData.selectedHeight, isStandardHeight]);

  const handleMontage4GChange = (val: string) => {
    const updates: Partial<SectorData> = { selectedMontage4G: val };

    if (!val) {
      updates.ant4gConfig = { model: '', height: 0, width: 0, thickness: 0, weight: 0 };
    } else if (val !== 'custom') {
      const spec = config?.standard_montages.find(m => m.id === val);
      if (spec) {
        updates.ant4gConfig = { model: val, height: spec.ant4g.height, width: spec.ant4g.width, thickness: spec.ant4g.thickness, weight: spec.ant4g.weight };
      }
    }
    updateSector(index, updates);
  };

  const handleMontage5GChange = (val: string) => {
    const updates: Partial<SectorData> = { selectedMontage5G: val };

    if (!val) {
      updates.ant5gConfig = { model: '', height: 0, width: 0, thickness: 0, weight: 0 };
    } else if (val !== 'custom') {
      const spec = config?.standard_montages.find(m => m.id === val);
      if (spec) {
        updates.ant5gConfig = { model: val, height: spec.ant5g.height, width: spec.ant5g.width, thickness: spec.ant5g.thickness, weight: spec.ant5g.weight };
      }
    }
    updateSector(index, updates);
  };

  const handleSetAnt4gConfig = (val: AntennaConfigState | ((prev: AntennaConfigState) => AntennaConfigState)) => {
    updateSector(index, { ant4gConfig: typeof val === 'function' ? val(sectorData.ant4gConfig) : val });
  };

  const handleSetAnt5gConfig = (val: AntennaConfigState | ((prev: AntennaConfigState) => AntennaConfigState)) => {
    updateSector(index, { ant5gConfig: typeof val === 'function' ? val(sectorData.ant5gConfig) : val });
  };

  if (collapsed) {
    return (
      <div className={styles.collapsedContainer}>
        <h3 className={styles.collapsedHeader}>
          <span className={styles.collapsedBadgeNumber}>
            {index + 1}
          </span>
          Secteur {index + 1}
        </h3>
        <span className={styles.collapsedTag}>
          Identique au Secteur 1
        </span>
      </div>
    );
  }

  return (
    <div className={`${styles.mainContainer} ${
      operator === 'orange' ? 'hover:border-orange-200' :
      operator === 'free' ? 'hover:border-red-200' :
      'hover:border-sky-200'
    }`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full pointer-events-none transition-colors ${
        operator === 'orange' ? 'bg-orange-500/[0.04]' :
        operator === 'free' ? 'bg-red-500/[0.04]' :
        'bg-sky-500/[0.04]'
      }`}></div>

      <div className={styles.headerContainer}>
        <h3 className={styles.headerTitle}>
          <span className={styles.headerBadgeNumber}>
            {index + 1}
          </span>
          Secteur {index + 1}
        </h3>
      </div>

      <div className={styles.contentSpace}>
        {/* Hauteur du Mât */}
        <div className={styles.mastContainer}>
          <div className={styles.mastDecoStandard}></div>

          <label className={styles.mastLabel}>
            <span className={styles.mastLabelInner}>
              <ArrowDownToLine className={styles.mastIcon} />
              <span>3. Hauteur du mât :</span>
            </span>
          </label>
          <div className={styles.mastInputsContainer}>
            <div className={styles.standardCol}>
              <label className={styles.standardLabel}>Standard</label>
              <div className={styles.standardButtonsContainer}>
                {recommendedMastHeights.map(h => {
                  const isSelected = sectorData.selectedHeight === h && customInputText === '';
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setCustomInputText('');
                        updateSector(index, { selectedHeight: h });
                      }}
                      className={`${styles.standardButtonBase} ${isSelected
                          ? styles.standardButtonActive
                          : styles.standardButtonInactive
                        }`}
                    >
                      {h}m
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.customCol}>
              <label className={customInputText !== '' ? styles.customLabelActive : styles.customLabel}>
                <span>Personnalisé</span>
              </label>
              <div className={styles.customInputContainer}>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 3.5"
                  value={customInputText}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    // Allow numbers and decimal points only
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setCustomInputText(val);
                      const num = parseFloat(val);
                      if (!isNaN(num) && num > 0) {
                        updateSector(index, { selectedHeight: num });
                      } else if (val === '') {
                        updateSector(index, { selectedHeight: 3 }); // default fallback or keep 3
                      }
                    }
                  }}
                  className={customInputText !== '' ? styles.customInputActive : styles.customInput}
                />
                <span className={customInputText !== '' ? styles.customUnitActive : styles.customUnit}>m</span>
              </div>
            </div>
          </div>
        </div>


        {/* Configuration de l'Antenne */}
        <MontageSelector
          selectedMontage4G={sectorData.selectedMontage4G}
          selectedMontage5G={sectorData.selectedMontage5G}
          handleMontage4GChange={handleMontage4GChange}
          handleMontage5GChange={handleMontage5GChange}
          ant4gConfig={sectorData.ant4gConfig}
          setAnt4gConfig={handleSetAnt4gConfig}
          ant5gConfig={sectorData.ant5gConfig}
          setAnt5gConfig={handleSetAnt5gConfig}
          config={config}
          configMode={sectorData.configMode}
          setConfigMode={(mode) => updateSector(index, { configMode: mode })}
          selectedReference4G={sectorData.selectedReference4G}
          selectedReference5G={sectorData.selectedReference5G}
          setSelectedReference4G={(ref) => updateSector(index, { selectedReference4G: ref })}
          setSelectedReference5G={(ref) => updateSector(index, { selectedReference5G: ref })}
          selectedVendor4G={sectorData.selectedVendor4G}
          selectedVendor5G={sectorData.selectedVendor5G}
          setSelectedVendor4G={(vendor) => updateSector(index, { selectedVendor4G: vendor })}
          setSelectedVendor5G={(vendor) => updateSector(index, { selectedVendor5G: vendor })}
          operator={operator}
        >
          {children}
        </MontageSelector>

      </div>
    </div>
  );
}
