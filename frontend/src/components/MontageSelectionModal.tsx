import { AlertCircle } from 'lucide-react';

interface MontageSelectionModalProps {
  show: boolean;
  onClose: () => void;
  selectedSiteType: 'nouveau' | 'existant' | null;
  selectedFoundationType: 'metallique' | 'beton' | 'encastre' | null;
  onSiteTypeSelect: (type: 'nouveau' | 'existant') => void;
  onFoundationTypeSelect: (type: 'metallique' | 'beton' | 'encastre') => void;
  onCasSelect: (cas: string) => void;
}

export default function MontageSelectionModal({
  show,
  onClose,
  selectedSiteType,
  selectedFoundationType,
  onSiteTypeSelect,
  onFoundationTypeSelect,
  onCasSelect,
}: MontageSelectionModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-7 max-w-6xl w-full border border-gray-100 transform transition-all duration-300 scale-100 max-h-[96vh] flex flex-col overflow-hidden">
        {/* Header & Controls */}
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Sélectionner le type de Structure</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Choisissez votre type de site et d'ancrage pour afficher les cas de structure éligibles.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 w-8 h-8 rounded-lg flex items-center justify-center text-xl font-semibold hover:bg-slate-100 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Inline Selection Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Site Type Prompt */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0 px-1">
                1. Site :
              </span>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    onSiteTypeSelect('nouveau');
                    if (selectedFoundationType !== 'metallique' && selectedFoundationType !== null) {
                      onFoundationTypeSelect('metallique');
                    }
                  }}
                  className={`py-1.5 px-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                    selectedSiteType === 'nouveau'
                      ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold">Site Neuf</span>
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded">Disponible</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSiteTypeSelect('existant')}
                  className={`py-1.5 px-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                    selectedSiteType === 'existant'
                      ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold">Site Existant</span>
                  <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.2 rounded">Indispo.</span>
                </button>
              </div>
            </div>

            {/* Foundation Type Prompt */}
            <div className={`flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80 transition-opacity ${
              !selectedSiteType ? 'opacity-40 pointer-events-none' : ''
            }`}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0 px-1">
                2. Ancrage :
              </span>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <button
                  type="button"
                  disabled={selectedSiteType !== 'nouveau'}
                  onClick={() => onFoundationTypeSelect('metallique')}
                  className={`py-1.5 px-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedFoundationType === 'metallique'
                      ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold">Plot métallique</span>
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded">Disponible</span>
                </button>

                <button
                  type="button"
                  disabled={selectedSiteType !== 'nouveau'}
                  onClick={() => onFoundationTypeSelect('beton')}
                  className={`py-1.5 px-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedFoundationType === 'beton'
                      ? 'border-violet-600 bg-violet-50/70 text-violet-950 font-semibold shadow-2xs ring-1 ring-violet-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold">Plot Béton</span>
                  <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.2 rounded">Indispo.</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Optional Warning Banner */}
        {selectedSiteType && selectedFoundationType && (selectedSiteType !== 'nouveau' || selectedFoundationType !== 'metallique') && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p>
              La configuration sélectionnée n'est pas encore disponible. Veuillez sélectionner <strong className="underline">Site Neuf</strong> et <strong className="underline">Plot métallique</strong> pour activer le Cas 1.
            </p>
          </div>
        )}

        {/* 4 Cases Grid: Displayed horizontally side-by-side (4 columns on lg, 2 on sm) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4 flex-1">
          {/* Cas 1 - Active */}
          {selectedSiteType === 'nouveau' && selectedFoundationType === 'metallique' ? (
            <button
              onClick={() => {
                onCasSelect('A1');
                onClose();
              }}
              className="flex flex-col rounded-xl border-2 border-violet-500 bg-white hover:bg-violet-50/20 hover:shadow-md transition-all text-left group cursor-pointer overflow-hidden ring-2 ring-violet-500/10"
            >
              <div className="relative w-full bg-gradient-to-b from-slate-50 to-slate-100/70 flex items-center justify-center p-2.5 h-36">
                <img
                  src="/cas1.png"
                  alt="Structure Cas 1"
                  className="max-h-[125px] w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
                />
                <div className="absolute top-2 left-2 bg-violet-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded shadow-2xs">
                  C1
                </div>
                <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  Disponible
                </div>
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1 justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Cas 1</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug mt-0.5">
                    Mât + Plot | Ant. 4G intégrée + 5G sur bras
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">En exploitation</span>
                  <span className="text-violet-600 text-xs font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Sélectionner →
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-60">
              <div className="relative w-full bg-slate-100/60 flex items-center justify-center p-2.5 h-36">
                <img
                  src="/cas1.png"
                  alt="Structure Cas 1"
                  className="max-h-[125px] w-auto object-contain grayscale opacity-50 drop-shadow-2xs"
                />
                <div className="absolute top-2 left-2 bg-slate-400 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-2xs">
                  C1
                </div>
                <div className="absolute top-2 right-2 bg-slate-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  Indisponible
                </div>
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1 justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-500">Cas 1</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug mt-0.5">
                    Mât + Plot | Ant. 4G intégrée + 5G sur bras
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-200/70 px-2 py-0.5 rounded block text-center truncate">
                    Sélectionner Site Neuf & Plot
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Cas 2 - Inactive */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-60">
            <div className="relative w-full bg-slate-100/60 flex items-center justify-center p-2.5 h-36">
              <img
                src="/cas2.png"
                alt="Structure Cas 2"
                className="max-h-[125px] w-auto object-contain grayscale opacity-50 drop-shadow-2xs"
              />
              <div className="absolute top-2 left-2 bg-slate-400 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-2xs">
                C2
              </div>
              <div className="absolute top-2 right-2 bg-slate-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                Indisponible
              </div>
            </div>
            <div className="p-3 flex flex-col gap-1 flex-1 justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-500">Cas 2</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug mt-0.5">
                  Mât + Plot | Ant. 4G/5G – bras séparés
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 mt-2">
                <span className="text-[10px] text-slate-400 font-medium bg-slate-200/70 px-2 py-0.5 rounded block text-center truncate">
                  En développement
                </span>
              </div>
            </div>
          </div>

          {/* Cas 3 - Inactive */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-60">
            <div className="relative w-full bg-slate-100/60 flex items-center justify-center p-2.5 h-36">
              <img
                src="/cas3.png"
                alt="Structure Cas 3"
                className="max-h-[125px] w-auto object-contain grayscale opacity-50 drop-shadow-2xs"
              />
              <div className="absolute top-2 left-2 bg-slate-400 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-2xs">
                C3
              </div>
              <div className="absolute top-2 right-2 bg-slate-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                Indisponible
              </div>
            </div>
            <div className="p-3 flex flex-col gap-1 flex-1 justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-500">Cas 3</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug mt-0.5">
                  Mât + Plot | Ant. 4G/5G – mât commun
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 mt-2">
                <span className="text-[10px] text-slate-400 font-medium bg-slate-200/70 px-2 py-0.5 rounded block text-center truncate">
                  En développement
                </span>
              </div>
            </div>
          </div>

          {/* Cas 4 - Inactive */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 text-left select-none cursor-not-allowed overflow-hidden opacity-60">
            <div className="relative w-full bg-slate-100/60 flex items-center justify-center p-2.5 h-36">
              <img
                src="/cas4.png"
                alt="Structure Cas 4"
                className="max-h-[125px] w-auto object-contain grayscale opacity-50 drop-shadow-2xs"
              />
              <div className="absolute top-2 left-2 bg-slate-400 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-2xs">
                C4
              </div>
              <div className="absolute top-2 right-2 bg-slate-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                Indisponible
              </div>
            </div>
            <div className="p-3 flex flex-col gap-1 flex-1 justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-500">Cas 4</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug mt-0.5">
                  Mât + Plot | Antenne multitechno
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 mt-2">
                <span className="text-[10px] text-slate-400 font-medium bg-slate-200/70 px-2 py-0.5 rounded block text-center truncate">
                  En développement
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
