import { describe, expect, it } from 'vitest';

import { foodSchema, toRequest } from './foodSchema';

const valid = {
  nameEl: 'Γραβιέρα',
  category: 'PROTEIN' as const,
  energyKcal: 390,
  proteinG: 27,
  carbohydrateG: 1.5,
  fatG: 31,
  portions: [],
};

describe('foodSchema', () => {
  it('should require a Greek name and a category', () => {
    expect(foodSchema.safeParse({ ...valid, nameEl: '  ' }).success).toBe(false);
    expect(foodSchema.safeParse({ ...valid, category: 'BEVERAGE' }).success).toBe(false);
  });

  it('should reject a negative nutrient but allow zero', () => {
    // Given — plenty of foods are genuinely zero for a macro; none is negative
    expect(foodSchema.safeParse({ ...valid, fatG: -1 }).success).toBe(false);
    expect(foodSchema.safeParse({ ...valid, fatG: 0 }).success).toBe(true);
  });

  it('should allow at most one default portion', () => {
    // Given — two defaults leave the plan builder picking arbitrarily between them. The server
    // has no rule for this, so it is enforced here.
    const twoDefaults = {
      ...valid,
      portions: [
        { label: 'φέτα', grams: 30, isDefault: true },
        { label: 'μερίδα', grams: 60, isDefault: true },
      ],
    };
    expect(foodSchema.safeParse(twoDefaults).success).toBe(false);

    const oneDefault = {
      ...valid,
      portions: [
        { label: 'φέτα', grams: 30, isDefault: true },
        { label: 'μερίδα', grams: 60, isDefault: false },
      ],
    };
    expect(foodSchema.safeParse(oneDefault).success).toBe(true);
  });

  it('should require a portion to weigh something', () => {
    const zeroGrams = { ...valid, portions: [{ label: 'φέτα', grams: 0, isDefault: true }] };
    expect(foodSchema.safeParse(zeroGrams).success).toBe(false);
  });
});

describe('toRequest', () => {
  it('should omit portions entirely when there are none', () => {
    // Given — this is load-bearing for overrides. The server copies the catalogue food's
    // portions only when none are supplied, so sending [] would silently cost the practitioner
    // their units as the price of correcting a calorie figure.
    expect(toRequest(valid).portions).toBeUndefined();
  });

  it('should send portions when there are some', () => {
    const body = toRequest({
      ...valid,
      portions: [{ label: 'φέτα', grams: 30, isDefault: true }],
    });
    expect(body.portions).toHaveLength(1);
  });

  it('should drop a blank English name rather than sending an empty string', () => {
    expect(toRequest({ ...valid, nameEn: '   ' }).nameEn).toBeUndefined();
  });
});
