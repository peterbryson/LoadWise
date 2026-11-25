/**
 * Calendar-day arithmetic on 'YYYY-MM-DD' strings. A calendar day has no time zone: the API decides
 * which day "today" is (Europe/London) and passes it in. Working in UTC midnights here means a
 * clock change never adds or loses a day.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Days since 1970-01-01. Rejects strings that are not a real calendar date, e.g. 2026-02-30. */
function toDayNumber(date: string): number {
  const ms = ISO_DATE.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  // Date.parse rolls 2026-02-30 over to 2 March, so a round trip catches impossible dates.
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`);
  }
  return ms / MS_PER_DAY;
}

function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError(`Days must be a whole number, got ${days}`);
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** The Monday that starts the Monday-to-Sunday week containing `date` (DL-007). */
export function mondayOf(date: string): string {
  const day = toDayNumber(date);
  // 1970-01-01 was a Thursday, so day 0 is 3 days after a Monday.
  const daysSinceMonday = (((day + 3) % 7) + 7) % 7;
  return fromDayNumber(day - daysSinceMonday);
}
