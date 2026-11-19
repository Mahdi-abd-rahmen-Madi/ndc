/**
 * Centralized API, Media URL, and WebSocket client.
 * Single source of truth for VITE_API_URL, DRF Token authentication headers,
 * CSRF cookies, error parsing, and media/WS URL resolution.
 */

export const API_BASE_URL: string = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('ndc_auth_token');
  } catch {
    return null;
  }
}

export function getAuthHeaders(extra?: Record<string, string>, tokenOverride?: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }
  return headers;
}

export function buildApiUrl(path: string, baseUrlOverride?: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const base = (baseUrlOverride !== undefined ? baseUrlOverride : API_BASE_URL).replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function resolveMediaUrl(url: string | null | undefined, baseUrlOverride?: string): string {
  if (!url) return '';
  if (/^(https?:\/\/|data:|blob:)/i.test(url)) {
    return url;
  }
  return buildApiUrl(url, baseUrlOverride);
}

export function buildWebSocketUrl(path: string, tokenOverride?: string | null, baseUrlOverride?: string): string {
  const base = (baseUrlOverride !== undefined ? baseUrlOverride : API_BASE_URL).replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let wsBase: string;
  if (base) {
    wsBase = base.replace(/^http/i, 'ws');
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsBase = `${protocol}//${window.location.host}`;
  }
  const token = tokenOverride !== undefined ? tokenOverride : getAuthToken();
  const sep = normalizedPath.includes('?') ? '&' : '?';
  return token ? `${wsBase}${normalizedPath}${sep}token=${encodeURIComponent(token)}` : `${wsBase}${normalizedPath}`;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
  baseUrl?: string;
  /** Pass `false` to omit the Authorization header (for unauthenticated public endpoints if desired). Default: true. */
  auth?: boolean;
  token?: string | null;
  /** Set `raw: true` to return the underlying Response without JSON parsing. */
  raw?: boolean;
}

export async function apiRequest<T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    body,
    headers: customHeaders,
    baseUrl,
    auth = true,
    token,
    raw = false,
    ...rest
  } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const baseHeaders: Record<string, string> = {};
  if (!isFormData && body !== undefined) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  const mergedHeaders = auth
    ? getAuthHeaders({ ...baseHeaders, ...(customHeaders || {}) }, token)
    : { ...baseHeaders, ...(customHeaders || {}) };

  const fetchBody: BodyInit | undefined =
    body === undefined
      ? undefined
      : isFormData || typeof body === 'string'
        ? (body as BodyInit)
        : JSON.stringify(body);

  const response = await fetch(buildApiUrl(path, baseUrl), {
    ...rest,
    headers: mergedHeaders,
    body: fetchBody,
  });

  if (raw) {
    return response as unknown as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errData: unknown = null;
    let errMessage = `HTTP error! status: ${response.status}`;
    try {
      if (isJson) {
        errData = await response.json();
        const obj = errData as Record<string, unknown>;
        if (typeof obj?.error === 'string') errMessage = obj.error;
        else if (typeof obj?.detail === 'string') errMessage = obj.detail;
        else if (typeof obj?.message === 'string') errMessage = obj.message;
      } else {
        const text = await response.text();
        if (text) errMessage = text.slice(0, 200);
      }
    } catch {
      // Keep default HTTP status message
    }
    throw new ApiError(errMessage, response.status, errData);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  if (isJson) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export const apiClient = {
  get: <T = any>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T = any>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T = any>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = any>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = any>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

