import { describe, expect, it } from 'vitest';

import type { FoodResponse } from '@/api/types';
import { badgeFor, categoryLabel, sourceLabel, suggestionStatusLabel } from './foodLabels';

function food(overrides: Partial<FoodResponse>): FoodResponse {
  return {
    id: 1,
    nameEl: 'Γραβιέρα',
    nameEn: 'Graviera',
    category: 'PROTEIN',
    energyKcal: 390,
    proteinG: 27,
    carbohydrateG: 1.5,
    fatG: 31,
    source: 'DEMO_SEED',
    portions: [],
    global: true,
    overridden: false,
    overridesFoodId: null,
    ...overrides,
  };
}

describe('badgeFor', () => {
  it('should mark a food carrying the practitioner own values under a catalogue name', () => {
    // Given — the case where silence misleads: they are about to put these numbers in a plan,
    // and the name is the catalogue's
    const badge = badgeFor(food({ global: false, overridden: true, overridesFoodId: 26 }));

    // Then
    expect(badge).toEqual({ label: 'Τροποποιημένο', kind: 'override' });
  });

  it('should mark a food the practitioner created', () => {
    expect(badgeFor(food({ global: false, overridden: false }))).toEqual({
      label: 'Δικό σας',
      kind: 'own',
    });
  });

  it('should leave an untouched catalogue food unmarked', () => {
    // Given — the default case, which is most rows. Badging it would make the badge meaningless.
    expect(badgeFor(food({ global: true, overridden: false }))).toBeNull();
  });
});

describe('categoryLabel', () => {
  it('should name all five categories in Greek', () => {
    expect(categoryLabel('FRESH')).toBe('Φρέσκα τρόφιμα');
    expect(categoryLabel('CARBOHYDRATE')).toBe('Υδατάνθρακες');
    expect(categoryLabel('PROTEIN')).toBe('Πρωτεΐνες');
    expect(categoryLabel('FAT')).toBe('Λίπη');
    expect(categoryLabel('COMPOSITE')).toBe('Σύνθετα');
  });

  it('should show a dash rather than an unknown code', () => {
    expect(categoryLabel('BEVERAGE')).toBe('—');
    expect(categoryLabel(null)).toBe('—');
  });
});

describe('sourceLabel', () => {
  it('should say plainly that catalogue figures are placeholder data', () => {
    // Given — these are not a licensed reference database yet, and a practitioner deciding
    // whether to trust a figure deserves to know which they are looking at
    expect(sourceLabel('DEMO_SEED')).toBe('Δοκιμαστικά δεδομένα');
  });

  it('should attribute a practitioner entry to them', () => {
    expect(sourceLabel('PRACTITIONER')).toBe('Καταχωρήθηκε από εσάς');
  });

  it('should show nothing for a source it does not know', () => {
    expect(sourceLabel('USDA_SR28')).toBeNull();
  });
});

describe('suggestionStatusLabel', () => {
  it('should translate every status the server can return', () => {
    expect(suggestionStatusLabel('PENDING')).toBe('Σε αναμονή');
    expect(suggestionStatusLabel('ACCEPTED')).toBe('Έγινε δεκτή');
    expect(suggestionStatusLabel('REJECTED')).toBe('Απορρίφθηκε');
  });
});
