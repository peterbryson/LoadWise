import { daysBetween } from './dates';

/**
 * #50: whether an athlete has logged, for a squad overview. Yes/no and a date only, never scores,
 * so every staff role may see it (a coach gets wellness status only, DL-022).
 */
export interface LoggingStatus {
  /** A wellness check-in is dated today. */
  checkedInToday: boolean;
  /** The latest session on or before today, YYYY-MM-DD, or null if none has been logged. */
  lastSessionDate: string | null;
}

/**
 * Derived from rows the overview already reads for its metrics, so it needs no extra query
 * (NFR 3.1). Entries dated after `today` are ignored, as in every other metric.
 *
 * @throws RangeError for a date that is not a real YYYY-MM-DD calendar day.
 */
export function loggingStatus(
  sessions: readonly { date: string }[],
  checkIns: readonly { date: string }[],
  today: string,
): LoggingStatus {
  daysBetween(today, today); // validates `today` even when there are no entries

  let lastSessionDate: string | null = null;
  for (const { date } of sessions) {
    const onOrBeforeToday = daysBetween(date, today) >= 0;
    if (onOrBeforeToday && (lastSessionDate === null || daysBetween(lastSessionDate, date) > 0)) {
      lastSessionDate = date;
    }
  }
  // Every check-in is compared (no early exit), so an invalid date always throws.
  const checkedInToday = checkIns.filter(({ date }) => daysBetween(date, today) === 0).length > 0;
  return { checkedInToday, lastSessionDate };
}
