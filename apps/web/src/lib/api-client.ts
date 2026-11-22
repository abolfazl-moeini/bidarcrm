/**
 * BidarCRM - Typed EspoCRM 10.1.4 API Client
 *
 * Implements official EspoCRM authentication headers, automatic cookie preservation
 * (credentials: 'include' for HttpOnly auth-token-secret), structured error mapping,
 * and 401 session expiration event broadcasts.
 */

export const API_UNAUTHORIZED_EVENT = 'bidar:unauthorized';

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly data: unknown;

  constructor(status: number, statusText: string, data?: unknown, customMessage?: string) {
    let message = customMessage;
    if (!message) {
      let details = '';
      if (typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message: unknown }).message === 'string') {
        details = (data as { message: string }).message;
      } else if (typeof data === 'string' && data.length > 0) {
        details = data;
      }

      const base = `HTTP ${status}: ${statusText || 'Request failed'}`;
      message = details ? `${base} - ${details}` : base;
    }

    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;

    // Maintain prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

export class ApiClient {
  private baseUrl: string;
  private auth: { username: string; token: string } | null = null;
  private unauthorizedListeners = new Set<(error: ApiError) => void>();

  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Configures active authentication credentials for EspoCRM token-based API access.
   */
  public setAuth(username: string, token: string): void {
    this.auth = { username, token };
  }

  /**
   * Clears stored credentials.
   */
  public clearAuth(): void {
    this.auth = null;
  }

  /**
   * Registers a callback listener executed whenever a 401 Unauthorized response is intercepted.
   * Returns an unsubscribe function.
   */
  public onUnauthorized(callback: (error: ApiError) => void): () => void {
    this.unauthorizedListeners.add(callback);
    return () => {
      this.unauthorizedListeners.delete(callback);
    };
  }

  /**
   * Executes a typed HTTP request against EspoCRM REST API.
   */
  public async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, body, headers: customHeaders, method = 'GET', ...fetchInit } = options;

    // 1. Build destination URL
    let fullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    // 2. Prepare headers
    const headers = new Headers(customHeaders);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (this.auth?.username && this.auth?.token) {
      const tokenHeader = btoa(`${this.auth.username}:${this.auth.token}`);
      headers.set('Espo-Authorization', tokenHeader);
      headers.set('Espo-Authorization-By-Token', 'true');
    }

    let payloadBody: BodyInit | null | undefined = undefined;
    if (body !== undefined && body !== null) {
      if (typeof body === 'string' || body instanceof FormData || body instanceof Blob) {
        payloadBody = body as BodyInit;
      } else {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
        payloadBody = JSON.stringify(body);
      }
    }

    // 3. Perform network call with mandatory credentials: 'include'
    const response = await fetch(fullUrl, {
      ...fetchInit,
      method,
      headers,
      body: payloadBody,
      credentials: 'include',
    });

    // 4. Handle 204 No Content
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      if (!response.ok) {
        throw new ApiError(response.status, response.statusText);
      }
      return null as unknown as T;
    }

    // 5. Parse response body safely
    const contentType = response.headers.get('content-type') || '';
    let responseData: unknown = null;

    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    } else {
      try {
        responseData = await response.text();
      } catch {
        responseData = null;
      }
    }

    // 6. Handle HTTP Error statuses
    if (!response.ok) {
      const error = new ApiError(response.status, response.statusText, responseData);

      if (response.status === 401) {
        // Broadcast custom browser event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(API_UNAUTHORIZED_EVENT, { detail: { error } })
          );
        }

        // Notify registered subscribers
        for (const listener of this.unauthorizedListeners) {
          try {
            listener(error);
          } catch (listenerError) {
            console.error('Error in onUnauthorized listener:', listenerError);
          }
        }
      }

      throw error;
    }

    return responseData as T;
  }

  public get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public put<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  public delete<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
