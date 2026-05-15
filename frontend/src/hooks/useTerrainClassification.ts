// Custom hook for terrain classification API calls

import { useState, useCallback, useRef } from 'react';
import type {
  TerrainClassificationResponse,
  FastClassificationResponse,
  TerrainConfig,
} from '../utils/types';

const API_BASE_URL = 'http://localhost:8000/api/geodata';

interface UseTerrainClassificationReturn {
  classify: (
    lat: number,
    lng: number,
    config?: TerrainConfig,
    analysisRadius?: number
  ) => Promise<TerrainClassificationResponse | null>;
  classifyFast: (lat: number, lng: number) => Promise<FastClassificationResponse | null>;
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

  const classify = useCallback(
    async (
      lat: number,
      lng: number,
      config?: TerrainConfig,
      analysisRadius?: number
    ): Promise<TerrainClassificationResponse | null> => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const payload: any = {
          latitude: lat,
          longitude: lng,
        };

        if (config) {
          payload.config = config;
        }

        if (analysisRadius !== undefined) {
          payload.analysis_radius_km = analysisRadius;
        }

        const response = await fetch(`${API_BASE_URL}/terrain-config/test_coordinates/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: TerrainClassificationResponse = await response.json();
        setResult(data);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Request aborted');
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
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/terrain-classify-fast/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: FastClassificationResponse = await response.json();
        setFastResult(data);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Request aborted');
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
    loading,
    error,
    result,
    fastResult,
  };
}
