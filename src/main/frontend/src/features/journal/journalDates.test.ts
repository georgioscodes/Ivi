// Athens, because that is where this runs and because the bug only appears east of Greenwich.
// Set before any Date is constructed in this file.
process.env.TZ = 'Europe/Athens';

import { describe, expect, it } from 'vitest';

import { formatEntryDate, today, weekdayOf } from './journalDates';

describe('today', () => {
  it('should give the local date, not the UTC one', () => {
    // Given — 01:30 on 15 August in Athens, which is still 22:30 on the 14th in UTC. The obvious
    // implementation, `toISOString().slice(0, 10)`, defaults a consultation written up late at
    // night to *yesterday* — on a field the practitioner had no reason to check.
    const lateNightInAthens = new Date('2026-08-14T22:30:00Z');

    expect(today(lateNightInAthens)).toBe('2026-08-15');
    // The implementation this replaces, spelled out, so the test says what it is guarding against.
    expect(lateNightInAthens.toISOString().slice(0, 10)).toBe('2026-08-14');
  });

  it('should format as YYYY-MM-DD with padding', () => {
    // Given — a date input accepts nothing else, and "2026-8-3" is silently rejected
    expect(today(new Date(2026, 7, 3, 12))).toBe('2026-08-03');
    expect(today(new Date(2026, 11, 25, 12))).toBe('2026-12-25');
  });

  it('should agree with the local calendar at either end of the day', () => {
    // Given — the two moments most likely to fall on the wrong side of a UTC conversion
    expect(today(new Date(2026, 7, 14, 0, 5))).toBe('2026-08-14');
    expect(today(new Date(2026, 7, 14, 23, 55))).toBe('2026-08-14');
  });
});

describe('formatEntryDate', () => {
  it('should read as a Greek date', () => {
    expect(formatEntryDate('2026-08-03')).toBe('3 Αυγούστου 2026');
  });

  it('should not shift the day when parsing', () => {
    // Given — `new Date('2026-08-01')` is UTC midnight, which renders as 31 July anywhere west of
    // Greenwich. Parsing the parts keeps the date the practitioner typed.
    expect(formatEntryDate('2026-08-01')).toContain('1 Αυγούστου');
    expect(formatEntryDate('2026-01-01')).toContain('1 Ιανουαρίου');
  });

  it('should show something rather than crash on a value it cannot parse', () => {
    expect(formatEntryDate('')).toBe('');
  });
});

describe('weekdayOf', () => {
  it('should name the day a consultation happened', () => {
    // Given — a practitioner remembers a session as "that Tuesday" long after forgetting the date
    expect(weekdayOf('2026-08-11')).toBe('Τρίτη');
  });
});
