// CLCLegend component

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { CLCLegendProps, TerrainType } from '../utils/types';
import { getCLCColor, getCLCDescription, searchCLCColors } from '../utils/clcColors';
import { getTerrainTypeInfo } from '../utils/terrainTypes';

export default function CLCLegend({ detectedCodes, config }: CLCLegendProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedTerrainTypes, setExpandedTerrainTypes] = useState<Set<TerrainType>>(new Set(['0', 'II', 'IIIa', 'IIIb', 'IV']));

  const terrainTypes: TerrainType[] = ['0', 'II', 'IIIa', 'IIIb', 'IV'];

  const toggleTerrainType = (terrainType: TerrainType) => {
    setExpandedTerrainTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(terrainType)) {
        newSet.delete(terrainType);
      } else {
        newSet.add(terrainType);
      }
      return newSet;
    });
  };

  const filteredCLCCodes = useMemo(() => {
    if (!searchQuery) return null;
    return searchCLCColors(searchQuery);
  }, [searchQuery]);

  const getCodesForTerrain = (terrainType: TerrainType): string[] => {
    if (!config) return [];
    const mapping = config.clc_code_mappings[`terrain_${terrainType}` as keyof typeof config.clc_code_mappings];
    return mapping?.codes || [];
  };

  const isCodeDetected = (code: string): boolean => {
    return detectedCodes.includes(code);
  };

  const renderCLCCodes = (terrainType: TerrainType) => {
    const codes = getCodesForTerrain(terrainType);
    const codesToShow = filteredCLCCodes || codes;

    return codesToShow.map((item) => {
      const code = typeof item === 'string' ? item : item.code;
      const detected = isCodeDetected(String(code));
      return (
        <div
          key={code}
          className={`clc-code-item flex items-center gap-2 p-1.5 mb-1 rounded-lg transition-all cursor-pointer ${
            detected ? 'bg-amber-50 border border-amber-300 shadow-xs' : 'hover:bg-slate-50'
          }`}
        >
          <div
            className="clc-color-swatch w-3.5 h-3.5 rounded-sm border border-slate-300/80 shadow-2xs flex-shrink-0"
            style={{ backgroundColor: getCLCColor(String(code)) }}
          />
          <span className="clc-code-number font-semibold text-indigo-700 min-w-[32px] text-xs">
            {code}
          </span>
          <span className="clc-code-description flex-1 text-[11px] text-slate-600 leading-snug break-words">
            {getCLCDescription(String(code))}
          </span>
          {detected && (
            <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 shadow-xs ring-2 ring-emerald-200 animate-pulse" />
          )}
        </div>
      );
    });
  };

  if (isCollapsed) {
    return (
      <div className="relative z-[1001] flex items-center">
        <button
          onClick={() => setIsCollapsed(false)}
          className="absolute left-3 top-3 bg-white/95 backdrop-blur-md shadow-md border border-slate-200/80 p-2.5 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer group"
          title="Ouvrir la légende CLC"
        >
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          <span>Légende CLC</span>
        </button>
      </div>
    );
  }

  return (
    <div className="clc-legend-panel w-[320px] flex-shrink-0 bg-white/95 backdrop-blur-md border-r border-slate-200/80 shadow-sm flex flex-col h-full z-[1001] transition-all duration-200">
      <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Légende CLC</h2>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200/60">
            Corine Land Cover
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xs font-medium cursor-pointer"
          title="Réduire le panneau"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
      </div>

      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <input
            type="text"
            placeholder="Filtrer un code (ex: 511, eau)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 pl-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {!filteredCLCCodes && (
          <div className="space-y-2">
            {terrainTypes.map(terrainType => {
              const terrainInfo = getTerrainTypeInfo(terrainType);
              const codes = getCodesForTerrain(terrainType);
              const isExpanded = expandedTerrainTypes.has(terrainType);

              return (
                <div key={terrainType} className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div
                    className="flex items-center gap-2 p-2.5 bg-slate-50/70 cursor-pointer transition-colors hover:bg-slate-100/70"
                    onClick={() => toggleTerrainType(terrainType)}
                  >
                    <span className="text-base">{terrainInfo.icon}</span>
                    <span className="font-semibold text-xs text-slate-800 flex-1">
                      {terrainInfo.name}
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                      {codes.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  {isExpanded && (
                    <div className="p-2 pt-1 border-t border-slate-100 space-y-0.5 bg-white">
                      {renderCLCCodes(terrainType)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filteredCLCCodes && filteredCLCCodes.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {filteredCLCCodes.length} résultat{filteredCLCCodes.length > 1 ? 's' : ''}
            </div>
            {filteredCLCCodes.map((item) => (
              <div
                key={item.code}
                className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isCodeDetected(item.code) ? 'bg-amber-50 border border-amber-300' : 'hover:bg-slate-50'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-sm border border-slate-300 flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-semibold text-indigo-700 min-w-[32px] text-xs">
                  {item.code}
                </span>
                <span className="flex-1 text-[11px] text-slate-600 leading-snug break-words">
                  {item.description}
                </span>
                {isCodeDetected(item.code) && (
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>
        )}

        {filteredCLCCodes && filteredCLCCodes.length === 0 && (
          <div className="py-8 text-center text-slate-400 text-xs">
            Aucun code CLC trouvé pour "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
