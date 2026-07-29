
import { ArrowDownToLine } from 'lucide-react';
import { SectorData, CatalogueConfig, AntennaConfigState } from './types';
import MontageSelector from './MontageSelector';

interface SectorConfiguratorProps {
  index: number;
  sectorData: SectorData;
  updateSector: (index: number, updates: Partial<SectorData>) => void;
  config: CatalogueConfig | null;
  collapsed?: boolean;
}

export default function SectorConfigurator({
  index,
  sectorData,
  updateSector,
  config,
  collapsed
}: SectorConfiguratorProps) {
  const recommendedMastHeights = config?.recommended_mast_heights || [3, 4];

  const handleMontage4GChange = (val: string) => {
    const updates: Partial<SectorData> = { selectedMontage4G: val };
    
    if (val !== 'custom') {
      const spec = config?.standard_montages.find(m => m.id === val);
      if (spec) {
        updates.ant4gConfig = { model: val, height: spec.ant4g.height, width: spec.ant4g.width, thickness: spec.ant4g.thickness, weight: spec.ant4g.weight };
      }
    }
    updateSector(index, updates);
  };

  const handleMontage5GChange = (val: string) => {
    const updates: Partial<SectorData> = { selectedMontage5G: val };
    
    if (val !== 'custom') {
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
      <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-4 mb-6 flex items-center justify-between opacity-80">
        <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-500 text-sm">
            {index + 1}
          </span>
          Secteur {index + 1}
        </h3>
        <span className="text-xs text-emerald-500/80 font-medium bg-emerald-500/10 px-2 py-1 rounded">
          Identique au Secteur 1
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-5 mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
      
      <div className="flex items-center justify-between mb-5 border-b border-slate-700/50 pb-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-sm">
            {index + 1}
          </span>
          Secteur {index + 1}
        </h3>
      </div>

      <div className="space-y-6">
        {/* Hauteur du Mât */}
        <div className="flex flex-col space-y-2 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full -z-10 group-hover:bg-emerald-500/10 transition-colors"></div>
          
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
              3. Hauteur du mât (h)
            </span>
          </label>
          <div className="flex gap-2 mb-2">
            {recommendedMastHeights.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => updateSector(index, { selectedHeight: h })}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                  sectorData.selectedHeight === h
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'
                }`}
              >
                {h}m
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="15"
              step="0.5"
              value={sectorData.selectedHeight}
              onChange={(e) => updateSector(index, { selectedHeight: Number(e.target.value) })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 transition-colors"
            />
            <span className="text-slate-400 text-sm font-medium">m</span>
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
        />

      </div>
    </div>
  );
}
