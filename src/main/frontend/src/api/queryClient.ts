import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './ApiError';

/**
 * Defaults chosen for an application where the server owns every value on screen.
 *
 * The important one is `staleTime: 0`. Caching a nutrient total for even thirty seconds
 * reintroduces the failure the whole architecture avoids: a number on screen that disagrees with
 * the server. The cache here is for deduplication and for keeping the previous render visible
 * during a refetch, not for avoiding round trips.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        // Refetching on every window focus would make a plan flicker each time a practitioner
        // switched to their notes and back. Reconnect is different: after the network drops,
        // what is on screen genuinely may be out of date.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: shouldRetry,
      },
      mutations: {
        // A mutation is never retried automatically. Most are not idempotent — adding a food to
        // a meal twice is a silent data error, and the practitioner sees a plan they did not
        // build. Retrying is the caller's decision, made once, with the edit still in hand.
        retry: false,
      },
    },
  });
}

/**
 * Retry a server fault or a request that never arrived; never retry a rejection. A 400, 403, 404
 * or 409 will say exactly the same thing the second time, and retrying a 401 delays the sign-in
 * prompt for no benefit.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  return error instanceof ApiError && error.isTransient && failureCount < 2;
}
