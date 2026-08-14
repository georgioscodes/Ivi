import type { FoodResponse } from '@/api/types';

/**
 * The five catalogue categories, in Greek.
 *
 * Deliberately **not** colour-coded. The roadmap wants colour here eventually, and the palette
 * cannot supply it: the brand five have pairwise contrast as low as 1.01, and five reliably
 * distinguishable hues would need a scale designed for it plus a non-colour channel carrying the
 * same information. Text does that job today at no cost. See docs/ui-palette.md.
 */
export const FOOD_CATEGORIES: { code: string; label: string }[] = [
  { code: 'FRESH', label: 'Φρέσκα τρόφιμα' },
  { code: 'CARBOHYDRATE', label: 'Υδατάνθρακες' },
  { code: 'PROTEIN', label: 'Πρωτεΐνες' },
  { code: 'FAT', label: 'Λίπη' },
  { code: 'COMPOSITE', label: 'Σύνθετα' },
];

export function categoryLabel(code: string | null | undefined): string {
  return FOOD_CATEGORIES.find((category) => category.code === code)?.label ?? '—';
}

/**
 * Where a food's numbers came from.
 *
 * `DEMO_SEED` is named honestly rather than dressed up as a reference database. These values are
 * placeholders pending a real licensed source, and a practitioner deciding whether to trust a
 * figure deserves to know which they are looking at.
 */
export function sourceLabel(source: string | null | undefined): string | null {
  if (source === 'DEMO_SEED') {
    return 'Δοκιμαστικά δεδομένα';
  }
  if (source === 'PRACTITIONER') {
    return 'Καταχωρήθηκε από εσάς';
  }
  return null;
}

export function suggestionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Σε αναμονή',
    ACCEPTED: 'Έγινε δεκτή',
    REJECTED: 'Απορρίφθηκε',
  };
  return labels[status] ?? status;
}

/**
 * How a food should be badged in a list.
 *
 * The distinction that matters to a practitioner is not global-versus-own — it is *whose numbers
 * am I about to put in a plan*. An overridden food carries their values under a catalogue name,
 * which is exactly the case where silence would mislead.
 */
export type FoodBadge = { label: string; kind: 'override' | 'own' } | null;

export function badgeFor(food: FoodResponse): FoodBadge {
  if (food.overridden) {
    return { label: 'Τροποποιημένο', kind: 'override' };
  }
  if (!food.global) {
    return { label: 'Δικό σας', kind: 'own' };
  }
  return null;
}

/**
 * Composition figures, in Greek notation.
 *
 * Energy is whole kilocalories and macros go to one place, matching how the catalogue stores
 * them. These are per 100 g throughout — the label saying so is not decoration, because a
 * practitioner reading 390 kcal for cheese needs to know it is not per portion.
 */
export function formatNutrient(value: number | null | undefined, decimals: number): string {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('el-GR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
}

export function formatGrams(value: number | null | undefined): string {
  return formatNutrient(value, 1);
}

export function formatEnergy(value: number | null | undefined): string {
  return formatNutrient(value, 0);
}
