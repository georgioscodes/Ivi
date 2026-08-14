import type { MeasurementResponse, MeasurementTypeResponse } from '@/api/types';

export const CATEGORY_LABELS: Record<string, string> = {
  ANTHROPOMETRIC: 'Σωματομετρικά',
  BODY_COMPOSITION: 'Σύσταση σώματος',
  CIRCUMFERENCE: 'Περιφέρειες',
};

/**
 * The WHO cut-off bands, in Greek.
 *
 * `bmiCategory` arrives as a stable code — UNDERWEIGHT, NORMAL, OVERWEIGHT, OBESE — which is the
 * right thing for the server to send and the wrong thing to put on screen. A practitioner reading
 * "OVERWEIGHT" off a Greek interface, possibly with the client beside them, is a defect.
 */
const BMI_CATEGORY_LABELS: Record<string, string> = {
  UNDERWEIGHT: 'Ελλιποβαρής',
  NORMAL: 'Φυσιολογικό βάρος',
  OVERWEIGHT: 'Υπέρβαρη/ος',
  OBESE: 'Παχυσαρκία',
};

/**
 * Falls back to showing nothing rather than the raw code, if the server ever adds a band this
 * build does not know. An unexplained blank is better than an English shout.
 */
export function bmiCategoryLabel(category: string | null | undefined): string | null {
  return category ? (BMI_CATEGORY_LABELS[category] ?? null) : null;
}

/** Today in the server's date format, in the practitioner's own timezone rather than UTC. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * A measurement value with its unit, at the precision the type declares.
 *
 * `decimals` comes from the measurement type and is not a display preference: bone mass is
 * recorded to two places and visceral fat to none, and showing 12.00 for a level is wrong in a
 * way a practitioner will notice.
 *
 * Greek uses a comma for the decimal separator, which `Intl` handles — writing `toFixed` here
 * would put a full stop in front of a Greek reader.
 */
export function formatValue(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('el-GR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatWithUnit(
  value: number | null | undefined,
  unit: string,
  decimals: number,
): string {
  return value === null || value === undefined ? '—' : `${formatValue(value, decimals)} ${unit}`;
}

/**
 * A signed change, where the sign is the point.
 *
 * Explicitly prefixed with + or −, because "2.4" and "−2.4" as a weight change are opposite
 * outcomes and the minus sign is one glyph in a column of numbers. Uses the true minus (U+2212)
 * rather than a hyphen, which is narrow enough to be missed at small sizes.
 */
export function formatChange(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (value === 0) {
    return `±${formatValue(0, decimals)}`;
  }
  const magnitude = formatValue(Math.abs(value), decimals);
  return value > 0 ? `+${magnitude}` : `−${magnitude}`;
}

/** Types keyed by code, for the many places a measurement needs its type's precision. */
export function indexTypes(
  types: MeasurementTypeResponse[] | undefined,
): Map<string, MeasurementTypeResponse> {
  return new Map((types ?? []).map((type) => [type.code, type]));
}

/**
 * Orders a page of history so each visit reads the same way down the table.
 *
 * The server sorts by date descending and nothing else, so the four readings taken at one visit
 * come back in whatever order the rows happen to sit — weight above height on one date and below
 * it on the next. That makes the table unscannable for the thing a practitioner actually does
 * with it: comparing the same measurement across visits by eye.
 *
 * The secondary key is the order `GET /measurement/type` returns, which runs head to toe and is
 * the same order the entry form uses.
 *
 * Sorting is confined to the page in hand, so a visit split across a page boundary still appears
 * in two pieces. At fifty rows a page that is roughly a dozen visits, and the alternative is a
 * server-side sort this endpoint does not offer.
 */
export function orderForDisplay<T extends { recordedOn: string; typeCode: string }>(
  measurements: T[],
  types: MeasurementTypeResponse[] | undefined,
): T[] {
  const position = new Map((types ?? []).map((type, index) => [type.code, index]));

  return [...measurements].sort((left, right) => {
    if (left.recordedOn !== right.recordedOn) {
      return left.recordedOn < right.recordedOn ? 1 : -1;
    }
    return (position.get(left.typeCode) ?? 0) - (position.get(right.typeCode) ?? 0);
  });
}

/**
 * How many decimals a recorded measurement should be shown to.
 *
 * Falls back to one place when the type is not in the index — which happens only if a type is
 * withdrawn while historical measurements of it remain. Showing the raw number would be worse.
 */
export function decimalsFor(
  measurement: MeasurementResponse,
  types: Map<string, MeasurementTypeResponse>,
): number {
  return types.get(measurement.typeCode)?.decimals ?? 1;
}
