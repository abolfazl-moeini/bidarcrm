import { vi } from 'vitest';
import apiFetch from '@wordpress/api-fetch';

/**
 * Module-level mock for consumer testing in Vitest.
 */
vi.mock('@wordpress/api-fetch', () => ({
  default: vi.fn(),
}));

/**
 * Example Consumer Service invoking @wordpress/api-fetch directly.
 */
async function fetchPluginSettings(signal) {
  try {
    return await apiFetch({
      path: '/my-plugin/v1/settings',
      method: 'GET',
      signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw err;
    }
    if (err && err.code === 'rest_forbidden') {
      throw new Error('Permission denied: You cannot view settings.');
    }
    throw new Error('API Error: Unable to load settings.');
  }
}

describe('Consumer Service with Module Mock: fetchPluginSettings (Vitest)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves payload when apiFetch returns successfully', async () => {
    const mockPayload = { apiKey: 'live_key_999', isEnabled: true };
    vi.mocked(apiFetch).mockResolvedValueOnce(mockPayload);

    const result = await fetchPluginSettings();

    expect(apiFetch).toHaveBeenCalledWith({
      path: '/my-plugin/v1/settings',
      method: 'GET',
      signal: undefined,
    });
    expect(result).toEqual(mockPayload);
  });

  it('translates rest_forbidden into formatted error message', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce({
      code: 'rest_forbidden',
      message: 'Forbidden',
      data: { status: 403 },
    });

    await expect(fetchPluginSettings()).rejects.toThrow(
      'Permission denied: You cannot view settings.'
    );
  });

  it('propagates AbortError when signal is cancelled', async () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    vi.mocked(apiFetch).mockRejectedValueOnce(abortErr);

    const controller = new AbortController();
    controller.abort();

    await expect(fetchPluginSettings(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

/**
 * Example Middleware Testing: Custom Nonce Header Middleware
 */
function createNonceMiddleware(nonce) {
  return (options, next) => {
    const headers = options.headers || {};
    return next({
      ...options,
      headers: {
        ...headers,
        'X-WP-Nonce': nonce,
      },
    });
  };
}

describe('apiFetch Middleware Contract (Vitest)', () => {
  it('appends X-WP-Nonce header to outgoing request options', async () => {
    const middleware = createNonceMiddleware('sample-nonce-abc');
    const mockNext = vi.fn().mockResolvedValue({ status: 200 });

    const result = await middleware({ path: '/test' }, mockNext);

    expect(mockNext).toHaveBeenCalledWith({
      path: '/test',
      headers: {
        'X-WP-Nonce': 'sample-nonce-abc',
      },
    });
    expect(result).toEqual({ status: 200 });
  });
});
