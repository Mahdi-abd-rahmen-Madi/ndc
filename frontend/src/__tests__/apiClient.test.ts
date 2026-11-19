import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ApiError,
  apiClient,
  buildApiUrl,
  buildWebSocketUrl,
  resolveMediaUrl,
} from '../services/apiClient';

describe('apiClient utilities', () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const store = new Map<string, string>([['ndc_auth_token', 'tok_12345']]);
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    };
    (globalThis as any).window = {
      location: { protocol: 'https:', host: 'ndc.example.com' },
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
    globalThis.fetch = originalFetch;
  });

  it('builds API and media URLs without double slashes', () => {
    assert.equal(buildApiUrl('/api/calculations/', 'https://api.example.com/'), 'https://api.example.com/api/calculations/');
    assert.equal(buildApiUrl('api/calculations/', ''), '/api/calculations/');
    assert.equal(resolveMediaUrl('/media/uploads/a.pdf', 'https://api.example.com'), 'https://api.example.com/media/uploads/a.pdf');
    assert.equal(resolveMediaUrl('https://cdn.example.com/x.png', 'https://api.example.com'), 'https://cdn.example.com/x.png');
    assert.equal(resolveMediaUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
    assert.equal(resolveMediaUrl(null), '');
  });

  it('builds WebSocket URLs with auth token query parameter', () => {
    assert.equal(
      buildWebSocketUrl('/ws/calculations/42/'),
      'wss://ndc.example.com/ws/calculations/42/?token=tok_12345'
    );
    assert.equal(
      buildWebSocketUrl('/ws/calculations/42/', null, 'http://localhost:8001'),
      'ws://localhost:8001/ws/calculations/42/'
    );
  });

  it('injects Authorization Token header and parses JSON & ApiError properly', async () => {
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'ok' }),
      } as any;
    }) as any;

    const res = await apiClient.post('/api/test/', { hello: 'world' });
    assert.deepEqual(res, { status: 'ok' });
    assert.equal(capturedHeaders['Authorization'], 'Token tok_12345');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');

    globalThis.fetch = (async () => ({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: 'Permission denied' }),
    })) as any;

    await assert.rejects(
      () => apiClient.get('/api/secret/'),
      (err: unknown) => err instanceof ApiError && err.status === 403 && err.message === 'Permission denied'
    );
  });
});

