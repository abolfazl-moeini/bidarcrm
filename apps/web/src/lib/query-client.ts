/**
 * BidarCRM - TanStack Query Client Configuration
 *
 * Configured with resilient defaults for CRM operations:
 * - 2-minute stale time for optimal caching with manual invalidations
 * - Disables retry on 401/403/404 client errors
 * - Enables automatic retries on temporary server or network glitches
 */

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            // Do not retry authorization or not found errors
            if ([401, 403, 404].includes(error.status)) {
              return false;
            }
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
export default queryClient;
