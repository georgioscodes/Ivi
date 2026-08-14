import type { BmrEquation } from '@/api/types';

/**
 * Equations, named the way the literature names them.
 *
 * These are proper nouns and stay in Latin script — a Greek dietitian looking for
 * Mifflin-St Jeor is looking for "Mifflin-St Jeor". The description beside each is what needs
 * translating, because that is the part carrying meaning rather than identity.
 */
export const EQUATIONS: { code: BmrEquation; name: string; note: string }[] = [
  {
    code: 'MIFFLIN_ST_JEOR',
    name: 'Mifflin-St Jeor',
    note: 'Η πιο ακριβής για τον γενικό πληθυσμό',
  },
  {
    code: 'HARRIS_BENEDICT_REVISED',
    name: 'Harris-Benedict (αναθεωρημένη)',
    note: 'Αναθεώρηση Roza & Shizgal, 1984',
  },
  {
    code: 'HARRIS_BENEDICT_ORIGINAL',
    name: 'Harris-Benedict (αρχική)',
    note: 'Η αρχική εξίσωση του 1919',
  },
];

/**
 * What `basis` means, in Greek.
 *
 * The server returns a code — an equation name, `MANUAL`, or `DIRECT` — which is the right thing
 * for it to send and the wrong thing to show. This is the same defect that put "OVERWEIGHT" on a
 * Greek measurements screen; caught here before it reached one.
 */
export function basisLabel(basis: string | null | undefined): string | null {
  if (!basis) {
    return null;
  }
  if (basis === 'MANUAL') {
    return 'Βασικός μεταβολισμός που δηλώθηκε';
  }
  if (basis === 'DIRECT') {
    return 'Ενεργειακός στόχος που δηλώθηκε';
  }

  const equation = EQUATIONS.find((candidate) => candidate.code === basis);
  // An unrecognised code shows nothing rather than shouting an enum name at the practitioner.
  return equation ? `Εξίσωση ${equation.name}` : null;
}

/** Whole kilocalories, with the Greek thousands separator. */
export function formatKcal(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 }).format(value);
}

/** Grams, to one place, as the server rounds them. */
export function formatGrams(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('el-GR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
}

/**
 * An activity factor, in Greek notation.
 *
 * Interpolating the raw number gives "1.375", and in Greek a full stop is the thousands
 * separator — so the multiplier reads as one thousand three hundred and seventy-five to the
 * person saying it out loud across a desk.
 */
export function formatFactor(value: number): string {
  return new Intl.NumberFormat('el-GR', { maximumFractionDigits: 3 }).format(value);
}

/**
 * A signed energy adjustment.
 *
 * The sign carries the entire meaning of the weight goal — −590 kcal and +590 kcal are opposite
 * prescriptions — so it is stated explicitly, with a true minus rather than a hyphen.
 */
export function formatSignedKcal(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (value === 0) {
    return '±0';
  }
  const magnitude = formatKcal(Math.abs(value));
  return value > 0 ? `+${magnitude}` : `−${magnitude}`;
}

/**
 * Age from a date of birth, for prefilling the equation.
 *
 * This is the one derived number the client computes, and it is not a nutrient value: it is a
 * *form default* the practitioner can see and overwrite before anything is sent. The energy
 * figures it feeds are all calculated server-side from whatever the field ends up holding.
 */
export function ageFromDateOfBirth(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }
  return age >= 1 && age <= 120 ? age : null;
}
