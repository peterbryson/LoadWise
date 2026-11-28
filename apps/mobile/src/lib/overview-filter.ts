import { daysBetween } from '@loadwise/analytics';
import type { OverviewAthlete } from '@loadwise/shared';
import { shortDay } from './session-format';

/** #50 AC2: which athletes the squad overview lists. */
export type OverviewFilter = 'all' | 'flagged' | 'not-logged';

/**
 * Filtered on the phone: a squad is at most about 40 athletes (NFR 3.1) and the API already sends
 * every one, so switching filter needs no request and works with a weak signal. The API's order
 * (problems first) is kept. "Not logged today" means no wellness check-in today, the one log
 * expected every day; it leaves out athletes who do not share, because LoadWise cannot say.
 */
export function filterOverview(athletes: readonly OverviewAthlete[], filter: OverviewFilter): OverviewAthlete[] {
  switch (filter) {
    case 'all':
      return [...athletes];
    case 'flagged':
      return athletes.filter((athlete) => athlete.sharing && athlete.status === 'flagged');
    case 'not-logged':
      return athletes.filter((athlete) => athlete.sharing && !athlete.logging.checkedInToday);
  }
}

/** "Last session today", "yesterday" or "Sun 22 Nov", relative to the overview's date. */
export function lastSessionText(lastSessionDate: string | null, today: string): string {
  if (lastSessionDate === null) return 'No sessions logged yet';
  const daysAgo = daysBetween(lastSessionDate, today);
  if (daysAgo === 0) return 'Last session today';
  if (daysAgo === 1) return 'Last session yesterday';
  return `Last session ${shortDay(lastSessionDate)}`;
}
