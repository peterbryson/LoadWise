import { barFractions, formatLoad, sessionsInWeek } from './week-summary';

describe('FR2 #45: This week on Today', () => {
  describe('sessionsInWeek', () => {
    const sessions = [
      { date: '2026-11-22' }, // Sunday of the week before
      { date: '2026-11-23' }, // Monday, first day of the week
      { date: '2026-11-25' },
      { date: '2026-11-29' }, // Sunday, last day of the week
      { date: '2026-11-30' }, // Monday of the next week
    ];

    it('counts sessions from Monday to Sunday inclusive', () => {
      expect(sessionsInWeek(sessions, '2026-11-23')).toBe(3);
    });

    it('is 0 with no sessions', () => {
      expect(sessionsInWeek([], '2026-11-23')).toBe(0);
    });

    it('handles a week that crosses a month end', () => {
      expect(sessionsInWeek([{ date: '2026-12-01' }, { date: '2026-11-30' }], '2026-11-30')).toBe(2);
    });
  });

  describe('barFractions', () => {
    it('scales every week against the largest', () => {
      expect(barFractions([200, 400, 100])).toEqual([0.5, 1, 0.25]);
    });

    it('gives flat bars when nothing has been logged', () => {
      expect(barFractions([0, 0, 0])).toEqual([0, 0, 0]);
    });

    it('returns nothing for no weeks', () => {
      expect(barFractions([])).toEqual([]);
    });
  });

  it('formats loads as whole numbers with thousands separators', () => {
    expect(formatLoad(1240.4)).toBe('1,240');
    expect(formatLoad(0)).toBe('0');
  });
});
