import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { CatalogueConfig } from '../components/regular-user/types';

interface UseCatalogueConfigResult {
  config: CatalogueConfig | null;
  loading: boolean;
  error: string | null;
}

// Module-level deduplication cache so remounts share a single network request
const catalogueConfigCache = new Map<string, CatalogueConfig>();
const inFlightRequests = new Map<string, Promise<CatalogueConfig>>();

export function useCatalogueConfig(apiBaseUrl?: string): UseCatalogueConfigResult {
  const cacheKey = apiBaseUrl ?? '';
  const [config, setConfig] = useState<CatalogueConfig | null>(
    () => catalogueConfigCache.get(cacheKey) ?? null
  );
  const [loading, setLoading] = useState<boolean>(() => !catalogueConfigCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const cached = catalogueConfigCache.get(cacheKey);
    if (cached) {
      setConfig(cached);
      setLoading(false);
      return;
    }

    async function fetchConfig() {
      try {
        setLoading(true);
        let promise = inFlightRequests.get(cacheKey);
        if (!promise) {
          promise = apiClient
            .get<CatalogueConfig>('/api/geodata/antenna-equipment/catalogue_config/', {
              baseUrl: apiBaseUrl,
            })
            .finally(() => {
              inFlightRequests.delete(cacheKey);
            });
          inFlightRequests.set(cacheKey, promise);
        }

        const data = await promise;
        catalogueConfigCache.set(cacheKey, data);
        if (mounted) {
          setConfig(data);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Error fetching catalogue config:', err);
          setError(err.message || 'Error fetching catalogue config');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchConfig();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, cacheKey]);

  return { config, loading, error };
}
