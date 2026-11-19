// Custom hook for terrain classification API calls

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../services/apiClient';
import type {
  TerrainClassificationResponse,
  FastClassificationResponse,
  TerrainConfig,
} from '../utils/types';

interface UseTerrainClassificationReturn {
  classify: (
    lat: number,
    lng: number,
    config?: TerrainConfig,
    analysisRadius?: number
  ) => Promise<TerrainClassificationResponse | null>;
  classifyFast: (lat: number, lng: number) => Promise<FastClassificationResponse | null>;
  reset: () => void;
  loading: boolean;
  error: string | null;
  result: TerrainClassificationResponse | null;
  fastResult: FastClassificationResponse | null;
}

export function useTerrainClassification(): UseTerrainClassificationReturn {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TerrainClassificationResponse | null>(null);
  const [fastResult, setFastResult] = useState<FastClassificationResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setFastResult(null);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const classify = useCallback(
    async (
      lat: number,
      lng: number,
      config?: TerrainConfig,
      analysisRadius?: number
    ): Promise<TerrainClassificationResponse | null> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const payload: Record<string, unknown> = {
          latitude: lat,
          longitude: lng,
        };
        if (config) payload.config = config;
        if (analysisRadius !== undefined) payload.analysis_radius_km = analysisRadius;

        const data = await apiClient.post<TerrainClassificationResponse>(
          '/api/geodata/terrain-config/test_coordinates/',
          payload,
          { signal: abortControllerRef.current.signal }
        );
        setResult(data);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Classification error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  const classifyFast = useCallback(
    async (lat: number, lng: number): Promise<FastClassificationResponse | null> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const data = await apiClient.post<FastClassificationResponse>(
          '/api/geodata/terrain-classify-fast/',
          { latitude: lat, longitude: lng },
          { signal: abortControllerRef.current.signal }
        );
        setFastResult(data);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Fast classification error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  return {
    classify,
    classifyFast,
    reset,
    loading,
    error,
    result,
    fastResult,
  };
}
