import type { IsoDate } from '@/api/types';

/**
 * Today, as the date input wants it.
 *
 * Deliberately **not** `toISOString().slice(0, 10)`, which is the obvious way to write this and is
 * wrong. That converts to UTC first, and Greece runs two or three hours ahead — so a consultation
 * written up at 01:00 in Athens would default to yesterday's date. The practitioner would have to
 * notice and correct it, on a field they had no reason to look at.
 */
export function today(now: Date = new Date()): IsoDate {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}` as IsoDate;
}

/** A date the practitioner can read: "3 Αυγούστου 2026". */
export function formatEntryDate(value: string): string {
  // Parsed as parts rather than by Date(string), which reads a bare YYYY-MM-DD as UTC midnight and
  // then renders it in local time — a day early for anyone west of Greenwich.
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return new Intl.DateTimeFormat('el-GR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

/** The weekday, for the list heading: a consultation is remembered as "that Tuesday". */
export function weekdayOf(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return '';
  }
  return new Intl.DateTimeFormat('el-GR', { weekday: 'long' }).format(
    new Date(year, month - 1, day),
  );
}
