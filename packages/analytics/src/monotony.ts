import { assertDailyLoads, mean, sum } from './series';

/** Monotony and strain look at one week of daily loads (Foster, 1998). */
export const MONOTONY_DAYS = 7;

/**
 * Training monotony (Foster, 1998): mean daily load over the last 7 days ÷ the standard deviation
 * of those 7 days. Rest days count as 0. Null when the SD is 0 (every day the same, including no
 * load at all), because the ratio has no value then.
 *
 * Why the population SD (divide by 7) rather than the sample SD (divide by 6): the 7 days are the
 * whole week being described, not a sample from a larger set. Foster does not say which; some
 * tools use the sample SD, which gives a monotony about 7% lower (× √(6/7)), so compare numbers
 * across tools with care.
 *
 * @param daily one load per day, oldest first, ending today; only the last 7 are used.
 * @throws RangeError for fewer than 7 days or a negative or non-finite load.
 */
export function monotony(daily: readonly number[]): number | null {
  const week = lastWeek(daily);
  const average = mean(week);
  const sd = Math.sqrt(mean(week.map((load) => (load - average) ** 2)));
  return sd === 0 ? null : average / sd;
}

/** Training strain (Foster, 1998): total load of the last 7 days × monotony. Null when monotony is. */
export function strain(daily: readonly number[]): number | null {
  const value = monotony(daily);
  return value === null ? null : sum(lastWeek(daily)) * value;
}

function lastWeek(daily: readonly number[]): readonly number[] {
  if (daily.length < MONOTONY_DAYS) {
    throw new RangeError(`Monotony needs ${MONOTONY_DAYS} days of loads, got ${daily.length}`);
  }
  const week = daily.slice(-MONOTONY_DAYS);
  assertDailyLoads(week);
  return week;
}
