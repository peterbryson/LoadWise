/**
 * The API's only source of the current time for metrics. Injected so tests can fix "today";
 * @loadwise/analytics never reads a clock (DL-007).
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };

/**
 * The Europe/London calendar day of an instant, YYYY-MM-DD. Not toISOString(), which gives the
 * UTC day: during British Summer Time, 00:30 in Belfast is still the previous day in UTC.
 */
export function londonDate(instant: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(instant);
}
