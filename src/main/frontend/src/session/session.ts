import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/ApiError';
import { auth, practitioner } from '@/api/endpoints';
import { onSessionExpired } from '@/api/http';
import { sessionKeys } from '@/api/keys';
import type { LoginRequest, PractitionerRegisterRequest, PractitionerResponse } from '@/api/types';

/**
 * Who is signed in, according to the server.
 *
 * There is no client-side notion of being logged in. The session lives in Postgres and is
 * revocable, so the only honest answer comes from asking. A 401 is not an error here — it is the
 * answer "nobody", and it is what a first visit looks like.
 */
export function useSession() {
  const query = useQuery<PractitionerResponse | null>({
    queryKey: sessionKeys.current,
    queryFn: async () => {
      try {
        return await practitioner.me();
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthenticated) {
          return null;
        }
        throw error;
      }
    },
    // Asked once per load and then kept until something changes it. Sign-in, sign-out and an
    // expiry all write to this key directly, so re-fetching on an interval would add requests
    // without adding information.
    staleTime: Infinity,
    retry: false,
  });

  return {
    practitioner: query.data ?? null,
    isSignedIn: query.data != null,
    // Only the first resolution is a loading state. A refetch keeps the current answer on screen
    // rather than flashing the login form at someone who is signed in.
    isLoading: query.isPending,
    error: query.error,
  };
}

/**
 * Clears the cached session when the server says it is gone, from anywhere in the app.
 *
 * Mount once, near the root. Without it, an expiry discovered by a background request leaves the
 * UI rendering a signed-in shell whose every panel is failing — which looks like the application
 * is broken rather than like a session that timed out.
 */
export function useSessionExpiryHandler(): void {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.setQueryData(sessionKeys.current, null);
        // Everything else in the cache belongs to a practitioner who is no longer signed in.
        // Removing rather than invalidating means none of it can be shown again, even briefly,
        // if a different practitioner signs in on the same machine.
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      }),
    [queryClient],
  );
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => auth.login(credentials),
    onSuccess: (signedIn) => {
      // The response is the practitioner, so the session is known without another round trip.
      queryClient.setQueryData(sessionKeys.current, signedIn);
    },
  });
}

/**
 * Registers, then signs in with the credentials just chosen.
 *
 * `POST /practitioner/registration` creates the account and returns it, but establishes no
 * session — so writing its response into the session cache would render a signed-in shell whose
 * every subsequent request 401s. The second call is what actually signs the practitioner in.
 *
 * It is done here rather than asking them to type a password they chose ten seconds ago.
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (details: PractitionerRegisterRequest) => {
      await practitioner.register(details);
      try {
        return await auth.login({ email: details.email, password: details.password });
      } catch (cause) {
        // The account exists at this point. Saying "registration failed" would send them back to
        // create it again, which fails on the duplicate email and looks like the account is
        // both missing and taken.
        throw new ApiError(
          cause instanceof ApiError ? cause.status : 0,
          'Ο λογαριασμός δημιουργήθηκε, αλλά η σύνδεση απέτυχε. Δοκιμάστε να συνδεθείτε.',
        );
      }
    },
    onSuccess: (signedIn) => {
      queryClient.setQueryData(sessionKeys.current, signedIn);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auth.logout(),
    // Runs whether or not the request succeeded. If the server could not be reached, the local
    // cache still holds one practitioner's client records, and leaving them readable because a
    // network call failed is the wrong way round.
    onSettled: () => {
      queryClient.setQueryData(sessionKeys.current, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
    },
  });
}
