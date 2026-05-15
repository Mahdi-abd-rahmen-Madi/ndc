// DetailsTab component

import type { TerrainClassificationResponse } from '../utils/types';
import { getTerrainTypeInfo } from '../utils/terrainTypes';
import { formatCoordinates, formatPercentage } from '../utils/formatters';

interface DetailsTabProps {
  classificationResult: TerrainClassificationResponse | null;
}

export default function DetailsTab({ classificationResult }: DetailsTabProps) {
  if (!classificationResult) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p>No classification result available</p>
        <p className="text-sm mt-2">Click on the map to analyze terrain</p>
      </div>
    );
  }

  const terrainInfo = getTerrainTypeInfo(classificationResult.terrain_type);

  return (
    <div className="config-section block">
      <div className="config-header mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Classification Details</h2>
      </div>

      <div className="config-visual bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 mb-6 border border-gray-200">
        <div className="terrain-visual-grid grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 mb-4">
          <div className="terrain-visual-item bg-white rounded-lg p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="terrain-visual-icon text-4xl mb-2">{terrainInfo.icon}</div>
            <div className="terrain-visual-label font-bold mb-1">{terrainInfo.name}</div>
            <div className="terrain-visual-count text-sm text-gray-600">Terrain Type</div>
          </div>
        </div>
      </div>

      <div className="config-group mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b-2 border-primary pb-2">
          Location Information
        </h3>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Terrain Type</span>
          <span className="config-value font-bold text-gray-800">{terrainInfo.name}</span>
        </div>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Base Terrain Type</span>
          <span className="config-value font-bold text-gray-800">
            {getTerrainTypeInfo(classificationResult.base_terrain_type).name}
          </span>
        </div>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Coordinates</span>
          <span className="config-value font-bold text-gray-800 font-mono text-sm">
            {formatCoordinates(classificationResult.coordinates)}
          </span>
        </div>
      </div>

      <div className="config-group mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b-2 border-primary pb-2">
          Detected CLC Codes
        </h3>
        <div className="terrain-code-list max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3">
          {classificationResult.detected_clc_codes.length > 0 ? (
            classificationResult.detected_clc_codes.map(code => (
              <div key={code} className="code-item flex justify-between p-1 border-b border-gray-200 last:border-0">
                <span className="code-number font-bold text-primary">{code}</span>
                <span className="code-description flex-1 ml-4 text-sm text-gray-600">
                  Code {code}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">No CLC codes detected</p>
          )}
        </div>
      </div>

      <div className="config-group mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b-2 border-primary pb-2">
          Applied Rules
        </h3>
        {classificationResult.applicable_rules.length > 0 ? (
          classificationResult.applicable_rules.map(rule => (
            <div key={rule.name} className="rule-visual flex items-center gap-4 p-3 mb-2 bg-white rounded-lg border-l-4 border-primary shadow-sm">
              <div className="rule-priority bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {rule.priority}
              </div>
              <div className="rule-info flex-1">
                <div className="rule-name font-bold mb-1">{rule.name}</div>
                <div className="rule-description text-sm text-gray-600">Priority {rule.priority}</div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 text-center py-2">No rules applied</p>
        )}
      </div>

      <div className="config-group mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b-2 border-primary pb-2">
          Spatial Composition
        </h3>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Agriculture</span>
          <span className="config-value font-bold text-gray-800">
            {formatPercentage(classificationResult.spatial_extent.agriculture)}
          </span>
        </div>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Complex Agriculture</span>
          <span className="config-value font-bold text-gray-800">
            {formatPercentage(classificationResult.spatial_extent.complex_agriculture)}
          </span>
        </div>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Forest</span>
          <span className="config-value font-bold text-gray-800">
            {formatPercentage(classificationResult.spatial_extent.forest)}
          </span>
        </div>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Urban</span>
          <span className="config-value font-bold text-gray-800">
            {formatPercentage(classificationResult.spatial_extent.urban)}
          </span>
        </div>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Coastal</span>
          <span className="config-value font-bold text-gray-800">
            {formatPercentage(classificationResult.spatial_extent.coastal)}
          </span>
        </div>
      </div>
    </div>
  );
}
