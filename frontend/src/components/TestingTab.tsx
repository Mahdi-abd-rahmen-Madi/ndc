// TestingTab component

import { useState } from 'react';
import type { TerrainClassificationResponse } from '../utils/types';
import { parseCoordinateString } from '../utils/formatters';

interface TestingTabProps {
  classificationResult: TerrainClassificationResponse | null;
  currentAnalysisRadius: number;
  onRadiusChange: (radius: number) => void;
}

export default function TestingTab({
  classificationResult,
  currentAnalysisRadius,
  onRadiusChange,
}: TestingTabProps) {
  const [testLat, setTestLat] = useState('');
  const [testLng, setTestLng] = useState('');
  const [testError, setTestError] = useState('');

  const handleTestCoordinates = () => {
    setTestError('');
    const coordStr = `${testLat}, ${testLng}`;
    const coords = parseCoordinateString(coordStr);

    if (!coords) {
      setTestError('Invalid coordinates. Please enter valid latitude and longitude.');
      return;
    }

    // This would trigger a new classification with the test coordinates
    // For now, just log them
    console.log('Test coordinates:', coords);
  };

  return (
    <div className="config-section block">
      <div className="config-header mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Rule Testing</h2>
      </div>

      <div className="test-coordinates bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Test Coordinates</h3>
        <div className="test-inputs flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Latitude"
            value={testLat}
            onChange={(e) => setTestLat(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Longitude"
            value={testLng}
            onChange={(e) => setTestLng(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded text-sm"
          />
        </div>
        <button
          onClick={handleTestCoordinates}
          className="w-full px-4 py-2 bg-primary text-white rounded font-medium hover:bg-primary-dark transition-colors"
        >
          Test Classification
        </button>
        {testError && (
          <div className="mt-2 text-sm text-red-600">{testError}</div>
        )}
      </div>

      <div className="radius-control-container bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">Analysis Radius</h3>
        <div className="radius-slider-container mb-4">
          <label className="block font-semibold text-gray-800 mb-2">
            Current Radius: {currentAnalysisRadius} km
          </label>
          <input
            type="range"
            min="0.1"
            max="5.0"
            step="0.1"
            value={currentAnalysisRadius}
            onChange={(e) => onRadiusChange(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.1 km</span>
            <span>5.0 km</span>
          </div>
        </div>
      </div>

      {classificationResult && (
        <div className="mt-6 p-4 bg-green-50 border border-green-300 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3">Current Classification Result</h3>
          <div className="text-sm text-gray-600">
            <div className="mb-2">
              <span className="font-medium">Terrain Type:</span> {classificationResult.terrain_type}
            </div>
            <div className="mb-2">
              <span className="font-medium">Coordinates:</span> {classificationResult.coordinates.latitude.toFixed(6)}, {classificationResult.coordinates.longitude.toFixed(6)}
            </div>
            <div>
              <span className="font-medium">Analysis Radius:</span> {currentAnalysisRadius} km
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
