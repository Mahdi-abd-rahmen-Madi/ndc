import { ArrowUpToLine, ArrowDownToLine, Check, FileStack, ShieldAlert } from 'lucide-react';
import { CatalogueConfig } from './types';

interface HeightInputsProps {
  siteType: string;
  foundationType: string;
  selectedBuildingHeight: number;
  setSelectedBuildingHeight: (val: number) => void;
  selectedHeight: number;
  setSelectedHeight: (val: number) => void;
  dalleThickness: number;
  setDalleThickness: (val: number) => void;
  plotHeight: number;
  setPlotHeight: (val: number) => void;
  config: CatalogueConfig | null;
}

export default function HeightInputs({
  siteType,
  foundationType,
  selectedBuildingHeight,
  setSelectedBuildingHeight,
  selectedHeight,
  setSelectedHeight,
  dalleThickness,
  setDalleThickness,
  plotHeight,
  setPlotHeight,
  config
}: HeightInputsProps) {
  const recommendedMastHeights = config?.recommended_mast_heights || [3, 4];

  return (
    <>
      {/* Configuration du Site - Read-only info */}
      <div className="grid grid-cols-2 gap-4">
        {/* Type de site */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-indigo-400" />
            Type de Site
          </label>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm text-slate-300">
            {siteType === 'nouveau' ? 'Site Neuf' : 'Site Existant'}
          </div>
        </div>

        {/* Type d'ancrage */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Type d'ancrage
          </label>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-3 text-sm text-slate-300">
            {foundationType === 'metallique' ? 'Plot Métallique' :
             foundationType === 'beton' ? 'Plot Béton' :
             foundationType === 'encastre' ? 'Encastré' : foundationType}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hauteur Bâtiment */}
        <div className="flex flex-col space-y-2 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:bg-indigo-500/10 transition-colors"></div>
          
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ArrowUpToLine className="w-3.5 h-3.5 text-indigo-400" />
              2. Hauteur du bâtiment (H)
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="150"
              step="0.5"
              value={selectedBuildingHeight}
              onChange={(e) => setSelectedBuildingHeight(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
            <span className="text-slate-400 text-sm font-medium">m</span>
          </div>
        </div>

        {/* Hauteur Mât */}
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
                onClick={() => setSelectedHeight(h)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                  selectedHeight === h
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
              value={selectedHeight}
              onChange={(e) => setSelectedHeight(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 transition-colors"
            />
            <span className="text-slate-400 text-sm font-medium">m</span>
          </div>
        </div>
      </div>

      {/* Dalle & Plot (Visible except for Encastré) */}
      {foundationType !== 'encastre' && (
        <div className={`grid ${siteType === 'existant' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl`}>
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileStack className="w-3.5 h-3.5 text-indigo-400" />
              Épaisseur de la dalle
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={dalleThickness}
                onChange={(e) => setDalleThickness(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
              <span className="text-slate-400 text-sm">m</span>
            </div>
          </div>
          {siteType === 'existant' && (
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Hauteur du plot
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={plotHeight}
                  onChange={(e) => setPlotHeight(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:ring-2 focus:ring-amber-500 transition-colors"
                />
                <span className="text-slate-400 text-sm">m</span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
