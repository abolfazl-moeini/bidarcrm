/**
 * BidarCRM - useAuth Hook
 *
 * Provides reactive access to authStore state and methods using React standard useSyncExternalStore.
 */

import { useSyncExternalStore } from 'react';
import { authStore, AuthState } from '../authStore';
import { EspoUser } from '../../../types/espocrm';

export interface UseAuthReturn extends AuthState {
  user: EspoUser | null;
  login: (username: string, password: string) => Promise<{ user: EspoUser; token: string }>;
  logout: (fromUnauthorized?: boolean) => Promise<void>;
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
