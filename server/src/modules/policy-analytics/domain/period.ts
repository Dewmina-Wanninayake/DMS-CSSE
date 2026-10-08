import { POLICY_LIMITS } from '@dms/shared';

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a `YYYY-MM-DD` day as UTC midnight; returns null for malformed or impossible dates. */
export function parseDay(day: string): Date | null {
  if (!DAY_PATTERN.test(day)) return null;
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : date;
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns a human-readable problem with the analysis period, or null when it is valid. */
export function validatePeriod(start: string, end: string, today: string): string | null {
  const from = parseDay(start);
  const to = parseDay(end);
  if (!from || !to) return 'Dates must be real calendar days in YYYY-MM-DD format.';
  if (from > to) return 'The start date must not be after the end date.';
  if (end > today) return 'The end date cannot be in the future.';
  const earliestStart = new Date(to);
  earliestStart.setUTCFullYear(earliestStart.getUTCFullYear() - POLICY_LIMITS.maxPeriodYears);
  if (from < earliestStart) {
    return `The period cannot be longer than ${POLICY_LIMITS.maxPeriodYears} years.`;
  }
  return null;
}

/** Inclusive instant bounds of a day range, comparable with ISO timestamps stored in SQLite. */
export function toBounds(start: string, end: string): { from: string; to: string } {
  return { from: `${start}T00:00:00.000Z`, to: `${end}T23:59:59.999Z` };
}

/** The period of equal length that ends the day before `start` (used for the trend direction, A3). */
export function previousPeriod(start: string, end: string): { start: string; end: string } {
  const from = parseDay(start) as Date;
  const to = parseDay(end) as Date;
  const lengthDays = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  const prevEnd = new Date(from.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - (lengthDays - 1) * DAY_MS);
  return { start: formatDay(prevStart), end: formatDay(prevEnd) };
}

/** Every `YYYY-MM` that the period touches, in order. */
export function monthKeys(start: string, end: string): string[] {
  const from = parseDay(start) as Date;
  const to = parseDay(end) as Date;
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}
