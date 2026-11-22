/**
 * BidarCRM - Authentication & Session Store
 *
 * Manages user authentication state, token persistence, and automatic
 * rehydration with EspoCRM 10.1.4 API client integration.
 */

import { EspoUser } from '../../types/espocrm';
import { apiClient, API_UNAUTHORIZED_EVENT } from '../../lib/api-client';

export interface AuthState {
  user: EspoUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type Listener = () => void;

const AUTH_STORAGE_KEY = 'bidar_auth';

interface StoredAuth {
  user: EspoUser;
  token: string;
  username: string;
}

function loadStoredAuth(): { user: EspoUser | null; token: string | null; username: string | null } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { user: null, token: null, username: null };
  }

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { user: null, token: null, username: null };
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed && parsed.token && parsed.user) {
      return { user: parsed.user, token: parsed.token, username: parsed.username || parsed.user.userName };
    }
  } catch (err) {
    console.warn('Failed to parse stored auth session:', err);
  }

  return { user: null, token: null, username: null };
}

function saveStoredAuth(user: EspoUser, token: string, username: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token, username }));
  } catch (err) {
    console.warn('Failed to persist auth session to storage:', err);
  }
}

function clearStoredAuth(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear stored auth session:', err);
  }
}

export class AuthStore {
  private state: AuthState;
  private listeners = new Set<Listener>();

  constructor() {
    const initial = loadStoredAuth();

    if (initial.token && initial.username) {
      apiClient.setAuth(initial.username, initial.token);
    }

    this.state = {
      user: initial.user,
      token: initial.token,
      isAuthenticated: Boolean(initial.token && initial.user),
      isLoading: false,
      error: null,
    };

    // Auto-logout on intercepted 401 Unauthorized
    if (typeof window !== 'undefined') {
      window.addEventListener(API_UNAUTHORIZED_EVENT, () => {
        this.logout();
      });
    }
  }

  public getState = (): AuthState => {
    return this.state;
  };

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(partial: Partial<AuthState> | ((prev: AuthState) => Partial<AuthState>)): void {
    const next = typeof partial === 'function' ? partial(this.state) : partial;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in authStore listener:', err);
      }
    });
  }

  /**
   * Performs authentication handshake with EspoCRM.
   */
  public login = async (username: string, password: string): Promise<{ user: EspoUser; token: string }> => {
    this.setState({ isLoading: true, error: null });

    try {
      const basicAuth = btoa(`${username}:${password}`);
      const response = await apiClient.request<{ user: EspoUser; token: string }>('/App/user', {
        method: 'GET',
        headers: {
          'Espo-Authorization': basicAuth,
          'Espo-Authorization-Create-Token-Secret': 'true',
        },
      });

      const user = response.user;
      const token = response.token;

      if (!token || !user) {
        throw new Error('Invalid authentication response from server.');
      }

      apiClient.setAuth(username, token);
      saveStoredAuth(user, token, username);

      this.setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { user, token };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
      this.setState({
        isLoading: false,
        error: errorMsg,
      });
      throw err;
    }
  };

  /**
   * Destroys current session and cleans up credentials.
   */
  public logout = async (): Promise<void> => {
    const currentToken = this.state.token;

    if (currentToken) {
      try {
        await apiClient.post('/App/destroyAuthToken', { token: currentToken });
      } catch {
        // Ignore failure during token invalidation
      }
    }

    apiClient.clearAuth();
    clearStoredAuth();

    this.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  /**
   * Verifies existing session validity with the backend.
   */
  public checkAuth = async (): Promise<boolean> => {
    if (!this.state.token) {
      return false;
    }

    try {
      const response = await apiClient.get<{ user: EspoUser }>('/App/user');
      if (response && response.user) {
        this.setState({ user: response.user, isAuthenticated: true });
        return true;
      }
      return false;
    } catch {
      await this.logout();
      return false;
    }
  };
}

export const authStore = new AuthStore();
export default authStore;
