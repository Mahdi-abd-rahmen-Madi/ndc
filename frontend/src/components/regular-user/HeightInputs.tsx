import { ArrowUpToLine, Layers, FileStack, ShieldAlert, GitMerge } from 'lucide-react';
import { SimilarityMode } from './types';

interface HeightInputsProps {
  siteType?: string | null;
  foundationType?: string | null;
  selectedBuildingHeight: number;
  setSelectedBuildingHeight: (val: number) => void;
  nombreSecteurs: number;
  setNombreSecteurs: (val: number) => void;
  dalleThickness: number;
  setDalleThickness: (val: number) => void;
  plotHeight: number;
  setPlotHeight: (val: number) => void;
  etancheite?: string;
  setEtancheite?: (val: string) => void;
  similarityMode: SimilarityMode;
  setSimilarityMode: (mode: SimilarityMode) => void;
}

export default function HeightInputs({
  siteType,
  foundationType,
  selectedBuildingHeight,
  setSelectedBuildingHeight,
  nombreSecteurs,
  setNombreSecteurs,
  dalleThickness,
  setDalleThickness,
  plotHeight,
  setPlotHeight,
  etancheite = "",
  setEtancheite,
  similarityMode,
  setSimilarityMode
}: HeightInputsProps) {
  return (
    <>


      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Hauteur Bâtiment */}
        <div className="md:col-span-4 flex flex-col space-y-2 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
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

        {/* Nombre de Secteurs */}
        <div className="md:col-span-8 flex flex-col space-y-2 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:bg-indigo-500/10 transition-colors"></div>
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Nombre de Secteurs
          </label>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setNombreSecteurs(num)}
                className={`flex-1 py-2 rounded text-xs font-semibold transition-all border ${nombreSecteurs === num
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-md'
                    : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
              >
                {num} {num === 1 ? 'Secteur' : 'Secteurs'}
              </button>
            ))}
          </div>

          {nombreSecteurs > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <GitMerge className="w-3.5 h-3.5" />
                Configuration des secteurs
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  title="Copier le Secteur 1 sur les autres secteurs et les masquer"
                  onClick={() => setSimilarityMode('all_similar')}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold transition-all border text-center ${similarityMode === 'all_similar'
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 shadow-md'
                    : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  Tous identiques
                </button>

                <button
                  type="button"
                  title="Garder tous les secteurs indépendants et éditables"
                  onClick={() => setSimilarityMode('all_different')}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-semibold transition-all border text-center ${similarityMode === 'all_different'
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-md'
                    : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  Tous différents
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Étancheité */}
      <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl mt-4 relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
        <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full -z-10 group-hover:bg-indigo-500/10 transition-colors"></div>
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          Étancheité
        </label>
        <input
          type="text"
          value={etancheite}
          onChange={(e) => setEtancheite?.(e.target.value)}
          placeholder="Valeur (vide pour l'instant)"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 transition-colors"
        />
      </div>

      {/* Dalle & Plot (Visible except for Encastré) */}
      {foundationType !== 'encastre' && (
        <div className={`grid ${siteType === 'existant' ? 'grid-cols-2' : 'grid-cols-1'} gap-4 p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl mt-4`}>
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
