import type { PlanDayResponse, PlanStatus } from '@/api/types';

/**
 * Meal names, matching `PlanExportService.MEAL_LABELS` exactly.
 *
 * The screen and the PDF are the same document seen two ways. A practitioner builds a plan here
 * and hands the client the printout; if "Δεκατιανό" on screen prints as "Πρωινό γεύμα", they find
 * out when the client asks about it.
 */
export const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Πρωινό',
  MORNING_SNACK: 'Δεκατιανό',
  LUNCH: 'Μεσημεριανό',
  AFTERNOON_SNACK: 'Απογευματινό',
  DINNER: 'Βραδινό',
  EVENING_SNACK: 'Προ ύπνου',
};

export function mealLabel(mealType: string): string {
  return MEAL_LABELS[mealType] ?? mealType;
}

/** Day 0 is Monday when a plan is a literal week — the same assumption the export makes. */
const DAY_NAMES = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];

/**
 * A day's heading: the practitioner's own label, else a weekday name, else a numbered heading.
 *
 * `PlanDayResponse.label` is the raw override and is usually null, so this resolution has to
 * happen somewhere. It mirrors `PlanExportService.dayLabels` line for line, including the part
 * that matters most: past seven days it stops naming weekdays rather than producing a second
 * Monday in a fourteen-day plan.
 */
export function dayLabel(day: Pick<PlanDayResponse, 'label' | 'dayIndex'>): string {
  if (day.label !== null && day.label.trim() !== '') {
    return day.label;
  }
  return day.dayIndex < DAY_NAMES.length
    ? (DAY_NAMES[day.dayIndex] as string)
    : `Ημέρα ${day.dayIndex + 1}`;
}

export const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Πρόχειρο',
  ISSUED: 'Δόθηκε',
  ARCHIVED: 'Αρχειοθετημένο',
};

export function statusLabel(status: PlanStatus | string): string {
  return PLAN_STATUS_LABELS[status] ?? status;
}

/** Whole kilocalories, Greek thousands separator. */
export function formatKcal(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 }).format(value);
}

/** Macro grams, to one place, as the server rounds them. */
export function formatGrams(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('el-GR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
}

/**
 * A quantity, showing decimals only when there are any.
 *
 * "2 φέτες" reads as intended; "2,0 φέτες" reads like a measurement. Half portions are common
 * enough that the decimals cannot simply be dropped.
 */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('el-GR', { maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : `${new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 }).format(value)}%`;
}

/**
 * How an item reads on one line: "2 φέτες · 50 g" or just "50 g".
 *
 * The gram weight is always shown even when a portion is named, because it is what the figures
 * were computed from and the practitioner may need to check it.
 */
export function portionSummary(item: {
  portionLabel: string | null;
  quantity: number;
  totalGrams: number;
}): string {
  const grams = `${formatGrams(item.totalGrams)} g`;
  return item.portionLabel
    ? `${formatQuantity(item.quantity)} × ${item.portionLabel} · ${grams}`
    : grams;
}
