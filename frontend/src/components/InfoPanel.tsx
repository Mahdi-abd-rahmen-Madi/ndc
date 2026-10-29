// InfoPanel component

import { useState } from 'react';
import { Loader2, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import type { InfoPanelProps } from '../utils/types';
import { getTerrainTypeInfo, getTerrainTypeGradient } from '../utils/terrainTypes';
import { formatCoordinates, formatSpatialExtent } from '../utils/formatters';
import { useAppStore } from '../stores/useAppStore';

export default function InfoPanel({ classificationResult, loading, error }: Omit<InfoPanelProps, 'currentAnalysisRadius'>) {
  const currentAnalysisRadius = useAppStore(state => state.currentAnalysisRadius);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="w-[340px] flex-shrink-0 bg-white/95 backdrop-blur-md border-l border-slate-200/80 shadow-sm flex flex-col justify-center items-center p-8 z-[1001]">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
        <p className="text-xs font-semibold text-slate-700">Analyse du terrain en cours...</p>
        <span className="text-[11px] text-slate-400 mt-1">Interrogation des couches CLC</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[340px] flex-shrink-0 bg-white/95 backdrop-blur-md border-l border-slate-200/80 shadow-sm p-5 z-[1001]">
        <div className="bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-200">
          <div className="flex items-center gap-2 font-semibold text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Erreur d'analyse</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-rose-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!classificationResult) {
    if (isCollapsed) {
      return (
        <div className="relative z-[1001] flex items-center">
          <button
            onClick={() => setIsCollapsed(false)}
            className="absolute right-3 top-28 bg-white/95 backdrop-blur-md shadow-md border border-slate-200/80 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer group"
            title="Ouvrir le panneau d'analyse"
          >
            <span>Résultats</span>
            <ChevronRight className="w-4 h-4 rotate-180 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          </button>
        </div>
      );
    }

    return (
      <div className="w-[320px] flex-shrink-0 bg-white/95 backdrop-blur-md border-l border-slate-200/80 shadow-sm flex flex-col h-full z-[1001] transition-all">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Analyse du Terrain</h2>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xs font-medium cursor-pointer"
            title="Réduire le panneau"
          >
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3 text-indigo-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">Prêt pour l'analyse</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-[240px]">
            Cliquez à un endroit sur la carte (zoom &ge; 13) pour déterminer automatiquement la rugosité et la catégorie de terrain.
          </p>
        </div>
      </div>
    );
  }

  const terrainInfo = getTerrainTypeInfo(classificationResult.terrain_type);
  const formattedExtent = formatSpatialExtent(classificationResult.spatial_extent);

  if (isCollapsed) {
    return (
      <div className="relative z-[1001] flex items-center">
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute right-3 top-28 bg-white/95 backdrop-blur-md shadow-md border border-slate-200/80 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer group"
          title="Ouvrir le panneau d'analyse"
        >
          <span>{terrainInfo.name}</span>
          <ChevronRight className="w-4 h-4 rotate-180 text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[340px] flex-shrink-0 bg-white/95 backdrop-blur-md border-l border-slate-200/80 shadow-sm flex flex-col h-full z-[1001] transition-all">
      <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Résultat de Classification</h2>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xs font-medium cursor-pointer"
          title="Réduire le panneau"
        >
          <ChevronDown className="w-4 h-4 -rotate-90" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Terrain Header Card */}
        <div
          className="p-4 rounded-xl text-center text-white shadow-md relative overflow-hidden"
          style={{ background: getTerrainTypeGradient(classificationResult.terrain_type) }}
        >
          <div className="text-xs uppercase tracking-wider font-semibold opacity-85">Type de terrain détecté</div>
          <div className="text-2xl font-black mt-1 drop-shadow-sm">{terrainInfo.name}</div>
        </div>

        {/* Coordinates */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Coordonnées GPS</div>
          <div className="font-mono text-xs font-semibold text-slate-800">
            {formatCoordinates(classificationResult.coordinates)}
          </div>
        </div>

        {/* Spatial Extent */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Étendue spatiale
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl">
              <span className="text-[11px] text-slate-500 block">Agriculture</span>
              <span className="font-bold text-slate-800 text-sm">{formattedExtent.agriculture}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl">
              <span className="text-[11px] text-slate-500 block">Agri. complexe</span>
              <span className="font-bold text-slate-800 text-sm">{formattedExtent.complex_agriculture}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl">
              <span className="text-[11px] text-slate-500 block">Forêt</span>
              <span className="font-bold text-slate-800 text-sm">{formattedExtent.forest}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl">
              <span className="text-[11px] text-slate-500 block">Urbain</span>
              <span className="font-bold text-slate-800 text-sm">{formattedExtent.urban}</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl col-span-2">
              <span className="text-[11px] text-slate-500 block">Côtier</span>
              <span className="font-bold text-slate-800 text-sm">{formattedExtent.coastal}</span>
            </div>
          </div>
        </div>

        {/* Region */}
        {classificationResult.region && (
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
            <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1.5">Région Administrative</div>
            <div className="text-xs text-slate-700 space-y-0.5">
              <div><span className="font-medium text-slate-500">Nom :</span> <span className="font-semibold text-slate-900">{classificationResult.region.name}</span></div>
              <div><span className="font-medium text-slate-500">Code :</span> <span className="font-mono text-slate-800">{classificationResult.region.number}</span></div>
            </div>
          </div>
        )}

        {/* Params */}
        <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 flex items-center justify-between">
          <span className="text-slate-500">Rayon d'analyse :</span>
          <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200/80 shadow-2xs">
            {currentAnalysisRadius} km
          </span>
        </div>
      </div>
    </div>
  );
}
