import { useState, useEffect } from 'react';
import { CatalogueConfig } from '../components/regular-user/types';

interface UseCatalogueConfigResult {
  config: CatalogueConfig | null;
  loading: boolean;
  error: string | null;
}

export function useCatalogueConfig(apiBaseUrl: string): UseCatalogueConfigResult {
  const [config, setConfig] = useState<CatalogueConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchConfig() {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/api/geodata/antenna-equipment/catalogue_config/`);
        if (!response.ok) {
          throw new Error('Failed to fetch catalogue config');
        }
        const data = await response.json();
        if (mounted) {
          setConfig(data as CatalogueConfig);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Error fetching catalogue config:", err);
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
  }, [apiBaseUrl]);

  return { config, loading, error };
}
