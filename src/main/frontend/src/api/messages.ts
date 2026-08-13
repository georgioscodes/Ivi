import { ApiError } from './ApiError';
import { strings } from '@/strings';

/**
 * Turns a thrown error into a sentence a practitioner can act on.
 *
 * The server's own message is preferred wherever it exists — it is written for this application,
 * it is in Greek, and it knows things the client does not, such as which target a value exceeded.
 * The fallbacks below cover the cases where the server has nothing specific to say, or where the
 * failure never reached it.
 */
export function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return strings.errors.unexpected;
  }

  if (error.status === 0) {
    return strings.errors.network;
  }
  if (error.isRateLimited) {
    return error.message || strings.auth.rateLimited;
  }
  if (error.isConflict) {
    return error.message || strings.errors.conflict;
  }
  if (error.isValidationFailure) {
    return strings.errors.validation;
  }
  if (error.isUnauthenticated) {
    return strings.auth.sessionExpired;
  }
  if (error.isNotFound) {
    return error.message || strings.errors.notFound;
  }
  // A 500's message is written for whoever reads the logs, and can carry detail that should not
  // be on a practitioner's screen. This is the one case where the server's text is discarded.
  if (error.status >= 500) {
    return strings.errors.server;
  }

  return error.message || strings.errors.unexpected;
}

/**
 * Field-level messages for a form, keyed by field name.
 *
 * React Hook Form's `setError` takes exactly this shape, so a rejected submission marks the
 * offending inputs rather than printing one sentence above the form and leaving the practitioner
 * to work out which of eleven fields it meant.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors : {};
}
