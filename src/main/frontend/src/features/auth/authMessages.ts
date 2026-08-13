import { ApiError } from '@/api/ApiError';
import { messageFor } from '@/api/messages';
import { strings } from '@/strings';

/**
 * Sign-in has its own error mapping, because the global one is wrong here in two places.
 *
 * A 401 elsewhere means the session expired; on this form it means the password was wrong, and
 * telling someone their session expired while they are signing in is nonsense. A 429 elsewhere
 * is unusual; here it is the lockout, and it must not read like another failed attempt — the fix
 * for one is to retype, and retyping is what causes the other.
 */
export interface AuthFailure {
  message: string;
  /** True when the practitioner has to wait rather than try again. Changes the styling and
   *  disables the submit button, so the form stops inviting the action that made it worse. */
  waiting: boolean;
}

export function authFailureFor(error: unknown): AuthFailure {
  if (error instanceof ApiError) {
    if (error.isRateLimited) {
      // The server's own text is English; the practitioner's interface is not.
      return { message: strings.auth.rateLimited, waiting: true };
    }
    if (error.isUnauthenticated) {
      // Deliberately does not distinguish unknown address from wrong password. The server does
      // not either — saying which would let someone enumerate accounts.
      return { message: strings.auth.invalidCredentials, waiting: false };
    }
  }

  return { message: messageFor(error), waiting: false };
}
