import { apiClient, type RequestOptions } from './api-client';

export const APP_ROUTE_CHANGE_EVENT = 'bidar:route-change';

/**
 * Validates and normalizes an external URL for safe rendering in `<a href>`.
 * Rejects control characters, protocol-relative URLs, and non-http(s) schemes.
 * Auto-prefixes scheme-less domain values (e.g. `example.com`) with `https://`.
 */
export function safeExternalUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;

  // Reject any ASCII control characters (e.g. \n, \r, \t, \0)
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) <= 0x1f) {
      return null;
    }
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return null;
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return hasScheme ? parsed.href : `https://${trimmed}`;
  } catch {
    return null;
  }
}

/**
 * Navigates via History API while preserving `/app` prefix if currently active
 * and dispatching `APP_ROUTE_CHANGE_EVENT` so same-route query param updates propagate.
 */
export function navigateWithAppPrefix(
  path: string,
  onNavigate?: (path: string) => void
): void {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (onNavigate) {
    onNavigate(normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(APP_ROUTE_CHANGE_EVENT, { detail: { path: normalized } }));
    }
    return;
  }

  if (typeof window === 'undefined') return;
  const isAppPrefix =
    window.location.pathname === '/app' || window.location.pathname.startsWith('/app/');
  const target =
    isAppPrefix && !normalized.startsWith('/app/') && normalized !== '/app'
      ? `/app${normalized}`
      : normalized;

  window.history.pushState({}, '', target);
  window.dispatchEvent(new CustomEvent(APP_ROUTE_CHANGE_EVENT, { detail: { path: normalized } }));
}

/**
 * Downloads an authenticated CSV/binary blob via `apiClient.getBlob` and triggers browser download.
 * Defers `URL.revokeObjectURL` for Safari/WebKit compatibility.
 */
export async function downloadCsvBlob(
  endpoint: string,
  filename: string,
  options?: Omit<RequestOptions, 'body'>
): Promise<void> {
  const blob = options
    ? await apiClient.getBlob(endpoint, options)
    : await apiClient.getBlob(endpoint);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
}
