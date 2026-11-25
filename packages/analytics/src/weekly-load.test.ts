import { dailyLoads, LoggedSession, usualWeek, weeklyLoads } from './weekly-load';

/** Shorthand for a logged session. Its load is rpe × minutes (AU). */
function s(date: string, rpe: number, durationMinutes: number): LoggedSession {
  return { date, rpe, durationMinutes };
}

describe('FR2: daily load series (#7 AC2)', () => {
  it('sums sessions on the same day and fills days without a session with 0', () => {
    // 2026-11-20: 7 × 60 = 420 and 5 × 30 = 150, so 420 + 150 = 570
    // 2026-11-22: 4 × 45 = 180
    // 2026-11-18 is before `from` and 2026-11-24 is after `to`, so neither counts.
    const sessions = [
      s('2026-11-20', 7, 60),
      s('2026-11-18', 9, 90),
      s('2026-11-22', 4, 45),
      s('2026-11-20', 5, 30),
      s('2026-11-24', 9, 90),
    ];
    // Days:              19  20   21  22   23
    expect(dailyLoads(sessions, '2026-11-19', '2026-11-23')).toEqual([0, 570, 0, 180, 0]);
  });

  it('returns one zero per day when there are no sessions', () => {
    expect(dailyLoads([], '2026-11-23', '2026-11-25')).toEqual([0, 0, 0]);
  });

  it('returns a single day when from and to are the same day', () => {
    expect(dailyLoads([s('2026-11-25', 6, 50)], '2026-11-25', '2026-11-25')).toEqual([300]);
  });

  it('rejects a range that ends before it starts', () => {
    expect(() => dailyLoads([], '2026-11-25', '2026-11-24')).toThrow(RangeError);
  });

  it.each([
    ['an RPE of 11', s('2026-11-25', 11, 60)],
    ['a duration of 0', s('2026-11-25', 5, 0)],
    ['an invalid date', s('2026-11-31', 5, 60)],
  ])('rejects a session with %s, like sessionLoad', (_case, bad) => {
    expect(() => dailyLoads([bad], '2026-11-23', '2026-11-25')).toThrow(RangeError);
  });
});

// Weeks run Monday to Sunday. today = Wednesday 2026-11-25, so the six weeks start on
// 19 Oct, 26 Oct, 2 Nov, 9 Nov, 16 Nov and 23 Nov (this week, so far).
const today = '2026-11-25';
const season = [
  s('2026-10-18', 7, 60), // Sun 18 Oct: 420, the week before the window, not shown
  s('2026-10-19', 5, 60), // Mon 19 Oct: 300 ┐ week of 19 Oct = 300 + 300 = 600
  s('2026-10-25', 6, 50), // Sun 25 Oct: 300 ┘ (Sunday is the last day of its week)
  s('2026-10-26', 8, 60), // Mon 26 Oct: 480   week of 26 Oct = 480
  //                                           week of 2 Nov: nothing logged = 0
  s('2026-11-10', 7, 60), // Tue 10 Nov: 420 ┐ week of 9 Nov = 420 + 150 = 570
  s('2026-11-10', 5, 30), // Tue 10 Nov: 150 ┘ (two sessions on one day)
  s('2026-11-22', 4, 45), // Sun 22 Nov: 180   week of 16 Nov = 180
  s('2026-11-23', 6, 60), // Mon 23 Nov: 360 ┐ this week so far = 360 + 60 = 420
  s('2026-11-25', 3, 20), // Wed 25 Nov:  60 ┘
  s('2026-11-26', 9, 90), // Thu 26 Nov: after today, so not counted
];

describe('FR2: weekly load, Monday to Sunday (#7 AC2, AC3)', () => {
  it('matches the hand-calculated six weeks, with this week marked as partial', () => {
    expect(weeklyLoads(season, today, 6)).toEqual([
      { weekStart: '2026-10-19', load: 600, partial: false },
      { weekStart: '2026-10-26', load: 480, partial: false },
      { weekStart: '2026-11-02', load: 0, partial: false },
      { weekStart: '2026-11-09', load: 570, partial: false },
      { weekStart: '2026-11-16', load: 180, partial: false },
      { weekStart: '2026-11-23', load: 420, partial: true },
    ]);
  });

  it('returns zero weeks for an athlete with no sessions', () => {
    expect(weeklyLoads([], today, 2)).toEqual([
      { weekStart: '2026-11-16', load: 0, partial: false },
      { weekStart: '2026-11-23', load: 0, partial: true },
    ]);
  });

  it('still treats the week as partial on its Sunday, because today is not over', () => {
    expect(weeklyLoads(season, '2026-11-29', 1)).toEqual([
      { weekStart: '2026-11-23', load: 420 + 810, partial: true }, // 26 Nov (9 × 90 = 810) is now in the past
    ]);
  });

  it('starts a new week on Monday', () => {
    expect(weeklyLoads([s('2026-11-29', 5, 60), s('2026-11-30', 4, 30)], '2026-11-30', 2)).toEqual([
      { weekStart: '2026-11-23', load: 300, partial: false },
      { weekStart: '2026-11-30', load: 120, partial: true },
    ]);
  });

  it.each([0, -1, 2.5])('rejects %p weeks', (weeks) => {
    expect(() => weeklyLoads(season, today, weeks)).toThrow(RangeError);
  });
});

describe('FR2: usual week = mean of the last 4 completed weeks (#7, DL-007)', () => {
  it('matches the hand-calculated mean, ignoring this partial week', () => {
    // Completed weeks before 23 Nov: 26 Oct 480, 2 Nov 0, 9 Nov 570, 16 Nov 180.
    // (480 + 0 + 570 + 180) / 4 = 1230 / 4 = 307.5. The empty week counts as 0.
    expect(usualWeek(season, today)).toBe(307.5);
  });

  it('is shown when the oldest of the 4 weeks starts on the day of the first session', () => {
    // First session Mon 26 Oct; the 4 weeks are 26 Oct to 22 Nov: (480 + 0 + 0 + 0) / 4 = 120
    expect(usualWeek([s('2026-10-26', 8, 60)], today)).toBe(120);
  });

  it('is not shown yet when the first session is after the start of the oldest week', () => {
    // First session Tue 27 Oct: the week of 26 Oct includes a day before the athlete started,
    // so only 3 completed weeks have passed since the first entry.
    expect(usualWeek([s('2026-10-27', 8, 60)], today)).toBeNull();
  });

  it('is not shown for an athlete with no sessions, or only future ones', () => {
    expect(usualWeek([], today)).toBeNull();
    expect(usualWeek([s('2026-11-26', 5, 60)], today)).toBeNull();
  });
});
