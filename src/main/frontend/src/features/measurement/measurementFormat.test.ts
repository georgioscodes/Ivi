import { describe, expect, it } from 'vitest';

import {
  bmiCategoryLabel,
  formatChange,
  formatValue,
  formatWithUnit,
  orderForDisplay,
} from './measurementFormat';

describe('formatValue', () => {
  it('should use the Greek decimal separator', () => {
    // Given — a comma, not a full stop. toFixed would put a full stop in front of a Greek reader.
    expect(formatValue(78.3, 1)).toBe('78,3');
  });

  it('should show exactly the precision the measurement type declares', () => {
    // Given — decimals is the type's precision, not a display preference. Visceral fat is a
    // level with no decimals; bone mass is recorded to two.
    expect(formatValue(12, 0)).toBe('12');
    expect(formatValue(2.4, 2)).toBe('2,40');
    expect(formatValue(78.25, 1)).toBe('78,3');
  });

  it('should show a dash for a missing value rather than zero', () => {
    // Given — a measurement that was not taken is not a measurement of zero
    expect(formatValue(null, 1)).toBe('—');
    expect(formatValue(undefined, 1)).toBe('—');
    expect(formatValue(0, 1)).toBe('0,0');
  });
});

describe('formatChange', () => {
  it('should make the sign impossible to miss', () => {
    // Given — losing 2.4 kg and gaining 2.4 kg are opposite outcomes, and a hyphen is one narrow
    // glyph in a column of numbers. This uses a true minus.
    expect(formatChange(-2.4, 1)).toBe('−2,4');
    expect(formatChange(2.4, 1)).toBe('+2,4');
  });

  it('should mark no change as no change, not as an increase', () => {
    expect(formatChange(0, 1)).toBe('±0,0');
  });

  it('should show a dash for the first reading, which has nothing to change from', () => {
    expect(formatChange(null, 1)).toBe('—');
  });

  it('should not use a hyphen, which is narrow enough to be missed', () => {
    // Given — the specific failure being avoided
    expect(formatChange(-5.9, 1)).not.toContain('-');
    expect(formatChange(-5.9, 1)).toContain('−');
  });
});

describe('formatWithUnit', () => {
  it('should attach the unit, and drop it when there is no value', () => {
    expect(formatWithUnit(84.2, 'kg', 1)).toBe('84,2 kg');
    expect(formatWithUnit(null, 'kg', 1)).toBe('—');
  });
});

describe('bmiCategoryLabel', () => {
  it('should translate every band the server can return', () => {
    // Given — the server sends stable codes, which is right; showing them is not
    expect(bmiCategoryLabel('UNDERWEIGHT')).toBe('Ελλιποβαρής');
    expect(bmiCategoryLabel('NORMAL')).toBe('Φυσιολογικό βάρος');
    expect(bmiCategoryLabel('OVERWEIGHT')).toBe('Υπέρβαρη/ος');
    expect(bmiCategoryLabel('OBESE')).toBe('Παχυσαρκία');
  });

  it('should show nothing for a band it does not know, rather than the raw code', () => {
    // Given — a practitioner reading "SEVERELY_OBESE" off a Greek screen, with the client
    // sitting beside them, is worse than a blank
    expect(bmiCategoryLabel('SEVERELY_OBESE')).toBeNull();
    expect(bmiCategoryLabel(null)).toBeNull();
  });
});

describe('orderForDisplay', () => {
  const types = [
    { code: 'WEIGHT' },
    { code: 'HEIGHT' },
    { code: 'BODY_FAT_PCT' },
    { code: 'WAIST' },
  ] as never;

  it('should keep dates newest first', () => {
    // Given — the server's own ordering, which must survive the secondary sort
    const rows = [
      { recordedOn: '2026-05-04', typeCode: 'WEIGHT' },
      { recordedOn: '2026-08-10', typeCode: 'WEIGHT' },
      { recordedOn: '2026-07-20', typeCode: 'WEIGHT' },
    ];

    // When / Then
    expect(orderForDisplay(rows, types).map((r) => r.recordedOn)).toEqual([
      '2026-08-10',
      '2026-07-20',
      '2026-05-04',
    ]);
  });

  it('should read the same way down every visit', () => {
    // Given — the server sorts by date and nothing else, so one visit comes back weight-first
    // and the next height-first. Comparing a measurement across visits by eye then fails.
    const rows = [
      { recordedOn: '2026-08-10', typeCode: 'WAIST' },
      { recordedOn: '2026-08-10', typeCode: 'WEIGHT' },
      { recordedOn: '2026-07-20', typeCode: 'HEIGHT' },
      { recordedOn: '2026-07-20', typeCode: 'WEIGHT' },
      { recordedOn: '2026-08-10', typeCode: 'HEIGHT' },
    ];

    // When
    const ordered = orderForDisplay(rows, types);

    // Then — within each date, the order the types endpoint returns
    expect(ordered.map((r) => `${r.recordedOn}:${r.typeCode}`)).toEqual([
      '2026-08-10:WEIGHT',
      '2026-08-10:HEIGHT',
      '2026-08-10:WAIST',
      '2026-07-20:WEIGHT',
      '2026-07-20:HEIGHT',
    ]);
  });

  it('should not lose rows of a type it does not recognise', () => {
    // Given — a withdrawn type with historical readings still attached
    const rows = [
      { recordedOn: '2026-08-10', typeCode: 'RETIRED_TYPE' },
      { recordedOn: '2026-08-10', typeCode: 'WEIGHT' },
    ];

    // When / Then — dropping a measurement from a health record to tidy a sort is not an option
    expect(orderForDisplay(rows, types)).toHaveLength(2);
  });

  it('should not mutate what it is given', () => {
    // Given — the array is TanStack's cached data, which must not be reordered in place
    const rows = [
      { recordedOn: '2026-05-04', typeCode: 'WEIGHT' },
      { recordedOn: '2026-08-10', typeCode: 'WEIGHT' },
    ];
    const snapshot = [...rows];

    // When
    orderForDisplay(rows, types);

    // Then
    expect(rows).toEqual(snapshot);
  });
});
