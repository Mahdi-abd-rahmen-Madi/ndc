// ConfigTab component

import { useState } from 'react';
import { Download, Upload, RotateCcw, Save } from 'lucide-react';
import type { TerrainConfig } from '../utils/types';
import { useTerrainConfig } from '../hooks/useTerrainConfig';

interface ConfigTabProps {
  config: TerrainConfig | null;
}

export default function ConfigTab({ config }: ConfigTabProps) {
  const { saveConfig, resetConfig, exportConfig, importConfig, loading } = useTerrainConfig();
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const handleExport = async () => {
    const exported = await exportConfig();
    if (exported) {
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'terrain-config.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    setImportError('');
    try {
      const success = await importConfig(importText);
      if (!success) {
        setImportError('Failed to import configuration');
      } else {
        setImportText('');
        alert('Configuration imported successfully');
      }
    } catch (err) {
      setImportError('Invalid JSON format');
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset the configuration to defaults?')) {
      const success = await resetConfig();
      if (success) {
        alert('Configuration reset successfully');
      }
    }
  };

  const handleSave = async () => {
    if (config) {
      const success = await saveConfig(config);
      if (success) {
        alert('Configuration saved successfully');
      }
    }
  };

  if (!config) {
    return (
      <div className="text-center text-gray-500 p-8">
        <p>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="config-section block">
      <div className="config-header mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Configuration Management</h2>
      </div>

      <div className="config-summary bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Configuration Summary</h3>
        <div className="summary-grid grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4 mt-2">
          <div className="summary-item text-center">
            <div className="summary-value text-3xl font-bold text-blue-600">
              {Object.keys(config.clc_code_mappings).length}
            </div>
            <div className="summary-label text-sm text-gray-600">Terrain Types</div>
          </div>
          <div className="summary-item text-center">
            <div className="summary-value text-3xl font-bold text-blue-600">
              {Object.keys(config.classification_rules).length}
            </div>
            <div className="summary-label text-sm text-gray-600">Rules</div>
          </div>
          <div className="summary-item text-center">
            <div className="summary-value text-3xl font-bold text-blue-600">
              {config.metadata.version}
            </div>
            <div className="summary-label text-sm text-gray-600">Version</div>
          </div>
        </div>
      </div>

      <div className="config-group mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b-2 border-primary pb-2">
          Metadata
        </h3>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Version</span>
          <span className="config-value font-bold text-gray-800">{config.metadata.version}</span>
        </div>
        <div className="config-item flex justify-between items-center p-3 mb-2 bg-gray-50 rounded-l-4 border-l-4 border-primary">
          <span className="config-label font-medium text-gray-600 flex-1">Last Updated</span>
          <span className="config-value font-bold text-gray-800">
            {new Date(config.metadata.last_updated).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="config-group mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b-2 border-primary pb-2">
          Import Configuration
        </h3>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste configuration JSON here..."
          className="w-full p-3 border border-gray-300 rounded text-sm font-mono h-40"
        />
        {importError && (
          <div className="mt-2 text-sm text-red-600">{importError}</div>
        )}
        <button
          onClick={handleImport}
          disabled={loading || !importText}
          className="mt-3 px-4 py-2 bg-primary text-white rounded font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Import Configuration
        </button>
      </div>

      <div className="config-actions p-4 bg-gray-50 border-t border-gray-200 flex gap-2 sticky bottom-0">
        <button
          onClick={handleSave}
          disabled={loading}
          className="config-btn primary px-4 py-2 border-none rounded cursor-pointer font-medium transition-all bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={handleExport}
          disabled={loading}
          className="config-btn success px-4 py-2 border-none rounded cursor-pointer font-medium transition-all bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        <button
          onClick={handleReset}
          disabled={loading}
          className="config-btn danger px-4 py-2 border-none rounded cursor-pointer font-medium transition-all bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>
    </div>
  );
}
