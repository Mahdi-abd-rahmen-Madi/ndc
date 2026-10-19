
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
  const isCustomHeight = Boolean(
    sectorData.selectedHeight !== undefined &&
    sectorData.selectedHeight !== null &&
    sectorData.selectedHeight !== 0 &&
    sectorData.selectedHeight !== 3 &&
    sectorData.selectedHeight !== 4 &&
    !recommendedMastHeights.includes(Number(sectorData.selectedHeight))
  );

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
        <div className={isCustomHeight ? styles.mastContainerCustom : styles.mastContainer}>
          {/* Top animated cyber beam on custom selection */}
          {isCustomHeight && (
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 overflow-hidden">
              <div className="w-1/3 h-full bg-white/70 blur-[1px] animate-shimmer-beam" />
            </div>
          )}

          <div className={isCustomHeight ? styles.mastDecoCustom : styles.mastDecoStandard}></div>

          <label className={styles.mastLabel}>
            <span className={styles.mastLabelInner}>
              <ArrowDownToLine className={isCustomHeight ? styles.mastIconCustom : styles.mastIcon} />
              <span>3. Hauteur du mât :</span>
            </span>
            {isCustomHeight && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs shadow-amber-500/30 animate-fadeIn">
                <span>Sur-Mesure ({sectorData.selectedHeight}m)</span>
              </span>
            )}
          </label>
          <div className={styles.mastInputsContainer}>
            <div className={styles.standardCol}>
              <label className={styles.standardLabel}>Standard</label>
              <div className={styles.standardButtonsContainer}>
                {recommendedMastHeights.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => updateSector(index, { selectedHeight: h })}
                    className={`${styles.standardButtonBase} ${sectorData.selectedHeight === h
                        ? styles.standardButtonActive
                        : styles.standardButtonInactive
                      }`}
                  >
                    {h}m
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.customCol}>
              <label className={isCustomHeight ? styles.customLabelActive : styles.customLabel}>
                <span>Personnalisé</span>
                {isCustomHeight && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-200/90 text-amber-900 border border-amber-300">
                    Actif
                  </span>
                )}
              </label>
              <div className={styles.customInputContainer}>
                <input
                  type="number"
                  min="0"
                  max="15"
                  step="0.5"
                  placeholder="Ex: 3.5"
                  value={sectorData.selectedHeight || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateSector(index, { selectedHeight: val === '' ? ('' as any) : Number(val) });
                  }}
                  className={isCustomHeight ? styles.customInputActive : styles.customInput}
                />
                <span className={isCustomHeight ? styles.customUnitActive : styles.customUnit}>m</span>
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
