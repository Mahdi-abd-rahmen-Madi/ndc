// Custom hook for terrain configuration management

import { useState, useCallback } from 'react';
import type { TerrainConfig } from '../utils/types';

const API_BASE_URL = 'http://localhost:8000/api/geodata/terrain-config';

interface UseTerrainConfigReturn {
  config: TerrainConfig | null;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
  saveConfig: (config: TerrainConfig) => Promise<boolean>;
  resetConfig: () => Promise<boolean>;
  exportConfig: () => Promise<string | null>;
  importConfig: (configJson: string) => Promise<boolean>;
}

export function useTerrainConfig(): UseTerrainConfigReturn {
  const [config, setConfig] = useState<TerrainConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/config/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TerrainConfig = await response.json();
      setConfig(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Fetch config error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: TerrainConfig): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/update_config/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TerrainConfig = await response.json();
      setConfig(data);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Save config error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetConfig = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/reset/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TerrainConfig = await response.json();
      setConfig(data);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Reset config error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportConfig = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/export/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Export config error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const importConfig = useCallback(async (configJson: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const parsedConfig = JSON.parse(configJson);
      
      const response = await fetch(`${API_BASE_URL}/import_config/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TerrainConfig = await response.json();
      setConfig(data);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Import config error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    config,
    loading,
    error,
    fetchConfig,
    saveConfig,
    resetConfig,
    exportConfig,
    importConfig,
  };
}
