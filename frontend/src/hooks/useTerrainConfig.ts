// Custom hook for terrain configuration management

import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import type { TerrainConfig } from '../utils/types';

const CONFIG_BASE = '/api/geodata/terrain-config';

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
      const data = await apiClient.get<TerrainConfig>(`${CONFIG_BASE}/config/`);
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
      const data = await apiClient.post<{ config?: TerrainConfig } & TerrainConfig>(
        `${CONFIG_BASE}/update_config/`,
        newConfig
      );
      setConfig(data.config ?? data);
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
      const data = await apiClient.post<{ config?: TerrainConfig } & TerrainConfig>(
        `${CONFIG_BASE}/reset/`
      );
      setConfig(data.config ?? data);
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
      const data = await apiClient.get(`${CONFIG_BASE}/export/`);
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
      // Validate JSON before sending
      JSON.parse(configJson);
      const data = await apiClient.post<{ config?: TerrainConfig } & TerrainConfig>(
        `${CONFIG_BASE}/import_config/`,
        { config: configJson }
      );
      setConfig(data.config ?? data);
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
