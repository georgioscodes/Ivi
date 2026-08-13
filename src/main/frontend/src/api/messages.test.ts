import { describe, expect, it } from 'vitest';

import { ApiError } from './ApiError';
import { fieldErrorsFrom, messageFor } from './messages';
import { strings } from '@/strings';

describe('messageFor', () => {
  it('should prefer the server sentence, because it knows what the client does not', () => {
    // Given — a 409 from the plan builder, where the server can name what changed
    const error = new ApiError(409, 'Το πλάνο τροποποιήθηκε από άλλη συνεδρία.');

    // When / Then
    expect(messageFor(error)).toBe('Το πλάνο τροποποιήθηκε από άλλη συνεδρία.');
  });

  it('should discard a 5xx message, because it is written for the log and not the screen', () => {
    // Given — the kind of text that leaks a table name or a stack frame
    const error = new ApiError(500, 'could not execute statement [ERROR: relation "plan_item"...]');

    // When / Then
    expect(messageFor(error)).toBe(strings.errors.server);
  });

  it('should say the network failed, not that the server refused', () => {
    // Given — status 0: the request never arrived
    expect(messageFor(new ApiError(0, 'Network request failed'))).toBe(strings.errors.network);
  });

  it('should distinguish a lockout from a wrong password', () => {
    // Given — a practitioner who retypes a password five times needs to know waiting is the fix
    expect(messageFor(new ApiError(429, ''))).toBe(strings.auth.rateLimited);
  });

  it('should point at the fields, when validation is what failed', () => {
    // Given
    const error = new ApiError(400, 'Validation failed', { email: 'Must be a valid email address' });

    // When / Then — the per-field messages go on the inputs; this is the summary above them
    expect(messageFor(error)).toBe(strings.errors.validation);
  });

  it('should explain an expired session rather than showing a bare 401', () => {
    expect(messageFor(new ApiError(401, 'Authentication required'))).toBe(
      strings.auth.sessionExpired,
    );
  });

  it('should cope with something that is not an ApiError at all', () => {
    // Given — a bug in a component, not a failed request
    expect(messageFor(new TypeError('x is not a function'))).toBe(strings.errors.unexpected);
    expect(messageFor(undefined)).toBe(strings.errors.unexpected);
  });

  it('should never return an empty string, whatever it was handed', () => {
    // Given — an empty message renders as an alert box with nothing in it, which is worse than
    // a generic sentence
    for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 503]) {
      expect(messageFor(new ApiError(status, ''))).not.toBe('');
    }
  });
});

describe('fieldErrorsFrom', () => {
  it('should return the map a form needs, and an empty one for anything else', () => {
    // Given
    const validation = new ApiError(400, 'Validation failed', { fullName: 'Full name is required' });

    // When / Then
    expect(fieldErrorsFrom(validation)).toEqual({ fullName: 'Full name is required' });
    expect(fieldErrorsFrom(new Error('boom'))).toEqual({});
  });
});
