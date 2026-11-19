import { useState } from 'react';
import { AlertCircle, ZoomIn, X, Check } from 'lucide-react';

interface MontageSelectionModalProps {
  show: boolean;
  onClose: () => void;
  selectedSiteType: 'nouveau' | 'existant' | null;
  selectedFoundationType?: 'metallique' | 'beton' | 'encastre' | 'dallettes' | null;
  onSiteTypeSelect: (type: 'nouveau' | 'existant') => void;
  onFoundationTypeSelect?: (type: 'metallique' | 'beton' | 'encastre' | 'dallettes') => void;
  onCasSelect: (cas: string) => void;
}

interface CaseStructure {
  id: string;
  name: string;
  code: string;
  image: string;
  title: string;
  subtitle: string;
  status: 'available' | 'development';
  statusLabel: string;
}

const CASES_DATA: CaseStructure[] = [
  {
    id: 'A1',
    name: 'Cas 1',
    code: 'C1',
    image: '/cas1.png',
    title: 'Mât + Plot',
    subtitle: 'Ant. 4G intégrée + 5G sur bras',
    status: 'available',
    statusLabel: 'En exploitation',
  },
  {
    id: 'A2',
    name: 'Cas 2',
    code: 'C2',
    image: '/cas2.png',
    title: 'Mât + Plot',
    subtitle: 'Ant. 4G/5G – bras séparés',
    status: 'development',
    statusLabel: 'En développement',
  },
  {
    id: 'A3',
    name: 'Cas 3',
    code: 'C3',
    image: '/cas3.png',
    title: 'Mât + Plot',
    subtitle: 'Ant. 4G/5G – mât commun',
    status: 'development',
    statusLabel: 'En développement',
  },
  {
    id: 'A4',
    name: 'Cas 4',
    code: 'C4',
    image: '/cas4.png',
    title: 'Mât + Plot',
    subtitle: 'Antenne multitechno',
    status: 'development',
    statusLabel: 'En développement',
  },
];

export default function MontageSelectionModal({
  show,
  onClose,
  selectedSiteType,
  onSiteTypeSelect,
  onCasSelect,
}: MontageSelectionModalProps) {
  const [zoomedCase, setZoomedCase] = useState<CaseStructure | null>(null);

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
                Choisissez votre type de site pour afficher les cas de structure éligibles.
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
          <div className="flex items-center justify-center gap-3 pt-1 w-full">
            {/* Site Type Prompt */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80 max-w-md w-full">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0 px-1">
                Site :
              </span>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => onSiteTypeSelect('nouveau')}
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
          </div>
        </div>

        {/* Optional Warning Banner */}
        {selectedSiteType && selectedSiteType !== 'nouveau' && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p>
              La configuration sélectionnée n'est pas encore disponible. Veuillez sélectionner <strong className="underline">Site Neuf</strong> pour activer le Cas 1.
            </p>
          </div>
        )}

        {/* 4 Cases Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-3 flex-1 overflow-y-auto pr-0.5">
          {CASES_DATA.map((item) => {
            const isCas1Available = item.id === 'A1' && selectedSiteType === 'nouveau';

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isCas1Available) {
                    onCasSelect('A1');
                    onClose();
                  }
                }}
                className={`relative flex flex-col rounded-2xl transition-all duration-200 overflow-hidden text-left ${
                  isCas1Available
                    ? 'border-2 border-violet-500 bg-white shadow-md hover:shadow-xl hover:border-violet-600 cursor-pointer ring-2 ring-violet-500/10 group'
                    : 'border border-slate-200/90 bg-white/70 cursor-default opacity-85'
                }`}
              >
                {/* Visual Image Container */}
                <div
                  className={`relative w-full h-56 sm:h-64 flex items-center justify-center p-3 overflow-hidden ${
                    isCas1Available
                      ? 'bg-gradient-to-b from-slate-50/80 via-white to-slate-50/50'
                      : 'bg-slate-50/60'
                  }`}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className={`h-full w-auto max-h-[235px] object-contain transition-transform duration-300 drop-shadow-sm ${
                      isCas1Available
                        ? 'group-hover:scale-105'
                        : 'grayscale-[20%] opacity-90'
                    }`}
                  />

                  {/* Top-left Code Badge */}
                  <div
                    className={`absolute top-2.5 left-2.5 text-xs font-black px-2 py-0.5 rounded-md shadow-2xs ${
                      isCas1Available
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-500 text-white'
                    }`}
                  >
                    {item.code}
                  </div>

                  {/* Top-right Status & Zoom Action */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {/* Zoom button */}
                    <button
                      type="button"
                      title="Agrandir et inspecter"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedCase(item);
                      }}
                      className="p-1 rounded-md bg-white/95 hover:bg-white text-slate-500 hover:text-violet-700 shadow-2xs border border-slate-200/80 transition-colors cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>

                    {isCas1Available ? (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                        En exploitation
                      </span>
                    ) : (
                      <span className="bg-slate-200/90 text-slate-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
                        {item.id === 'A1' ? 'Site Neuf requis' : 'Indisponible'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Info Section */}
                <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between bg-white">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-base font-bold ${
                          isCas1Available ? 'text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {item.name}
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {item.title}
                      </span>
                    </div>

                    <p
                      className={`text-xs font-semibold leading-snug mt-1 ${
                        isCas1Available ? 'text-violet-950' : 'text-slate-600'
                      }`}
                    >
                      {item.subtitle}
                    </p>
                  </div>

                  {/* Action Footer */}
                  <div className="pt-2.5 border-t border-slate-100 mt-1">
                    {isCas1Available ? (
                      <div className="w-full py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors group-hover:bg-violet-700">
                        <span>Sélectionner ce cas</span>
                        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium bg-slate-50 border border-slate-100 py-1.5 px-2.5 rounded-lg block w-full text-center truncate">
                        {item.id === 'A1'
                          ? 'Sélectionner "Site Neuf" ci-dessus'
                          : 'En cours de développement'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* High-Resolution Zoom Preview Modal */}
        {zoomedCase && (
          <div
            className="fixed inset-0 z-[2100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setZoomedCase(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-violet-600 text-white text-xs font-black px-2 py-0.5 rounded">
                      {zoomedCase.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      {zoomedCase.name} — {zoomedCase.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {zoomedCase.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomedCase(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* High-Res View Area */}
              <div className="p-6 bg-gradient-to-b from-slate-100/50 to-slate-50 flex items-center justify-center min-h-[380px]">
                <img
                  src={zoomedCase.image}
                  alt={zoomedCase.name}
                  className="max-h-[360px] w-auto object-contain drop-shadow-md"
                />
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                {zoomedCase.id === 'A1' && selectedSiteType === 'nouveau' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onCasSelect('A1');
                      setZoomedCase(null);
                      onClose();
                    }}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Choisir ce Cas (A1)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setZoomedCase(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Fermer l'aperçu
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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
