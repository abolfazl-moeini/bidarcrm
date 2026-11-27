import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError, API_UNAUTHORIZED_EVENT, encodeBase64Utf8 } from '../lib/api-client';

describe('ApiClient & EspoCRM 10.1.4 Auth/Error Handling', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    apiClient.clearAuth();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('encodeBase64Utf8', () => {
    it('encodes standard ASCII strings identically to btoa', () => {
      const ascii = 'admin:secret123';
      expect(encodeBase64Utf8(ascii)).toBe(btoa(ascii));
    });

    it('safely encodes Persian and UTF-8 strings without throwing InvalidCharacterError', () => {
      const persianStr = 'کاربر_فروش:رمز-عبور-فارسی-۱۴۰۵';
      expect(() => btoa(persianStr)).toThrow(); // Native btoa fails on non-Latin1
      expect(() => encodeBase64Utf8(persianStr)).not.toThrow();

      const encoded = encodeBase64Utf8(persianStr);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      // Verify round-trip decoding via TextDecoder
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoded = new TextDecoder().decode(bytes);
      expect(decoded).toBe(persianStr);
    });

    it('uses encodeBase64Utf8 for Espo-Authorization header in request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: '1' }),
      });
      globalThis.fetch = mockFetch;

      apiClient.setAuth('کاربر_تست', 'توکن_فارسی_۱۲۳');
      await apiClient.get('/test');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('Espo-Authorization')).toBe(encodeBase64Utf8('کاربر_تست:توکن_فارسی_۱۲۳'));
    });
  });

  describe('Headers & Credentials', () => {
    it('sends credentials: "include" on every request to preserve HttpOnly cookies', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });
      globalThis.fetch = mockFetch;

      await apiClient.get('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('attaches Espo-Authorization and Espo-Authorization-By-Token headers when authenticated', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: '1', name: 'Opportunity A' }),
      });
      globalThis.fetch = mockFetch;

      apiClient.setAuth('admin', 'sample-token-123');
      await apiClient.get('/Opportunity/1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);

      const expectedTokenHeader = btoa('admin:sample-token-123');
      expect(headers.get('Espo-Authorization')).toBe(expectedTokenHeader);
      expect(headers.get('Espo-Authorization-By-Token')).toBe('true');
    });

    it('removes auth headers when clearAuth is invoked', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'public' }),
      });
      globalThis.fetch = mockFetch;

      apiClient.setAuth('admin', 'sample-token-123');
      apiClient.clearAuth();
      await apiClient.get('/public-endpoint');

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.has('Espo-Authorization')).toBe(false);
      expect(headers.has('Espo-Authorization-By-Token')).toBe(false);
    });

    it('sets Content-Type: application/json for POST/PUT requests with body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'new-id' }),
      });
      globalThis.fetch = mockFetch;

      await apiClient.post('/Opportunity', { name: 'Deal 1', amount: 5000000 });

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(options.body).toBe(JSON.stringify({ name: 'Deal 1', amount: 5000000 }));
    });

    it('correctly appends query parameters to endpoint URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ list: [], total: 0 }),
      });
      globalThis.fetch = mockFetch;

      await apiClient.get('/Opportunity', {
        params: { maxSize: 20, offset: 0, sortBy: 'createdAt' },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('maxSize=20');
      expect(url).toContain('offset=0');
      expect(url).toContain('sortBy=createdAt');
    });
  });

  describe('Error Handling & HTTP Statuses', () => {
    it('transforms 400 Bad Request into structured ApiError', async () => {
      const errorPayload = { message: 'Validation failed', fields: { name: 'Required' } };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => errorPayload,
      });

      await expect(apiClient.post('/Opportunity', {})).rejects.toThrow(ApiError);
      try {
        await apiClient.post('/Opportunity', {});
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.statusText).toBe('Bad Request');
        expect(apiErr.data).toEqual(errorPayload);
      }
    });

    it('transforms 403 Forbidden into ApiError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Access denied to scope' }),
      });

      await expect(apiClient.get('/Admin/settings')).rejects.toThrow(ApiError);
      try {
        await apiClient.get('/Admin/settings');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(403);
      }
    });

    it('transforms 500 Internal Server Error into ApiError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Database connection timeout',
      });

      await expect(apiClient.get('/Opportunity')).rejects.toThrow(ApiError);
      try {
        await apiClient.get('/Opportunity');
      } catch (err) {
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.message).toContain('Internal Server Error');
      }
    });

    it('dispatches window unauthorized event and executes listener on 401 Unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Token expired' }),
      });

      const eventListener = vi.fn();
      window.addEventListener(API_UNAUTHORIZED_EVENT, eventListener);

      const callbackListener = vi.fn();
      const unsubscribe = apiClient.onUnauthorized(callbackListener);

      await expect(apiClient.get('/App/user')).rejects.toThrow(ApiError);

      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(callbackListener).toHaveBeenCalledTimes(1);

      unsubscribe();
      window.removeEventListener(API_UNAUTHORIZED_EVENT, eventListener);
    });
  });

  describe('HTTP Methods & Empty Responses', () => {
    it('handles 204 No Content without JSON parsing errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        text: async () => '',
      });

      const result = await apiClient.delete('/Opportunity/123');
      expect(result).toBeNull();
    });

    it('supports put and patch requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: '1', stage: 'Proposal' }),
      });
      globalThis.fetch = mockFetch;

      const putRes = await apiClient.put('/Opportunity/1', { stage: 'Proposal' });
      expect(putRes).toEqual({ id: '1', stage: 'Proposal' });
      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');

      const patchRes = await apiClient.patch('/Opportunity/1', { isRotten: false });
      expect(patchRes).toEqual({ id: '1', stage: 'Proposal' });
      expect(mockFetch.mock.calls[1][1].method).toBe('PATCH');
    });
  });

  describe('getBlob & skipUnauthorizedEvent', () => {
    it('getBlob broadcasts API_UNAUTHORIZED_EVENT and parses JSON error detail on 401', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Blob token expired' }),
      });

      const eventListener = vi.fn();
      window.addEventListener(API_UNAUTHORIZED_EVENT, eventListener);
      const callbackListener = vi.fn();
      const unsubscribe = apiClient.onUnauthorized(callbackListener);

      let caught: unknown;
      try {
        await apiClient.getBlob('/BidarExport/Lead');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(401);
      expect((caught as ApiError).data).toEqual({ message: 'Blob token expired' });
      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(callbackListener).toHaveBeenCalledTimes(1);

      unsubscribe();
      window.removeEventListener(API_UNAUTHORIZED_EVENT, eventListener);
    });

    it('getBlob handles non-JSON error responses (e.g. HTML 502) without throwing SyntaxError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><body>502 Bad Gateway</body></html>',
      });

      await expect(apiClient.getBlob('/BidarExport/Lead')).rejects.toThrow(ApiError);
    });

    it('skips API_UNAUTHORIZED_EVENT when skipUnauthorizedEvent is true', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Invalid credentials' }),
      });

      const eventListener = vi.fn();
      window.addEventListener(API_UNAUTHORIZED_EVENT, eventListener);
      const callbackListener = vi.fn();
      const unsubscribe = apiClient.onUnauthorized(callbackListener);

      await expect(
        apiClient.request('/App/user', { method: 'GET', skipUnauthorizedEvent: true })
      ).rejects.toThrow(ApiError);

      expect(eventListener).not.toHaveBeenCalled();
      expect(callbackListener).not.toHaveBeenCalled();

      unsubscribe();
      window.removeEventListener(API_UNAUTHORIZED_EVENT, eventListener);
    });
  });
});
