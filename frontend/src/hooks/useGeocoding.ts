// Custom hook for IGN geocoding and reverse geocoding API calls

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiClient';
import type { GeocodingAddress } from '../utils/types';

interface UseGeocodingReturn {
  search: (query: string, limit?: number) => Promise<GeocodingAddress[]>;
  reverseGeocode: (lat: number, lng: number) => Promise<GeocodingAddress | null>;
  loading: boolean;
  error: string | null;
}

export function useGeocoding(): UseGeocodingReturn {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const reverseAbortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (query: string, limit: number = 5): Promise<GeocodingAddress[]> => {
      if (!query.trim()) return [];

      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }

      searchAbortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const data = await apiClient.get<{ results?: GeocodingAddress[] }>(
          `/api/geodata/geocoding-search/search/?q=${encodeURIComponent(query)}&limit=${limit}`,
          { signal: searchAbortControllerRef.current.signal }
        );
        return data.results || [];
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return [];
        }
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Geocoding search error:', errorMessage);
        return [];
      } finally {
        setLoading(false);
        searchAbortControllerRef.current = null;
      }
    },
    []
  );

  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<GeocodingAddress | null> => {
      if (reverseAbortControllerRef.current) {
        reverseAbortControllerRef.current.abort();
      }

      reverseAbortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        return await apiClient.get<GeocodingAddress>(
          `/api/geodata/geocoding-search/reverse/?latitude=${lat}&longitude=${lng}`,
          { signal: reverseAbortControllerRef.current.signal }
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Reverse geocoding error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
        reverseAbortControllerRef.current = null;
      }
    },
    []
  );

  return {
    search,
    reverseGeocode,
    loading,
    error,
  };
}
