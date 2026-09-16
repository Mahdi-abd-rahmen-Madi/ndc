import React, { useEffect } from 'react';
import { Settings, Radio, SignalHigh } from 'lucide-react';
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
  selectedVendor4G?: string;
  selectedVendor5G?: string;
  setSelectedVendor4G?: (vendor: string) => void;
  setSelectedVendor5G?: (vendor: string) => void;
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
  setSelectedVendor5G
}: MontageSelectorProps) {
  const montages = config?.standard_montages || [];
  const realWorldReferences = (config?.real_world_references || []).filter(r => 
    !r.ant4g.model.toLowerCase().includes('agile') &&
    !r.ant5g.model.toLowerCase().includes('agile') &&
    !r.name.toLowerCase().includes('agile')
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

  const unique4GRefs = Array.from(unique4GMap.values());
  const unique5GRefs = Array.from(unique5GMap.values());

  useEffect(() => {
    if (configMode === 'reference' && unique4GRefs.length > 0 && unique5GRefs.length > 0) {
      const current4G = realWorldReferences.find(r => r.id === selectedReference4G);
      if (!current4G) {
        const fallback4G = unique4GRefs[0];
        setSelectedReference4G(fallback4G.id);
        setAnt4gConfig(fallback4G.ant4g);
        handleMontage4GChange(fallback4G.montageId);
      }
      
      const current5G = realWorldReferences.find(r => r.id === selectedReference5G);
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
      const ref4G = realWorldReferences.find(r => r.id === selectedReference4G) || unique4GRefs[0];
      const ref5G = realWorldReferences.find(r => r.id === selectedReference5G) || unique5GRefs[0];
      
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
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</span>
          <div className="flex justify-between items-center bg-slate-900/40 border border-slate-700/30 rounded py-1.5 px-2">
            <span className="text-xs text-white font-mono">{value}</span>
            <span className="text-[10px] text-slate-500">{unit}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label} ({unit})</label>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 px-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <label className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-indigo-400" />
          4. Configuration de l'Antenne
        </label>

        {/* Segmented Control */}
        <div className="relative flex p-1 bg-slate-950 rounded-lg mb-5 border border-slate-800/80">
          <div 
            className="absolute inset-y-1 bg-indigo-600 rounded-md transition-all duration-300 ease-out"
            style={{ 
              width: 'calc(50% - 4px)', 
              left: configMode === 'agile' ? '4px' : 'calc(50%)' 
            }}
          />
          <button
            type="button"
            onClick={() => handleConfigModeChange('agile')}
            className={`relative flex-1 py-2 rounded-md text-xs font-semibold transition-all z-10 ${
              configMode === 'agile' ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dimensions Agiles
          </button>
          <button
            type="button"
            onClick={() => handleConfigModeChange('reference')}
            className={`relative flex-1 py-2 rounded-md text-xs font-semibold transition-all z-10 ${
              configMode === 'reference' ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Références (Dimensions réelles)
          </button>
        </div>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Antenne 4G */}
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/20 hover:from-slate-800/80 hover:to-slate-800/40 transition-colors border border-slate-700/50 rounded-lg p-4">
            <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                <Radio className="w-3.5 h-3.5 text-blue-400" />
              </div>
              Antenne 4G
            </h4>
            
            {/* Dropdown 4G */}
            <div className="mb-5">
              {configMode === 'agile' ? (
                <select
                  value={selectedMontage4G}
                  onChange={(e) => handleMontage4GChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors hover:border-slate-600 cursor-pointer"
                >
                  {montages.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ant4g.height} x {m.ant4g.width} x {m.ant4g.thickness} mm ({m.ant4g.weight} kg)
                    </option>
                  ))}
                  <option value="custom">Sur-mesure (Configuration Manuelle)</option>
                </select>
              ) : (
                <div className="flex flex-col gap-3">
                  <select
                    value={selectedVendor4G}
                    onChange={(e) => setSelectedVendor4G?.(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors hover:border-slate-600 cursor-pointer"
                  >
                    <option value="Ericsson">Ericsson</option>
                    <option value="Huawei" disabled>Huawei (Indisponible)</option>
                  </select>
                  <select
                    value={selectedReference4G}
                    onChange={handleReference4GChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors hover:border-slate-600 cursor-pointer"
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

            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {renderDimension('Hauteur', ant4gConfig.height, 'mm', (val) => setAnt4gConfig(prev => ({ ...prev, height: val })))}
                {renderDimension('Largeur', ant4gConfig.width, 'mm', (val) => setAnt4gConfig(prev => ({ ...prev, width: val })))}
                {renderDimension('Épaisseur', ant4gConfig.thickness, 'mm', (val) => setAnt4gConfig(prev => ({ ...prev, thickness: val })))}
                {renderDimension('Poids', ant4gConfig.weight, 'Kg', (val) => setAnt4gConfig(prev => ({ ...prev, weight: val })))}
              </div>
            </div>
          </div>

          {/* Antenne 5G */}
          <div className="bg-gradient-to-br from-slate-800/60 to-slate-800/20 hover:from-slate-800/80 hover:to-slate-800/40 transition-colors border border-slate-700/50 rounded-lg p-4">
            <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center">
                <SignalHigh className="w-3.5 h-3.5 text-purple-400" />
              </div>
              Antenne 5G
            </h4>
            
            {/* Dropdown 5G */}
            <div className="mb-5">
              {configMode === 'agile' ? (
                <select
                  value={selectedMontage5G}
                  onChange={(e) => handleMontage5GChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors hover:border-slate-600 cursor-pointer"
                >
                  {montages.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ant5g.height} x {m.ant5g.width} x {m.ant5g.thickness} mm ({m.ant5g.weight} kg)
                    </option>
                  ))}
                  <option value="custom">Sur-mesure (Configuration Manuelle)</option>
                </select>
              ) : (
                <div className="flex flex-col gap-3">
                  <select
                    value={selectedVendor5G}
                    onChange={(e) => setSelectedVendor5G?.(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors hover:border-slate-600 cursor-pointer"
                  >
                    <option value="Ericsson">Ericsson</option>
                    <option value="Huawei" disabled>Huawei (Indisponible)</option>
                  </select>
                  <select
                    value={selectedReference5G}
                    onChange={handleReference5GChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors hover:border-slate-600 cursor-pointer"
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

            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
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
