import { EwmaAcwr, RollingAcwr } from './acwr';
import { loadSummary } from './load-summary';
import { monotony, strain } from './monotony';
import { dailyLoads, LoggedSession } from './weekly-load';

function s(date: string, rpe: number, durationMinutes: number): LoggedSession {
  return { date, rpe, durationMinutes };
}

describe('FR2: load summary for the Trends tab (#7 AC2, AC3)', () => {
  it('shows the empty state for an athlete with no sessions', () => {
    expect(loadSummary([], '2026-11-25')).toEqual({
      today: '2026-11-25',
      weeks: [
        { weekStart: '2026-10-19', load: 0, partial: false },
        { weekStart: '2026-10-26', load: 0, partial: false },
        { weekStart: '2026-11-02', load: 0, partial: false },
        { weekStart: '2026-11-09', load: 0, partial: false },
        { weekStart: '2026-11-16', load: 0, partial: false },
        { weekStart: '2026-11-23', load: 0, partial: true },
      ],
      usualWeek: null,
      acwr: { model: 'EWMA', value: null, availableFrom: null },
      monotony: null,
      strain: null,
    });
  });

  // One session: Wed 28 Oct, RPE 10 × 100 min = 1000 AU. 28 Oct + 28 days = 25 Nov.
  const single = [s('2026-10-28', 10, 100)];

  it('says when ACWR will appear, 27 days after the first session', () => {
    const summary = loadSummary(single, '2026-11-24');
    expect(summary.acwr).toEqual({ model: 'EWMA', value: null, availableFrom: '2026-11-25' });
  });

  it('shows ACWR from 28 days after the first session (same closed form as the EWMA fixture)', () => {
    const summary = loadSummary(single, '2026-11-25');
    expect(summary.acwr.model).toBe('EWMA');
    expect(summary.acwr.availableFrom).toBe('2026-11-25');
    expect(summary.acwr.value).toBeCloseTo(3.625 * (87 / 108) ** 28, 10);
    // The week of 26 Oct includes Mon and Tue before the first session, so no usual week yet.
    expect(summary.usualWeek).toBeNull();
    // Nothing in the last 7 days: SD is 0, so no monotony or strain.
    expect(summary.monotony).toBeNull();
    expect(summary.strain).toBeNull();
    expect(summary.weeks.map((week) => week.load)).toEqual([0, 1000, 0, 0, 0, 0]);
  });

  // The weekly-load fixture: first session Sun 18 Oct, today Wed 25 Nov (38 days later).
  const season = [
    s('2026-10-18', 7, 60),
    s('2026-10-19', 5, 60),
    s('2026-10-25', 6, 50),
    s('2026-10-26', 8, 60),
    s('2026-11-10', 7, 60),
    s('2026-11-10', 5, 30),
    s('2026-11-22', 4, 45),
    s('2026-11-23', 6, 60),
    s('2026-11-25', 3, 20),
    s('2026-11-26', 9, 90), // after today: ignored everywhere
  ];

  it('combines the hand-calculated weekly load, usual week and monotony fixtures', () => {
    const summary = loadSummary(season, '2026-11-25');

    expect(summary.weeks.map((week) => week.load)).toEqual([600, 480, 0, 570, 180, 420]);
    expect(summary.usualWeek).toBe(307.5);
    // 18 Oct + 28 days = 15 Nov
    expect(summary.acwr.availableFrom).toBe('2026-11-15');
    // Last 7 days (19 to 25 Nov): 0, 0, 0, 180, 360, 0, 60, the rest-day monotony fixture.
    expect(summary.monotony).toBeCloseTo(0.67116, 5);
    expect(summary.strain).toBeCloseTo(402.694, 3);
  });

  it('passes the model every day from the first session to today', () => {
    const summary = loadSummary(season, '2026-11-25');
    const daily = dailyLoads(season, '2026-10-18', '2026-11-25');

    expect(daily).toHaveLength(39);
    expect(summary.acwr.value).toBe(new EwmaAcwr().calculate(daily));
    expect(summary.monotony).toBe(monotony(daily));
    expect(summary.strain).toBe(strain(daily));
  });

  it('uses another ACWR model when one is passed in (strategy pattern)', () => {
    const summary = loadSummary(season, '2026-11-25', { acwrModel: new RollingAcwr() });
    const daily = dailyLoads(season, '2026-10-18', '2026-11-25');

    expect(summary.acwr.model).toBe('ROLLING');
    expect(summary.acwr.value).toBe(new RollingAcwr().calculate(daily));
  });

  it('shows a different number of weeks when asked', () => {
    expect(loadSummary(season, '2026-11-25', { weeks: 2 }).weeks).toHaveLength(2);
  });

  it('treats an athlete whose only session is in the future as having no sessions', () => {
    const summary = loadSummary([s('2026-11-26', 5, 60)], '2026-11-25');
    expect(summary.acwr).toEqual({ model: 'EWMA', value: null, availableFrom: null });
    expect(summary.weeks.every((week) => week.load === 0)).toBe(true);
  });

  it('rejects an invalid today', () => {
    expect(() => loadSummary(season, '25/11/2026')).toThrow(RangeError);
  });
});
