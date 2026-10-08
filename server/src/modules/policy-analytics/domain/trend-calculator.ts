import type { TrendDirection } from '@dms/shared';

/** Changes smaller than this (in percent) are reported as "Stable" (assumption A3). */
export const TREND_STABLE_BAND_PERCENT = 10;

/** Percentage change from `previous` to `current`, one decimal; null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function trendDirection(current: number, previous: number): TrendDirection {
  const change = percentChange(current, previous);
  if (change === null) return current > 0 ? 'Rising' : 'Stable';
  if (change > TREND_STABLE_BAND_PERCENT) return 'Rising';
  if (change < -TREND_STABLE_BAND_PERCENT) return 'Falling';
  return 'Stable';
}

/** Extension 3a: too few records in scope to support a reliable analysis. */
export function isSparse(dataPoints: number, minDataPoints: number): boolean {
  return dataPoints < minDataPoints;
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
