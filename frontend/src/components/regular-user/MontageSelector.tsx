import React from 'react';
import { Settings, Info } from 'lucide-react';
import { CatalogueConfig, AntennaConfigState } from './types';

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
  setSelectedReference5G
}: MontageSelectorProps) {
  const montages = config?.standard_montages || [];
  const realWorldReferences = config?.real_world_references || [];

  const unique4GRefs = Array.from(new Map(realWorldReferences.map(r => [r.ant4g.model, r])).values());
  const unique5GRefs = Array.from(new Map(realWorldReferences.map(r => [r.ant5g.model, r])).values());

  const handleConfigModeChange = (mode: 'agile' | 'reference') => {
    setConfigMode(mode);
    if (mode === 'reference') {
      const ref4G = realWorldReferences.find(r => r.id === selectedReference4G) || realWorldReferences[0];
      const ref5G = realWorldReferences.find(r => r.id === selectedReference5G) || realWorldReferences[0];
      
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

  return (
    <div className="flex flex-col space-y-4">
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <label className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-indigo-400" />
          4. Configuration de l'Antenne
        </label>

        <div className="flex gap-2 p-1 bg-slate-950 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => handleConfigModeChange('agile')}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${configMode === 'agile'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            Dimensions Agiles
          </button>
          <button
            type="button"
            onClick={() => handleConfigModeChange('reference')}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${configMode === 'reference'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            Références (Dimensions réelles)
          </button>
        </div>

        {(selectedMontage4G === 'custom' || selectedMontage5G === 'custom' || selectedMontage4G !== selectedMontage5G) && configMode === 'agile' && (
          <div className="mb-6 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-start gap-2 animate-fadeIn">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200">
              Configuration sur-mesure activée ou configurations 4G/5G différentes. Un nouveau calcul structurel sera nécessaire car cette configuration ne correspond à aucun montage complet précalculé.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Antenne 4G */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Antenne 4G
            </h4>
            
            {/* Dropdown 4G */}
            <div className="mb-4">
              {configMode === 'agile' ? (
                <select
                  value={selectedMontage4G}
                  onChange={(e) => handleMontage4GChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors hover:border-slate-600 cursor-pointer"
                >
                  {montages.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ant4g.height} x {m.ant4g.width} x {m.ant4g.thickness} mm ({m.ant4g.weight} kg)
                    </option>
                  ))}
                  <option value="custom">Sur-mesure (Configuration Manuelle)</option>
                </select>
              ) : (
                <select
                  value={selectedReference4G}
                  onChange={handleReference4GChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors hover:border-slate-600 cursor-pointer"
                >
                  {unique4GRefs.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.ant4g.model}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <div className="mb-2">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Modèle</label>
                <input
                  type="text"
                  value={ant4gConfig.model || ''}
                  onChange={(e) => setAnt4gConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                  disabled={configMode === 'reference'}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Hauteur (mm)</label>
                  <input
                    type="number"
                    value={ant4gConfig.height}
                    onChange={(e) => setAnt4gConfig(prev => ({ ...prev, height: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Largeur (mm)</label>
                  <input
                    type="number"
                    value={ant4gConfig.width}
                    onChange={(e) => setAnt4gConfig(prev => ({ ...prev, width: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Épaisseur (mm)</label>
                  <input
                    type="number"
                    value={ant4gConfig.thickness}
                    onChange={(e) => setAnt4gConfig(prev => ({ ...prev, thickness: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Poids (Kg)</label>
                  <input
                    type="number"
                    value={ant4gConfig.weight}
                    onChange={(e) => setAnt4gConfig(prev => ({ ...prev, weight: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Antenne 5G */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              Antenne 5G
            </h4>
            
            {/* Dropdown 5G */}
            <div className="mb-4">
              {configMode === 'agile' ? (
                <select
                  value={selectedMontage5G}
                  onChange={(e) => handleMontage5GChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors hover:border-slate-600 cursor-pointer"
                >
                  {montages.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ant5g.height} x {m.ant5g.width} x {m.ant5g.thickness} mm ({m.ant5g.weight} kg)
                    </option>
                  ))}
                  <option value="custom">Sur-mesure (Configuration Manuelle)</option>
                </select>
              ) : (
                <select
                  value={selectedReference5G}
                  onChange={handleReference5GChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors hover:border-slate-600 cursor-pointer"
                >
                  {unique5GRefs.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.ant5g.model}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <div className="mb-2">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Modèle</label>
                <input
                  type="text"
                  value={ant5gConfig.model || ''}
                  onChange={(e) => setAnt5gConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                  disabled={configMode === 'reference'}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Hauteur (mm)</label>
                  <input
                    type="number"
                    value={ant5gConfig.height}
                    onChange={(e) => setAnt5gConfig(prev => ({ ...prev, height: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Largeur (mm)</label>
                  <input
                    type="number"
                    value={ant5gConfig.width}
                    onChange={(e) => setAnt5gConfig(prev => ({ ...prev, width: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Épaisseur (mm)</label>
                  <input
                    type="number"
                    value={ant5gConfig.thickness}
                    onChange={(e) => setAnt5gConfig(prev => ({ ...prev, thickness: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block">Poids (Kg)</label>
                  <input
                    type="number"
                    value={ant5gConfig.weight}
                    onChange={(e) => setAnt5gConfig(prev => ({ ...prev, weight: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white"
                    disabled={configMode === 'reference'}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
