import { ACWR_MIN_DAYS, AcwrModel, EwmaAcwr } from './acwr';
import { addDays, daysBetween } from './dates';
import { MONOTONY_DAYS, monotony, strain } from './monotony';
import { dailyLoads, firstSessionDate, LoggedSession, usualWeek, WeekLoad, weeklyLoads } from './weekly-load';

/** #7 AC3: the Trends tab shows the last 6 weeks, this one included. */
export const TREND_WEEKS = 6;

export interface LoadSummary {
  /** The calendar day the summary was calculated for, YYYY-MM-DD. */
  today: string;
  /** Oldest first; the last week is this week so far. */
  weeks: WeekLoad[];
  /** DL-007; null until 4 completed weeks have passed since the first session. */
  usualWeek: number | null;
  acwr: {
    model: AcwrModel['name'];
    /** Null before `availableFrom`, or when there is no chronic load to compare against. */
    value: number | null;
    /** First session + 28 days (DL-007); null when nothing has been logged yet. */
    availableFrom: string | null;
  };
  monotony: number | null;
  strain: number | null;
}

export interface LoadSummaryOptions {
  weeks?: number;
  acwrModel?: AcwrModel;
}

/**
 * FR 2, #7: every load metric the athlete sees on Trends, from their sessions and today's date.
 * Sessions after `today` are ignored. `today` is passed in, never read from a clock (DL-007).
 */
export function loadSummary(
  sessions: readonly LoggedSession[],
  today: string,
  { weeks = TREND_WEEKS, acwrModel = new EwmaAcwr() }: LoadSummaryOptions = {},
): LoadSummary {
  const first = firstSessionDate(sessions, today);
  const lastWeekStart = addDays(today, 1 - MONOTONY_DAYS);
  // Every day from the first session, because EWMA weights all history; at least 7 days for monotony.
  const from = first !== null && daysBetween(first, lastWeekStart) > 0 ? first : lastWeekStart;
  const daily = dailyLoads(sessions, from, today);

  return {
    today,
    weeks: weeklyLoads(sessions, today, weeks),
    usualWeek: usualWeek(sessions, today),
    acwr: {
      model: acwrModel.name,
      value: acwrModel.calculate(daily),
      availableFrom: first === null ? null : addDays(first, ACWR_MIN_DAYS),
    },
    monotony: monotony(daily),
    strain: strain(daily),
  };
}
