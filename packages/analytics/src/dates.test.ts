import { addDays, daysBetween, mondayOf } from './dates';

// Calendar days are 'YYYY-MM-DD' strings with no time zone. The caller (the API) decides which
// calendar day "today" is; these helpers only count days.
describe('FR2: calendar-day helpers for load metrics (#7)', () => {
  it.each([
    ['2026-11-25', 1, '2026-11-26'],
    ['2026-11-30', 1, '2026-12-01'], // end of month
    ['2026-12-31', 1, '2027-01-01'], // end of year
    ['2028-02-28', 1, '2028-02-29'], // leap year
    ['2026-03-29', 0, '2026-03-29'], // UK clocks change on this Sunday; no hour is lost
    ['2026-10-26', -7, '2026-10-19'],
  ])('addDays(%s, %i) = %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });

  it.each([
    ['2026-11-23', '2026-11-23'], // Monday is its own week start
    ['2026-11-25', '2026-11-23'], // Wednesday
    ['2026-11-29', '2026-11-23'], // Sunday belongs to the week that started the Monday before
    ['2026-11-30', '2026-11-30'], // the next Monday starts a new week
  ])('mondayOf(%s) = %s', (date, expected) => {
    expect(mondayOf(date)).toBe(expected);
  });

  it('counts whole days between two dates (later minus earlier)', () => {
    expect(daysBetween('2026-10-28', '2026-11-25')).toBe(28);
    expect(daysBetween('2026-11-25', '2026-11-25')).toBe(0);
    expect(daysBetween('2026-11-25', '2026-11-24')).toBe(-1);
  });

  it.each(['2026-02-30', '25/11/2026', '2026-11-5', '', '2026-13-01'])(
    'rejects %p, which is not a real YYYY-MM-DD date',
    (date) => {
      expect(() => addDays(date, 1)).toThrow(RangeError);
      expect(() => mondayOf(date)).toThrow(RangeError);
      expect(() => daysBetween(date, '2026-11-25')).toThrow(RangeError);
    },
  );

  it.each([0.5, NaN, Infinity])('rejects a non-integer day count %p', (days) => {
    expect(() => addDays('2026-11-25', days)).toThrow(RangeError);
  });
});
