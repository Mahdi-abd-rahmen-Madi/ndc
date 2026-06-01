// InfoPanel component

import { Loader2, AlertCircle } from 'lucide-react';
import type { InfoPanelProps } from '../utils/types';
import { getTerrainTypeInfo, getTerrainTypeGradient } from '../utils/terrainTypes';
import { formatCoordinates, formatSpatialExtent } from '../utils/formatters';

export default function InfoPanel({ classificationResult, loading, error, currentAnalysisRadius }: InfoPanelProps) {
  if (loading) {
    return (
      <div className="info-panel w-[350px] flex-shrink-0 bg-white shadow-lg overflow-y-auto transition-transform">
        <div className="info-content p-8">
          <div className="loading flex flex-col items-center justify-center p-8">
            <Loader2 className="spinner w-10 h-10 animate-spin mb-4 text-primary" />
            <p className="text-gray-600">Analyzing terrain...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="info-panel w-[350px] flex-shrink-0 bg-white shadow-lg overflow-y-auto transition-transform">
        <div className="info-content p-8">
          <div className="error bg-red-50 text-red-800 p-4 rounded mb-4 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Error</span>
            </div>
            <p className="mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!classificationResult) {
    return (
      <div className="info-panel w-[350px] flex-shrink-0 bg-white shadow-lg overflow-y-auto transition-transform">
        <div className="info-content p-8">
          <div className="welcome text-center text-gray-600 p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Welcome</h2>
            <p className="text-sm">
              Click anywhere on the map to analyze the terrain classification at that location.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const terrainInfo = getTerrainTypeInfo(classificationResult.terrain_type);
  const formattedExtent = formatSpatialExtent(classificationResult.spatial_extent);

  return (
    <div className="info-panel w-[350px] flex-shrink-0 bg-white shadow-lg overflow-y-auto transition-transform">
      <div className="info-content p-8">
        <div className="terrain-info block">
          <div
            className="terrain-type text-3xl font-bold mb-4 p-4 rounded text-center text-white"
            style={{ background: getTerrainTypeGradient(classificationResult.terrain_type) }}
          >
            {terrainInfo.name}
          </div>

          <div className="coordinates bg-gray-50 p-4 rounded mb-6 font-mono text-sm">
            <div className="text-gray-600 mb-1">Coordinates</div>
            <div className="font-semibold text-gray-800">
              {formatCoordinates(classificationResult.coordinates)}
            </div>
          </div>

          <div className="spatial-extent mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Spatial Extent</h3>
            <div className="extent-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
              <span className="extent-label font-medium text-gray-600">Agriculture</span>
              <span className="extent-value font-bold text-gray-800">{formattedExtent.agriculture}</span>
            </div>
            <div className="extent-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
              <span className="extent-label font-medium text-gray-600">Complex Agriculture</span>
              <span className="extent-value font-bold text-gray-800">{formattedExtent.complex_agriculture}</span>
            </div>
            <div className="extent-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
              <span className="extent-label font-medium text-gray-600">Forest</span>
              <span className="extent-value font-bold text-gray-800">{formattedExtent.forest}</span>
            </div>
            <div className="extent-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
              <span className="extent-label font-medium text-gray-600">Urban</span>
              <span className="extent-value font-bold text-gray-800">{formattedExtent.urban}</span>
            </div>
            <div className="extent-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
              <span className="extent-label font-medium text-gray-600">Coastal</span>
              <span className="extent-value font-bold text-gray-800">{formattedExtent.coastal}</span>
            </div>
          </div>

          {classificationResult.region && (
            <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Region</h3>
              <div className="text-sm text-gray-600">
                <div className="mb-1">
                  <span className="font-medium">Name:</span> {classificationResult.region.name}
                </div>
                <div>
                  <span className="font-medium">Number:</span> {classificationResult.region.number}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Analysis Settings</h3>
            <div className="text-sm text-gray-600">
              <div>
                <span className="font-medium">Analysis Radius:</span> {currentAnalysisRadius} km
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
