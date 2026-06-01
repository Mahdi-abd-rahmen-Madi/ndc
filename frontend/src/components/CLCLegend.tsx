// CLCLegend component

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { CLCLegendProps, TerrainType } from '../utils/types';
import { getCLCColor, getCLCDescription, searchCLCColors } from '../utils/clcColors';
import { getTerrainTypeInfo } from '../utils/terrainTypes';

export default function CLCLegend({ detectedCodes, config }: CLCLegendProps) {
  const [searchQuery, setSearchQuery] = useState('');
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
      return (
        <div
          key={code}
          className={`clc-code-item flex items-center gap-2 p-1 mb-1 rounded transition-colors cursor-pointer ${
            isCodeDetected(code) ? 'bg-yellow-100 border border-yellow-300 animate-highlight-pulse' : 'hover:bg-gray-100'
          }`}
        >
          <div
            className="clc-color-swatch w-4 h-4 rounded border border-gray-300 flex-shrink-0"
            style={{ backgroundColor: getCLCColor(String(code)) }}
          />
          <span className="clc-code-number font-semibold text-primary min-w-[35px] text-sm">
            {code}
          </span>
          <span className="clc-code-description flex-1 text-xs text-gray-600 leading-tight break-words">
            {getCLCDescription(String(code))}
          </span>
          {isCodeDetected(String(code)) && (
            <div className="clc-detected-indicator w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
      );
    });
  };

  return (
    <div className="clc-legend-panel w-[300px] flex-shrink-0 bg-white shadow-lg overflow-y-auto transition-transform z-[1001]">
      <div className="clc-legend-content p-6">
        <div className="clc-legend-header flex justify-between items-center mb-4 pb-2 border-b-2 border-primary">
          <h2 className="clc-legend-title text-xl font-semibold text-gray-800">CLC Legend</h2>
        </div>

        <div className="clc-search-box relative mb-4">
          <input
            type="text"
            placeholder="Search CLC codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm pl-9"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        </div>

        {!filteredCLCCodes && (
          <div className="clc-terrain-section mb-6">
            {terrainTypes.map(terrainType => {
              const terrainInfo = getTerrainTypeInfo(terrainType);
              const codes = getCodesForTerrain(terrainType);
              const isExpanded = expandedTerrainTypes.has(terrainType);

              return (
                <div key={terrainType} className="mb-4">
                  <div
                    className="clc-terrain-header flex items-center gap-2 p-2 bg-gray-50 rounded cursor-pointer transition-colors hover:bg-gray-100"
                    onClick={() => toggleTerrainType(terrainType)}
                  >
                    <span className="clc-terrain-icon text-xl">{terrainInfo.icon}</span>
                    <span className="clc-terrain-name font-semibold text-gray-800 flex-1">
                      {terrainInfo.name}
                    </span>
                    <span className="clc-terrain-count bg-primary text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                      {codes.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  {isExpanded && (
                    <div className="clc-codes-container pl-4 mt-2">
                      {renderCLCCodes(terrainType)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filteredCLCCodes && filteredCLCCodes.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Search Results</h3>
            {filteredCLCCodes.map((item) => (
              <div
                key={item.code}
                className={`clc-code-item flex items-center gap-2 p-1 mb-1 rounded transition-colors cursor-pointer ${
                  isCodeDetected(item.code) ? 'bg-yellow-100 border border-yellow-300 animate-highlight-pulse' : 'hover:bg-gray-100'
                }`}
              >
                <div
                  className="clc-color-swatch w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="clc-code-number font-semibold text-primary min-w-[35px] text-sm">
                  {item.code}
                </span>
                <span className="clc-code-description flex-1 text-xs text-gray-600 leading-tight break-words">
                  {item.description}
                </span>
                {isCodeDetected(item.code) && (
                  <div className="clc-detected-indicator w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>
        )}

        {filteredCLCCodes && filteredCLCCodes.length === 0 && (
          <div className="mt-4 text-center text-gray-500 text-sm">
            No CLC codes found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
