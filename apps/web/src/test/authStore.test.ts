import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authStore } from '../features/auth/authStore';
import { apiClient, ApiError, API_UNAUTHORIZED_EVENT, encodeBase64Utf8 } from '../lib/api-client';
import { queryClient } from '../lib/query-client';

describe('authStore & Session Security', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await authStore.logout(true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('login() encodes credentials with encodeBase64Utf8 (supports UTF-8 / Persian)', async () => {
    const postSpy = vi.spyOn(apiClient, 'request').mockResolvedValue({
      user: { id: 'u-1', userName: 'علی_اکبری', name: 'علی اکبری', roles: ['admin'] },
      token: 'jwt-secret-token-123',
    });

    const result = await authStore.login('علی_اکبری', 'رمز-عبور-فارسی-۱۴۰۵');

    expect(result.token).toBe('jwt-secret-token-123');
    expect(authStore.getState().isAuthenticated).toBe(true);
    expect(authStore.getState().user?.userName).toBe('علی_اکبری');

    // Verify encodeBase64Utf8 was used for basicAuth header
    expect(postSpy).toHaveBeenCalledWith('/App/user', expect.objectContaining({
      headers: expect.objectContaining({
        'Espo-Authorization': encodeBase64Utf8('علی_اکبری:رمز-عبور-فارسی-۱۴۰۵'),
      }),
    }));
  });

  it('logout() clears queryClient cache, apiClient auth, and resets state', async () => {
    // Seed queryClient with some cached data
    queryClient.setQueryData(['testKey'], { secretData: 123 });
    expect(queryClient.getQueryData(['testKey'])).toBeDefined();

    const queryClearSpy = vi.spyOn(queryClient, 'clear');
    const apiClearSpy = vi.spyOn(apiClient, 'clearAuth');
    const destroySpy = vi.spyOn(apiClient, 'post').mockResolvedValue(null);

    // Mock an authenticated state
    (authStore as any).setState({
      user: { id: 'u-1', userName: 'admin', name: 'Admin', roles: [] },
      token: 'valid-token',
      isAuthenticated: true,
    });

    await authStore.logout(false);

    expect(destroySpy).toHaveBeenCalledWith('/App/destroyAuthToken', { token: 'valid-token' });
    expect(apiClearSpy).toHaveBeenCalled();
    expect(queryClearSpy).toHaveBeenCalled();
    expect(queryClient.getQueryData(['testKey'])).toBeUndefined();
    expect(authStore.getState().isAuthenticated).toBe(false);
    expect(authStore.getState().user).toBeNull();
  });

  it('logout(fromUnauthorized = true) does NOT make an HTTP request to /App/destroyAuthToken', async () => {
    const destroySpy = vi.spyOn(apiClient, 'post').mockResolvedValue(null);
    const queryClearSpy = vi.spyOn(queryClient, 'clear');

    (authStore as any).setState({
      user: { id: 'u-1', userName: 'admin', name: 'Admin', roles: [] },
      token: 'valid-token',
      isAuthenticated: true,
    });

    await authStore.logout(true);

    expect(destroySpy).not.toHaveBeenCalled();
    expect(queryClearSpy).toHaveBeenCalled();
    expect(authStore.getState().isAuthenticated).toBe(false);
  });

  it('handles API_UNAUTHORIZED_EVENT by calling logout(true)', async () => {
    const logoutSpy = vi.spyOn(authStore, 'logout');

    window.dispatchEvent(new CustomEvent(API_UNAUTHORIZED_EVENT));

    expect(logoutSpy).toHaveBeenCalledWith(true);
  });

  it('guards against re-entrant recursion during logout', async () => {
    let callCount = 0;
    vi.spyOn(apiClient, 'post').mockImplementation(async () => {
      callCount++;
      // Nested logout call during logout
      await authStore.logout();
      return null;
    });

    (authStore as any).setState({
      user: { id: 'u-1', userName: 'admin', name: 'Admin', roles: [] },
      token: 'valid-token',
      isAuthenticated: true,
    });

    await authStore.logout();

    // destroyAuthToken should only have been called once, recursion was prevented
    expect(callCount).toBe(1);
  });

  it('checkAuth() preserves session on 500 or network error without wiping localStorage', async () => {
    (authStore as any).setState({
      user: { id: 'u-1', userName: 'admin', name: 'Admin', roles: [] },
      token: 'valid-token',
      isAuthenticated: true,
    });
    localStorage.setItem('bidar_auth_token', 'valid-token');

    vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiError(500, 'Internal Server Error'));
    const logoutSpy = vi.spyOn(authStore, 'logout');

    const ok = await authStore.checkAuth();

    expect(ok).toBe(false);
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(authStore.getState().isAuthenticated).toBe(true);
    expect(authStore.getState().isLoading).toBe(false);
    expect(localStorage.getItem('bidar_auth_token')).toBe('valid-token');
  });

  it('checkAuth() logs out on 401 Unauthorized', async () => {
    (authStore as any).setState({
      user: { id: 'u-1', userName: 'admin', name: 'Admin', roles: [] },
      token: 'expired-token',
      isAuthenticated: true,
    });

    vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiError(401, 'Unauthorized'));
    const logoutSpy = vi.spyOn(authStore, 'logout');

    const ok = await authStore.checkAuth();

    expect(ok).toBe(false);
    expect(logoutSpy).toHaveBeenCalledWith(true);
    expect(authStore.getState().isAuthenticated).toBe(false);
  });

  it('login() passes skipUnauthorizedEvent: true so bad password does not broadcast logout', async () => {
    const reqSpy = vi.spyOn(apiClient, 'request').mockRejectedValue(new ApiError(401, 'Unauthorized'));

    await expect(authStore.login('admin', 'wrong')).rejects.toThrow(ApiError);

    expect(reqSpy).toHaveBeenCalledWith(
      '/App/user',
      expect.objectContaining({ skipUnauthorizedEvent: true })
    );
  });
});
