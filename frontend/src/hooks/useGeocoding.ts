// Custom hook for IGN geocoding and reverse geocoding API calls

import { useState, useCallback, useRef } from 'react';
import type { GeocodingAddress } from '../utils/types';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api/geodata/geocoding-search`;

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

      // Cancel any pending search request
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }

      searchAbortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const url = `${API_BASE_URL}/search/?q=${encodeURIComponent(query)}&limit=${limit}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: searchAbortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.results || [];
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Search request aborted');
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
      // Cancel any pending reverse geocode request
      if (reverseAbortControllerRef.current) {
        reverseAbortControllerRef.current.abort();
      }

      reverseAbortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const url = `${API_BASE_URL}/reverse/?latitude=${lat}&longitude=${lng}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: reverseAbortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: GeocodingAddress = await response.json();
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Reverse geocoding request aborted');
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
