import type { OverviewAthlete, SharingAthlete } from '@loadwise/shared';
import { filterOverview, lastSessionText } from './overview-filter';

function sharing(athleteId: string, status: SharingAthlete['status'], checkedInToday: boolean): SharingAthlete {
  return {
    athleteId,
    displayName: athleteId,
    sharing: true,
    status,
    flags: [],
    checks: { acwr: 'checked', wellness: 'checked' },
    logging: { checkedInToday, lastSessionDate: null },
    load: { thisWeek: 0, usualWeek: null, acwr: null },
  };
}

const athletes: OverviewAthlete[] = [
  sharing('flagged-in', 'flagged', true),
  sharing('flagged-out', 'flagged', false),
  sharing('clear-out', 'clear', false),
  sharing('clear-in', 'clear', true),
  { athleteId: 'private', displayName: 'private', sharing: false },
];
const ids = (rows: OverviewAthlete[]) => rows.map((row) => row.athleteId);

describe('FR4 #50 AC2: overview filters', () => {
  it('shows everyone, including athletes who do not share, under All', () => {
    expect(ids(filterOverview(athletes, 'all'))).toEqual(['flagged-in', 'flagged-out', 'clear-out', 'clear-in', 'private']);
  });

  it('shows only flagged athletes, keeping the API’s order', () => {
    expect(ids(filterOverview(athletes, 'flagged'))).toEqual(['flagged-in', 'flagged-out']);
  });

  it('shows sharing athletes with no check-in today, flagged or not', () => {
    expect(ids(filterOverview(athletes, 'not-logged'))).toEqual(['flagged-out', 'clear-out']);
  });

  it('leaves out athletes who do not share from Not logged today, as LoadWise cannot say', () => {
    expect(ids(filterOverview(athletes, 'not-logged'))).not.toContain('private');
  });

  it('returns an empty list when nobody matches', () => {
    expect(filterOverview([sharing('a', 'clear', true)], 'not-logged')).toEqual([]);
    expect(filterOverview([], 'flagged')).toEqual([]);
  });
});

describe('FR4 #50 AC1: last session wording', () => {
  const today = '2026-11-25';

  it('says today, yesterday, or the day for anything older', () => {
    expect(lastSessionText('2026-11-25', today)).toBe('Last session today');
    expect(lastSessionText('2026-11-24', today)).toBe('Last session yesterday');
    expect(lastSessionText('2026-11-22', today)).toBe('Last session Sun 22 Nov');
  });

  it('says so when no session has been logged', () => {
    expect(lastSessionText(null, today)).toBe('No sessions logged yet');
  });
});
