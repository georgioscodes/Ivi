import type { ErrorResponse } from './types';

/**
 * Every failed request becomes one of these, whatever went wrong.
 *
 * A network failure and a 500 are different facts, but at the call site they are usually the same
 * decision, and code that has to handle `Response | TypeError | SyntaxError` separately tends to
 * handle two of the three and forget the last.
 */
export class ApiError extends Error {
  /** 0 when the request never reached the server. */
  readonly status: number;
  /** Field name to message, from bean validation. Empty when the failure is not field-specific. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** The session expired or was revoked. Sessions are server-side, so this can happen mid-use. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /**
   * Someone else changed the record first. The plan builder is the place this shows up: two tabs,
   * or a practitioner and a colleague, editing the same plan.
   */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** Sign-in rate limit. Distinct from wrong credentials, and has to read differently. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Bean validation rejected the body. `fieldErrors` says which fields. */
  get isValidationFailure(): boolean {
    return this.status === 400 && Object.keys(this.fieldErrors).length > 0;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /**
   * True for a server fault or a request that never arrived — the cases where retrying is
   * reasonable and the message on screen should not blame the practitioner.
   */
  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  /**
   * Builds from a failed response, tolerating a body that is not the shape we expect. An error
   * handler that throws while handling an error costs the original failure, which is the one
   * piece of information worth keeping.
   */
  static async fromResponse(response: Response): Promise<ApiError> {
    let body: Partial<ErrorResponse> | null = null;
    try {
      const text = await response.text();
      body = text ? (JSON.parse(text) as Partial<ErrorResponse>) : null;
    } catch {
      body = null;
    }

    return new ApiError(
      response.status,
      typeof body?.message === 'string' && body.message ? body.message : response.statusText,
      typeof body?.errors === 'object' && body.errors !== null ? body.errors : {},
    );
  }
}
