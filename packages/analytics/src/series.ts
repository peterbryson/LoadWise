/** Small helpers shared by the metric functions. Not exported from the package. */

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: readonly number[]): number {
  return sum(values) / values.length;
}

/**
 * Daily loads come from sessionLoad, so they are finite and never negative. Checking again here
 * means a model or metric called directly with bad data fails loudly instead of returning a
 * misleading number.
 */
export function assertDailyLoads(daily: readonly number[]): void {
  for (const load of daily) {
    if (!Number.isFinite(load) || load < 0) {
      throw new RangeError(`Daily load must be a finite number of at least 0, got ${load}`);
    }
  }
}
