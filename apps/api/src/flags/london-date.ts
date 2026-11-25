export const CLOCK = Symbol('CLOCK');

/** Injected so tests can fix "now"; the analytics package never reads a clock itself. */
export type Clock = () => Date;

// en-CA formats dates as YYYY-MM-DD.
const londonFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The calendar date in the UK for an instant. The API decides "today" this way rather than in
 * UTC, which is still yesterday between midnight and 01:00 during British Summer Time.
 */
export function londonDate(instant: Date): string {
  return londonFormat.format(instant);
}

/** A YYYY-MM-DD date `days` before another, using UTC midnight as a time-zone-free calendar. */
export function isoDaysBefore(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`) - days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
