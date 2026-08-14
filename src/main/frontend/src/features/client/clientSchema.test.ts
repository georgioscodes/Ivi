import { describe, expect, it } from 'vitest';

import { clientSchema, toRequest } from './clientSchema';

/**
 * The rules here are mirrored from the Java record, so these tests are also the place the
 * duplication is visible. If a limit changes server-side and nobody changes it here, the form
 * accepts something the server will reject — and the practitioner sees an English message.
 */
describe('clientSchema', () => {
  const valid = { fullName: 'Ελένη Παπαδοπούλου' };

  it('should require a name, since it is the only thing a client record cannot do without', () => {
    // Given / When
    const result = clientSchema.safeParse({ fullName: '   ' });

    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Το ονοματεπώνυμο είναι υποχρεωτικό');
  });

  it('should accept a client with nothing but a name', () => {
    // Given — someone seen once for a consultation may have given no contact details at all
    expect(clientSchema.safeParse(valid).success).toBe(true);
  });

  it('should treat an empty optional field as absent rather than as invalid', () => {
    // Given — an untouched input is "" in the DOM, and "" is not a valid email address
    const result = clientSchema.safeParse({ ...valid, email: '', dateOfBirth: '', phone: '' });

    // Then — rejecting these would make every optional field effectively required
    expect(result.success).toBe(true);
  });

  it('should reject a birth date in the future', () => {
    // Given — mirrors @Past on the Java record
    const result = clientSchema.safeParse({ ...valid, dateOfBirth: '2099-01-01' });

    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Η ημερομηνία πρέπει να είναι στο παρελθόν');
  });

  it('should hold the lengths the server holds', () => {
    // Given — 160, 254, 40 and 500, from ClientCreateRequest
    expect(clientSchema.safeParse({ fullName: 'α'.repeat(161) }).success).toBe(false);
    expect(clientSchema.safeParse({ fullName: 'α'.repeat(160) }).success).toBe(true);
    expect(clientSchema.safeParse({ ...valid, phone: '1'.repeat(41) }).success).toBe(false);
    expect(clientSchema.safeParse({ ...valid, goal: 'α'.repeat(501) }).success).toBe(false);
  });

  it('should give messages in Greek, because the server gives them in English', () => {
    // Given — the reason this schema exists at all
    const result = clientSchema.safeParse({ fullName: '', email: 'nope' });

    // Then
    for (const issue of result.error?.issues ?? []) {
      expect(issue.message).toMatch(/[Ͱ-Ͽ]/);
    }
  });
});

describe('toRequest', () => {
  it('should omit blank optional fields rather than sending empty strings', () => {
    // Given — the difference is visible in the record: "" overwrites a stored value with empty,
    // where omitting the key leaves it alone
    const body = toRequest({
      fullName: 'Ελένη',
      email: '',
      phone: '   ',
      dateOfBirth: '',
      goal: '',
      notes: '',
    });

    // Then
    expect(body).toEqual({
      fullName: 'Ελένη',
      email: undefined,
      phone: undefined,
      dateOfBirth: undefined,
      goal: undefined,
      notes: undefined,
    });
  });

  it('should trim what it keeps', () => {
    // Given — a trailing space in a name is invisible on screen and breaks an exact-match search
    const body = toRequest({ fullName: '  Ελένη Παπαδοπούλου  ', email: ' eleni@example.gr ' });

    // Then
    expect(body.fullName).toBe('Ελένη Παπαδοπούλου');
    expect(body.email).toBe('eleni@example.gr');
  });

  it('should keep a value that is only meaningful as written', () => {
    // Given — notes carry their own line breaks, and collapsing them would rewrite the record
    const notes = 'Πρώτη συνεδρία.\nΑναφέρει δυσκολία με το πρωινό.';

    // When / Then
    expect(toRequest({ fullName: 'Ελένη', notes }).notes).toBe(notes);
  });
});
