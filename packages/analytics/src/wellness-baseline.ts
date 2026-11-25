/**
 * Wellness baseline and 7-day averages (FR 2, #9), as defined in DL-007: each item is compared
 * with the athlete's own mean and SD over the previous 28 days, never with other athletes.
 * All four items are scored 1 to 5 with 5 always the best answer, so no item is reverse-scored.
 */

import { addDays, daysBetween } from './dates';

export const WELLNESS_ITEMS = ['sleep', 'soreness', 'fatigue', 'stress'] as const;
export type WellnessItem = (typeof WELLNESS_ITEMS)[number];

export type WellnessScores = Record<WellnessItem, number>;

/** One daily check-in. `date` is the athlete's calendar day, YYYY-MM-DD; at most one per day (#5). */
export interface WellnessEntry extends WellnessScores {
  date: string;
}

export interface ItemBaseline {
  mean: number;
  /** Sample standard deviation (n - 1). */
  sd: number;
}

export interface WellnessBaseline {
  /** Check-ins in the window. */
  count: number;
  items: Record<WellnessItem, ItemBaseline>;
}

export interface WellnessAverage {
  count: number;
  items: WellnessScores;
}

export interface WellnessTrendPoint {
  /** The last day of the 7-day window, YYYY-MM-DD. */
  endDate: string;
  average: WellnessAverage | null;
  baseline: WellnessBaseline | null;
}

export const BASELINE_WINDOW_DAYS = 28;
export const MIN_BASELINE_CHECK_INS = 14;
const AVERAGE_WINDOW_DAYS = 7;
const MAX_TREND_WEEKS = 52;

/** Entries whose date is from `fromDaysBefore` to `toDaysBefore` days before `today`, inclusive. */
function entriesBetween(
  entries: readonly WellnessEntry[],
  today: string,
  toDaysBefore: number,
  fromDaysBefore: number,
): WellnessEntry[] {
  // Counting from the window's first day also rejects an invalid `today` when there are no entries.
  const first = addDays(today, -fromDaysBefore);
  const length = fromDaysBefore - toDaysBefore;
  return entries.filter((entry) => {
    const daysIn = daysBetween(first, entry.date);
    return daysIn >= 0 && daysIn <= length;
  });
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values: readonly number[], valuesMean: number): number {
  const squares = values.reduce((sum, value) => sum + (value - valuesMean) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

function baselineAt(entries: readonly WellnessEntry[], today: string): WellnessBaseline | null {
  // Days without a check-in are skipped, not counted as zero (DL-007).
  const window = entriesBetween(entries, today, 1, BASELINE_WINDOW_DAYS);
  if (window.length < MIN_BASELINE_CHECK_INS) return null;
  const items = {} as Record<WellnessItem, ItemBaseline>;
  for (const item of WELLNESS_ITEMS) {
    const values = window.map((entry) => entry[item]);
    const itemMean = mean(values);
    items[item] = { mean: itemMean, sd: sampleSd(values, itemMean) };
  }
  return { count: window.length, items };
}

function averageAt(entries: readonly WellnessEntry[], today: string): WellnessAverage | null {
  const window = entriesBetween(entries, today, 0, AVERAGE_WINDOW_DAYS - 1);
  if (window.length === 0) return null;
  const items = {} as WellnessScores;
  for (const item of WELLNESS_ITEMS) items[item] = mean(window.map((entry) => entry[item]));
  return { count: window.length, items };
}

/**
 * The athlete's usual wellness: mean and sample SD of each item over the 28 days before `today`
 * (today - 28 to today - 1). Today is left out so a bad morning cannot lower its own baseline.
 *
 * @returns null when the window holds fewer than 14 check-ins (DL-007).
 * @throws RangeError if `today` or an entry date is not a valid YYYY-MM-DD date.
 */
export function wellnessBaseline(entries: readonly WellnessEntry[], today: string): WellnessBaseline | null {
  return baselineAt(entries, today);
}

/**
 * Check-ins in the baseline window (today - 28 to today - 1), so a screen can show progress
 * towards the 14 needed while wellnessBaseline() is still null.
 */
export function baselineCheckIns(entries: readonly WellnessEntry[], today: string): number {
  return entriesBetween(entries, today, 1, BASELINE_WINDOW_DAYS).length;
}

/**
 * Mean of each item over today and the 6 days before it, skipping days without a check-in.
 *
 * @returns null when there is no check-in in those 7 days.
 */
export function wellnessSevenDayAverage(entries: readonly WellnessEntry[], today: string): WellnessAverage | null {
  return averageAt(entries, today);
}

/**
 * The Trends tab's wellness history (#9 AC3): one point per week for `weeks` weeks, oldest first.
 * Each point is the 7-day average ending on that day and the baseline as it stood on that day.
 *
 * @throws RangeError if `weeks` is not an integer from 1 to 52.
 */
export function wellnessTrend(
  entries: readonly WellnessEntry[],
  today: string,
  weeks: number,
): WellnessTrendPoint[] {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_TREND_WEEKS) {
    throw new RangeError(`Weeks must be an integer from 1 to ${MAX_TREND_WEEKS}, got ${weeks}`);
  }
  return Array.from({ length: weeks }, (_, index) => {
    const end = addDays(today, -(weeks - 1 - index) * AVERAGE_WINDOW_DAYS);
    return { endDate: end, average: averageAt(entries, end), baseline: baselineAt(entries, end) };
  });
}
