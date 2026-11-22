/**
 * BidarCRM - useAuth Hook
 *
 * Provides reactive access to authStore state and methods using React standard useSyncExternalStore.
 */

import { useSyncExternalStore } from 'react';
import { authStore, AuthState } from '../authStore';

export interface UseAuthReturn extends AuthState {
  login: (username: string, password: string) => Promise<{ user: any; token: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const state = useSyncExternalStore(
    authStore.subscribe,
    authStore.getState,
    authStore.getState
  );

  return {
    ...state,
    login: authStore.login,
    logout: authStore.logout,
    checkAuth: authStore.checkAuth,
  };
}

export default useAuth;
