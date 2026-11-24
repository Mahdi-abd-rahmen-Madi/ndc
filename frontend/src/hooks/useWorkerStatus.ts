import { useCallback, useEffect, useState } from 'react';
import { apiClient, buildWebSocketUrl } from '../services/apiClient';

export type WorkerAvailabilityState = 'available' | 'busy' | 'offline';

export interface WorkerStatus {
  state: WorkerAvailabilityState;
  active_jobs: number;
  queue_size: number;
  total_ahead: number;
  current_job_type?: string | null;
  source?: string;
  updated_at?: string;
}

interface UseWorkerStatusOptions {
  enabled: boolean;
}

interface SharedWorkerState {
  status: WorkerStatus | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isConnected: boolean;
}

function isValidWorkerStatus(data: unknown): data is WorkerStatus {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Record<string, unknown>;
  return (
    candidate.state === 'available' ||
    candidate.state === 'busy' ||
    candidate.state === 'offline'
  );
}

// Module-level shared store so PortailHeader and RightPreviewPanel share one WebSocket
let sharedState: SharedWorkerState = {
  status: null,
  isLoading: false,
  isRefreshing: false,
  isConnected: false,
};
const listeners = new Set<() => void>();
let activeSubscribers = 0;
let sharedWs: WebSocket | null = null;
let reconnectTimer: number | null = null;
let refreshTimeout: number | null = null;
let reconnectAttempt = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function updateSharedState(patch: Partial<SharedWorkerState>) {
  sharedState = { ...sharedState, ...patch };
  emit();
}

function clearTimers() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (refreshTimeout !== null) {
    window.clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
}

async function fetchOneShotFallback(forceRefresh = false) {
  try {
    const path = forceRefresh ? '/api/worker/status/?refresh=1' : '/api/worker/status/';
    const data = await apiClient.get<WorkerStatus>(path);
    if (isValidWorkerStatus(data)) {
      updateSharedState({ status: data, isLoading: false, isRefreshing: false });
      return;
    }
  } catch {
    // Keep previous status if network request fails
  }
  updateSharedState({ isLoading: false, isRefreshing: false });
}

function scheduleReconnect() {
  if (activeSubscribers <= 0 || reconnectTimer !== null) return;
  const delayMs = Math.min(30000, 2000 * Math.pow(2, reconnectAttempt));
  reconnectAttempt = Math.min(reconnectAttempt + 1, 4);
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (activeSubscribers > 0) {
      connectSharedWebSocket();
    }
  }, delayMs);
}

function connectSharedWebSocket() {
  if (activeSubscribers <= 0 || sharedWs) return;
  if (!sharedState.status && !sharedState.isLoading) {
    updateSharedState({ isLoading: true });
  }

  let ws: WebSocket;
  try {
    ws = new WebSocket(buildWebSocketUrl('/ws/worker/status/'));
    sharedWs = ws;
  } catch {
    updateSharedState({ isConnected: false });
    if (!sharedState.status) {
      void fetchOneShotFallback(false);
    }
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    if (activeSubscribers <= 0) {
      ws.close();
      return;
    }
    reconnectAttempt = 0;
    updateSharedState({ isConnected: true });
  };

  ws.onmessage = (event) => {
    if (activeSubscribers <= 0) return;
    try {
      const parsed = JSON.parse(event.data);
      if (isValidWorkerStatus(parsed)) {
        if (refreshTimeout !== null) {
          window.clearTimeout(refreshTimeout);
          refreshTimeout = null;
        }
        updateSharedState({
          status: parsed,
          isLoading: false,
          isRefreshing: false,
        });
      }
    } catch {
      // Ignore malformed frames
    }
  };

  ws.onerror = () => {
    if (activeSubscribers <= 0) return;
    updateSharedState({ isConnected: false });
    if (!sharedState.status) {
      void fetchOneShotFallback(false);
    }
  };

  ws.onclose = () => {
    if (sharedWs === ws) {
      sharedWs = null;
    }
    updateSharedState({ isConnected: false });
    if (activeSubscribers <= 0) return;
    if (!sharedState.status) {
      void fetchOneShotFallback(false);
    }
    scheduleReconnect();
  };
}

function disconnectSharedWebSocket() {
  clearTimers();
  if (sharedWs) {
    const ws = sharedWs;
    sharedWs = null;
    try {
      ws.close();
    } catch {
      // Ignore close errors
    }
  }
  reconnectAttempt = 0;
  updateSharedState({ isConnected: false, isRefreshing: false });
}

/**
 * Subscribe to real-time Robot Worker availability & queue status via shared WebSocket push.
 * Performs no periodic polling; falls back to a one-shot HTTP GET if the WebSocket fails.
 */
export function useWorkerStatus({ enabled }: UseWorkerStatusOptions) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    activeSubscribers += 1;

    if (activeSubscribers === 1) {
      connectSharedWebSocket();
    } else if (!sharedWs && reconnectTimer === null) {
      connectSharedWebSocket();
    }

    return () => {
      listeners.delete(listener);
      activeSubscribers = Math.max(0, activeSubscribers - 1);
      if (activeSubscribers === 0) {
        disconnectSharedWebSocket();
      }
    };
  }, [enabled]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    updateSharedState({ isRefreshing: true });

    if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
      try {
        sharedWs.send(JSON.stringify({ action: 'refresh' }));
        if (refreshTimeout !== null) {
          window.clearTimeout(refreshTimeout);
        }
        refreshTimeout = window.setTimeout(() => {
          refreshTimeout = null;
          updateSharedState({ isRefreshing: false });
        }, 4000);
        return;
      } catch {
        // Fall through to HTTP fallback
      }
    }

    void fetchOneShotFallback(true);
  }, [enabled]);

  return {
    status: sharedState.status,
    isLoading: sharedState.isLoading,
    isRefreshing: sharedState.isRefreshing,
    isConnected: sharedState.isConnected,
    refresh,
  };
}
