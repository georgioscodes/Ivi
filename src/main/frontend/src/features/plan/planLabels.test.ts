import { describe, expect, it } from 'vitest';

import {
  MEAL_LABELS,
  dayLabel,
  formatKcal,
  formatQuantity,
  mealLabel,
  nextStatusAction,
  portionSummary,
  statusLabel,
} from './planLabels';

/**
 * These labels are duplicated from `PlanExportService`. The screen and the PDF are the same
 * document seen two ways, and a practitioner finds out they disagree when a client asks about it.
 */
describe('mealLabel', () => {
  it('should match the export, meal for meal', () => {
    // Given — the exact strings in PlanExportService.MEAL_LABELS
    expect(MEAL_LABELS).toEqual({
      BREAKFAST: 'Πρωινό',
      MORNING_SNACK: 'Δεκατιανό',
      LUNCH: 'Μεσημεριανό',
      AFTERNOON_SNACK: 'Απογευματινό',
      DINNER: 'Βραδινό',
      EVENING_SNACK: 'Προ ύπνου',
    });
  });

  it('should fall back to the code rather than showing nothing', () => {
    // Given — a meal type added server-side against an older build. A blank heading loses the
    // items under it; the code at least says where they belong.
    expect(mealLabel('SUPPER')).toBe('SUPPER');
  });
});

describe('dayLabel', () => {
  it('should prefer the practitioner own label', () => {
    expect(dayLabel({ label: 'Ημέρα προπόνησης', dayIndex: 0 })).toBe('Ημέρα προπόνησης');
  });

  it('should treat a blank override as no override', () => {
    // Given — an emptied text field arrives as "" or whitespace, not null
    expect(dayLabel({ label: '   ', dayIndex: 0 })).toBe('Δευτέρα');
    expect(dayLabel({ label: '', dayIndex: 2 })).toBe('Τετάρτη');
  });

  it('should name the weekdays of a literal week, starting Monday', () => {
    const names = [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => dayLabel({ label: null, dayIndex }));
    expect(names).toEqual([
      'Δευτέρα',
      'Τρίτη',
      'Τετάρτη',
      'Πέμπτη',
      'Παρασκευή',
      'Σάββατο',
      'Κυριακή',
    ]);
  });

  it('should stop naming weekdays past the seventh day', () => {
    // Given — a fourteen-day plan. A second "Δευτέρα" halfway down is worse than a number:
    // the practitioner cannot tell which of the two a client is asking about.
    expect(dayLabel({ label: null, dayIndex: 7 })).toBe('Ημέρα 8');
    expect(dayLabel({ label: null, dayIndex: 13 })).toBe('Ημέρα 14');
  });
});

describe('statusLabel', () => {
  it('should translate every status the server can return', () => {
    expect(statusLabel('DRAFT')).toBe('Πρόχειρο');
    expect(statusLabel('ISSUED')).toBe('Δόθηκε');
    expect(statusLabel('ARCHIVED')).toBe('Αρχειοθετημένο');
  });
});

describe('formatQuantity', () => {
  it('should not add decimals to a whole quantity', () => {
    // Given — "2 φέτες" reads as intended; "2,0 φέτες" reads like a measurement
    expect(formatQuantity(2)).toBe('2');
  });

  it('should keep a half portion, which is common', () => {
    expect(formatQuantity(1.5)).toBe('1,5');
    expect(formatQuantity(0.5)).toBe('0,5');
  });
});

describe('portionSummary', () => {
  it('should show the portion and the weight it works out to', () => {
    // Given — the grams are what the figures were computed from, so they stay visible even when
    // a named portion is what the practitioner chose
    expect(
      portionSummary({ portionLabel: 'φέτα', quantity: 2, totalGrams: 50 }),
    ).toBe('2 × φέτα · 50,0 g');
  });

  it('should show grams alone when the food has no portions', () => {
    expect(portionSummary({ portionLabel: null, quantity: 1, totalGrams: 125.5 })).toBe('125,5 g');
  });
});

describe('formatKcal', () => {
  it('should group thousands the Greek way', () => {
    expect(formatKcal(2010)).toBe('2.010');
  });

  it('should show a dash rather than zero for a missing figure', () => {
    expect(formatKcal(null)).toBe('—');
    expect(formatKcal(0)).toBe('0');
  });
});

describe('nextStatusAction', () => {
  it('should offer the step that follows naturally from where the plan is', () => {
    // Given — the server permits any transition in any direction, so this guides rather than
    // constrains: one obvious next step per state.
    expect(nextStatusAction('DRAFT')?.status).toBe('ISSUED');
    expect(nextStatusAction('ISSUED')?.status).toBe('ARCHIVED');
  });

  it('should let an archived plan be reopened', () => {
    // Given — a practitioner may have archived the wrong one, and the server does not stop them
    expect(nextStatusAction('ARCHIVED')?.status).toBe('DRAFT');
  });

  it('should explain what the change means, not merely name it', () => {
    // Given — "Έκδοση" alone does not say whether the plan stays editable, which is the
    // question a practitioner actually has before pressing it
    for (const status of ['DRAFT', 'ISSUED', 'ARCHIVED']) {
      const action = nextStatusAction(status);
      expect(action?.label).toMatch(/\S/);
      expect(action?.explanation.length).toBeGreaterThan(20);
    }
  });

  it('should offer nothing for a status it does not recognise', () => {
    // Given — a state added server-side against an older build
    expect(nextStatusAction('SUPERSEDED')).toBeNull();
  });
});
