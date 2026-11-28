/**
 * Helpers for the "This week" card on Today (#45). Load figures themselves come from
 * `GET /me/load`, calculated by @loadwise/analytics in the API; these only count and scale them
 * for display.
 */

const DAY_MS = 86_400_000;

/** The YYYY-MM-DD day `days` after another, on a time-zone-free UTC calendar. */
function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Sessions dated in the Monday-to-Sunday week starting `weekStart` (YYYY-MM-DD). */
export function sessionsInWeek(sessions: readonly { date: string }[], weekStart: string): number {
  const end = addDays(weekStart, 7);
  return sessions.filter((session) => session.date >= weekStart && session.date < end).length;
}

/**
 * Bar heights from 0 to 1 for a small weekly chart. Every week is scaled against the largest, so
 * an all-zero history gives flat bars rather than dividing by zero.
 */
export function barFractions(loads: readonly number[]): number[] {
  const max = Math.max(0, ...loads);
  return loads.map((load) => (max === 0 ? 0 : load / max));
}

/** "1,240", as used for loads in arbitrary units (AU). */
export function formatLoad(load: number): string {
  return Math.round(load).toLocaleString('en-GB');
}
