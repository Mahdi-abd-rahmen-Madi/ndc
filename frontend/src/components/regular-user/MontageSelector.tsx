import React from 'react';
import { Settings, Info } from 'lucide-react';
import { CatalogueConfig, AntennaConfigState } from './types';


interface MontageSelectorProps {
  selectedMontage: string;
  handleMontageChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  ant4gConfig: AntennaConfigState;
  setAnt4gConfig: (val: AntennaConfigState | ((prev: AntennaConfigState) => AntennaConfigState)) => void;
  ant5gConfig: AntennaConfigState;
  setAnt5gConfig: (val: AntennaConfigState | ((prev: AntennaConfigState) => AntennaConfigState)) => void;
  config: CatalogueConfig | null;
  configMode: 'agile' | 'reference';
  setConfigMode: (mode: 'agile' | 'reference') => void;
  selectedReference: string;
  setSelectedReference: (ref: string) => void;
}

export default function MontageSelector({
  selectedMontage,
  handleMontageChange,
  ant4gConfig,
  setAnt4gConfig,
  ant5gConfig,
  setAnt5gConfig,
  config,
  configMode,
  setConfigMode,
  selectedReference,
  setSelectedReference
}: MontageSelectorProps) {
  const montages = config?.standard_montages || [];
  const realWorldReferences = config?.real_world_references || [];

  const handleConfigModeChange = (mode: 'agile' | 'reference') => {
    setConfigMode(mode);
    if (mode === 'reference') {
      const ref = realWorldReferences.find(r => r.id === selectedReference) || realWorldReferences[0];
      if (ref) {
        setSelectedReference(ref.id);
        setAnt4gConfig(ref.ant4g);
        setAnt5gConfig(ref.ant5g);
        handleMontageChange({ target: { value: ref.montageId } } as any);
      }
    } else {
      const spec = config?.standard_montages[0];
      if (spec) {
        handleMontageChange({ target: { value: spec.id } } as any);
      }
    }
  };

  const handleReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedReference(val);
    const ref = realWorldReferences.find(r => r.id === val);
    if (ref) {
      setAnt4gConfig(ref.ant4g);
      setAnt5gConfig(ref.ant5g);
      handleMontageChange({ target: { value: ref.montageId } } as any);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Sélecteur de Montage Principal */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <label className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-indigo-400" />
          4. Configuration de l'Antenne
        </label>

        {/* Toggle Mode: Dimensions Agile or Références */}
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

        {configMode === 'agile' ? (
          /* Sélecteur de Cas (Montages) */
          <select
            value={selectedMontage}
            onChange={handleMontageChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6 transition-colors hover:border-slate-600 cursor-pointer"
          >
            {montages.map((m, idx) => (
              <option key={m.id} value={m.id}>
                Cas {idx + 1} - {m.name} ({m.abbreviation})
              </option>
            ))}
            <option value="custom">Sur-mesure (Configuration Manuelle)</option>
          </select>
        ) : (
          /* Sélecteur de Références */
          <select
            value={selectedReference}
            onChange={handleReferenceChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6 transition-colors hover:border-slate-600 cursor-pointer"
          >
            {realWorldReferences.map((ref) => (
              <option key={ref.id} value={ref.id}>
                {ref.name}
              </option>
            ))}
          </select>
        )}

        {selectedMontage === 'custom' && configMode === 'agile' && (
          <div className="mb-6 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-start gap-2 animate-fadeIn">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200">
              Configuration sur-mesure activée. Un nouveau calcul structurel sera nécessaire car cette configuration ne correspond à aucun montage précalculé.
            </p>
          </div>
        )}

        {/* Configuration Détaillée (4G / 5G) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Antenne 4G */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Antenne 4G
            </h4>
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
