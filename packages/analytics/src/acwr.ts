import { assertDailyLoads, mean } from './series';

/** DL-007: ACWR is shown, and used for flags, only once this many days have passed since the first session. */
export const ACWR_MIN_DAYS = 28;

/** Window lengths in days (FR 2, Williams et al., 2017). */
export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;

/**
 * Strategy pattern: one interface for the ways of calculating the acute:chronic workload ratio,
 * so the rolling-average model can replace EWMA (or be compared with it) without changing any
 * caller. EWMA is the default (FR 2, DL-007).
 */
export interface AcwrModel {
  readonly name: 'EWMA' | 'ROLLING';
  /**
   * @param daily one load per calendar day, oldest first, ending today. Leading zero days are
   * ignored: the first non-zero day is taken as the first session.
   * @returns the ratio, or null before 28 days have passed since the first session or when the
   * chronic load is 0.
   */
  calculate(daily: readonly number[]): number | null;
}

/**
 * Exponentially weighted moving average (Williams et al., 2017): each day,
 * average = λ × that day's load + (1 − λ) × the previous average, with λ = 2 / (N + 1).
 * The average starts at 0 on the day before `daily[0]`, and every day counts, including zero days.
 */
export function ewma(daily: readonly number[], windowDays: number): number {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new RangeError(`Window must be a positive whole number of days, got ${windowDays}`);
  }
  const lambda = 2 / (windowDays + 1);
  return daily.reduce((average, load) => lambda * load + (1 - lambda) * average, 0);
}

/** FR 2 default: acute 7-day EWMA ÷ chronic 28-day EWMA. */
export class EwmaAcwr implements AcwrModel {
  readonly name = 'EWMA';

  calculate(daily: readonly number[]): number | null {
    const sinceFirst = fromFirstSession(daily);
    if (sinceFirst === null) return null;
    return ratio(ewma(sinceFirst, ACUTE_DAYS), ewma(sinceFirst, CHRONIC_DAYS));
  }
}

/**
 * The older rolling-average model: mean load of the last 7 days ÷ mean of the last 28 days.
 * "Coupled", because the last 7 days are also inside the 28. Kept as an alternative to compare
 * with EWMA, which weights recent days more and has no sudden drop when a hard day leaves the window.
 */
export class RollingAcwr implements AcwrModel {
  readonly name = 'ROLLING';

  calculate(daily: readonly number[]): number | null {
    const sinceFirst = fromFirstSession(daily);
    if (sinceFirst === null) return null;
    return ratio(mean(sinceFirst.slice(-ACUTE_DAYS)), mean(sinceFirst.slice(-CHRONIC_DAYS)));
  }
}

/**
 * The days from the first session to today, or null if there is no session or fewer than 28 days
 * have passed since it (DL-007). Starting at the first session is what seeds both averages at 0
 * on the day before it, so empty days before an athlete joined do not pull the chronic load down.
 */
function fromFirstSession(daily: readonly number[]): readonly number[] | null {
  assertDailyLoads(daily);
  const first = daily.findIndex((load) => load > 0);
  if (first === -1) return null;
  const daysSinceFirst = daily.length - 1 - first;
  return daysSinceFirst < ACWR_MIN_DAYS ? null : daily.slice(first);
}

/** With no chronic load there is nothing to compare against, so no ratio rather than Infinity. */
function ratio(acute: number, chronic: number): number | null {
  return chronic === 0 ? null : acute / chronic;
}
