import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ageFromDateOfBirth,
  basisLabel,
  formatFactor,
  formatGrams,
  formatKcal,
  formatSignedKcal,
} from './nutritionLabels';

describe('basisLabel', () => {
  it('should explain each basis in Greek', () => {
    // Given — the server sends codes, which is right for it to send and wrong to display.
    // This is the same defect that put "OVERWEIGHT" on a Greek measurements screen.
    expect(basisLabel('MIFFLIN_ST_JEOR')).toBe('Εξίσωση Mifflin-St Jeor');
    expect(basisLabel('MANUAL')).toBe('Βασικός μεταβολισμός που δηλώθηκε');
    expect(basisLabel('DIRECT')).toBe('Ενεργειακός στόχος που δηλώθηκε');
  });

  it('should keep equation names in Latin script, because that is what they are called', () => {
    // Given — a dietitian looking for Harris-Benedict is looking for "Harris-Benedict".
    // Only the descriptive part around it is translated.
    expect(basisLabel('HARRIS_BENEDICT_REVISED')).toContain('Harris-Benedict');
  });

  it('should show nothing for a basis it does not recognise', () => {
    // Given — a new equation added server-side against an older build
    expect(basisLabel('KATCH_MCARDLE')).toBeNull();
    expect(basisLabel(null)).toBeNull();
  });
});

describe('formatSignedKcal', () => {
  it('should make a deficit unmistakable from a surplus', () => {
    // Given — the sign is the entire prescription. A true minus, not a hyphen.
    expect(formatSignedKcal(-590)).toBe('−590');
    expect(formatSignedKcal(590)).toBe('+590');
    expect(formatSignedKcal(-590)).not.toContain('-');
  });

  it('should say no adjustment rather than showing a bare zero', () => {
    expect(formatSignedKcal(0)).toBe('±0');
  });
});

describe('formatKcal and formatGrams', () => {
  it('should group thousands the Greek way', () => {
    // Given — el-GR uses a full stop for thousands, which is the opposite of the decimal comma
    expect(formatKcal(2010)).toBe('2.010');
  });

  it('should show grams to one place, as the server rounds them', () => {
    expect(formatGrams(107.5)).toBe('107,5');
    expect(formatGrams(43)).toBe('43,0');
  });

  it('should show a dash rather than zero for a missing figure', () => {
    expect(formatKcal(null)).toBe('—');
    expect(formatGrams(undefined)).toBe('—');
  });
});

describe('ageFromDateOfBirth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not count a birthday that has not happened yet this year', () => {
    // Given — the off-by-one that makes a calculator disagree with the client sitting there
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
    expect(ageFromDateOfBirth('1984-03-11')).toBe(41);

    vi.setSystemTime(new Date('2026-03-11T12:00:00Z'));
    expect(ageFromDateOfBirth('1984-03-11')).toBe(42);
  });

  it('should return nothing rather than a number the server would reject', () => {
    // Given — the equations accept 1 to 120. A prefill outside that range would put the form
    // into a state the practitioner did not choose and cannot see the cause of.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'));

    expect(ageFromDateOfBirth('2026-08-01')).toBeNull();
    expect(ageFromDateOfBirth('1850-01-01')).toBeNull();
    expect(ageFromDateOfBirth(null)).toBeNull();
    expect(ageFromDateOfBirth('not a date')).toBeNull();
  });
});

describe('formatFactor', () => {
  it('should use the Greek decimal comma, not a full stop', () => {
    // Given — el-GR reads a full stop as the thousands separator, so an interpolated 1.375
    // says "one thousand three hundred and seventy-five" to whoever reads it aloud
    expect(formatFactor(1.375)).toBe('1,375');
    expect(formatFactor(1.2)).toBe('1,2');
  });
});
