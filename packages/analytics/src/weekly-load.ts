import { addDays, daysBetween, mondayOf } from './dates';
import { sessionLoad } from './session-load';
import { sum } from './series';

/** The fields of a logged session that load metrics need. */
export interface LoggedSession {
  /** Calendar day of the session, YYYY-MM-DD. */
  date: string;
  rpe: number;
  durationMinutes: number;
}

export interface WeekLoad {
  /** The Monday the week starts on, YYYY-MM-DD. */
  weekStart: string;
  /** Sum of session loads from Monday to Sunday, in AU. */
  load: number;
  /** True for the week containing today, which is not over yet. */
  partial: boolean;
}

/** DL-007: the usual week averages this many completed weeks. */
export const USUAL_WEEK_WEEKS = 4;

/**
 * Total session load for each day from `from` to `to` inclusive. Sessions on the same day are
 * summed, a day with no session is 0 (DL-007), and sessions outside the range are ignored.
 *
 * @throws RangeError for an invalid date, a range that ends before it starts, or a session that
 * sessionLoad rejects.
 */
export function dailyLoads(sessions: readonly LoggedSession[], from: string, to: string): number[] {
  const length = daysBetween(from, to) + 1;
  if (length < 1) throw new RangeError(`The range ends (${to}) before it starts (${from})`);

  const daily = Array<number>(length).fill(0);
  for (const session of sessions) {
    const load = sessionLoad(session.rpe, session.durationMinutes);
    const index = daysBetween(from, session.date);
    if (index >= 0 && index < length) daily[index] += load;
  }
  return daily;
}

/**
 * The last `weeks` Monday-to-Sunday weeks, oldest first, ending with the week containing `today`.
 * That last week is marked partial; sessions after `today` are not counted.
 *
 * @throws RangeError if `weeks` is not a positive whole number, or for invalid dates or sessions.
 */
export function weeklyLoads(sessions: readonly LoggedSession[], today: string, weeks: number): WeekLoad[] {
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new RangeError(`Weeks must be a positive whole number, got ${weeks}`);
  }
  const thisMonday = mondayOf(today);
  const firstMonday = addDays(thisMonday, -7 * (weeks - 1));
  const daily = dailyLoads(sessions, firstMonday, today);

  return Array.from({ length: weeks }, (_, week) => ({
    weekStart: addDays(firstMonday, 7 * week),
    load: sum(daily.slice(7 * week, 7 * week + 7)),
    partial: week === weeks - 1,
  }));
}

/**
 * DL-007: mean weekly load of the last 4 completed Monday-to-Sunday weeks, or null until 4
 * completed weeks have passed since the first session. A week only counts once it starts on or
 * after the first session, so days before the athlete started using LoadWise are never averaged in
 * as zeros. Days without a session after that are zeros.
 */
export function usualWeek(sessions: readonly LoggedSession[], today: string): number | null {
  const first = firstSessionDate(sessions, today);
  const oldestMonday = addDays(mondayOf(today), -7 * USUAL_WEEK_WEEKS);
  if (first === null || daysBetween(first, oldestMonday) < 0) return null;

  const daily = dailyLoads(sessions, oldestMonday, addDays(mondayOf(today), -1));
  return sum(daily) / USUAL_WEEK_WEEKS;
}

/** The earliest session date on or before `today`, or null if there is none. */
export function firstSessionDate(sessions: readonly LoggedSession[], today: string): string | null {
  let first: string | null = null;
  for (const session of sessions) {
    const onOrBeforeToday = daysBetween(session.date, today) >= 0;
    if (onOrBeforeToday && (first === null || daysBetween(session.date, first) > 0)) first = session.date;
  }
  return first;
}
