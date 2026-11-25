import {
  WellnessEntry,
  wellnessBaseline,
  wellnessSevenDayAverage,
  wellnessTrend,
} from './wellness-baseline';

// All fixtures use today = Wed 2026-11-25. The baseline window is the 28 days before today:
// 2026-10-28 (today - 28) to 2026-11-24 (today - 1). Today itself is never in the baseline (DL-007).
const TODAY = '2026-11-25';

/** One check-in with the same score on every item, unless an item is overridden. */
function entry(date: string, score: number, overrides: Partial<WellnessEntry> = {}): WellnessEntry {
  return { date, sleep: score, soreness: score, fatigue: score, stress: score, ...overrides };
}

/** The date `days` before 2026-11-25. Written out by hand in fixtures where the exact day matters. */
function daysBefore(days: number): string {
  const d = new Date(Date.UTC(2026, 10, 25 - days));
  return d.toISOString().slice(0, 10);
}

/**
 * 15 check-ins on every other day or so, with gaps (missing days are skipped, not zero).
 * Sleep: seven 3s, seven 5s and one 4.
 *   mean = (7×3 + 7×5 + 4) / 15 = 60 / 15 = 4
 *   squared deviations = 7×1 + 7×1 + 0 = 14; sample variance = 14 / (15 - 1) = 1; SD = 1
 * The other items are 4 every day: mean 4, SD 0.
 */
const fifteenCheckIns: WellnessEntry[] = [1, 2, 4, 5, 7, 9, 10, 12, 14, 16, 18, 20, 23, 25, 28].map(
  (days, index) => {
    const sleep = index === 14 ? 4 : index % 2 === 0 ? 3 : 5;
    return entry(daysBefore(days), 4, { sleep });
  },
);

describe('FR2: wellness baseline (#9 AC1, DL-007)', () => {
  it('matches the hand-calculated mean and sample SD of each item (sleep mean 4, SD 1)', () => {
    const baseline = wellnessBaseline(fifteenCheckIns, TODAY);

    expect(baseline).not.toBeNull();
    expect(baseline?.count).toBe(15);
    expect(baseline?.items.sleep.mean).toBeCloseTo(4, 10);
    expect(baseline?.items.sleep.sd).toBeCloseTo(1, 10);
    expect(baseline?.items.soreness).toEqual({ mean: 4, sd: 0 });
  });

  it('needs at least 14 check-ins: 13 gives no baseline', () => {
    expect(wellnessBaseline(fifteenCheckIns.slice(0, 13), TODAY)).toBeNull();
  });

  it('gives a baseline at exactly 14 check-ins', () => {
    // First 14 fixtures: seven 3s and seven 5s. mean = 56 / 14 = 4;
    // squared deviations = 14; sample variance = 14 / 13; SD = sqrt(14 / 13) ≈ 1.0377.
    const baseline = wellnessBaseline(fifteenCheckIns.slice(0, 14), TODAY);

    expect(baseline?.count).toBe(14);
    expect(baseline?.items.sleep.mean).toBeCloseTo(4, 10);
    expect(baseline?.items.sleep.sd).toBeCloseTo(Math.sqrt(14 / 13), 10);
  });

  it('gives SD 0 when every check-in has the same score', () => {
    const same = Array.from({ length: 14 }, (_, i) => entry(daysBefore(i + 1), 3));

    expect(wellnessBaseline(same, TODAY)?.items.stress).toEqual({ mean: 3, sd: 0 });
  });

  it("leaves today's check-in out of the baseline", () => {
    const withToday = [...fifteenCheckIns, entry(TODAY, 1)];

    expect(wellnessBaseline(withToday, TODAY)).toEqual(wellnessBaseline(fifteenCheckIns, TODAY));
  });

  it('includes today - 28 (2026-10-28) and leaves out today - 29 (2026-10-27) and future days', () => {
    const thirteen = fifteenCheckIns.slice(0, 13);

    expect(wellnessBaseline([...thirteen, entry('2026-10-27', 1)], TODAY)).toBeNull();
    expect(wellnessBaseline([...thirteen, entry('2026-11-26', 1)], TODAY)).toBeNull();
    expect(wellnessBaseline([...thirteen, entry('2026-10-28', 1)], TODAY)?.count).toBe(14);
  });

  it('returns null with no check-ins at all', () => {
    expect(wellnessBaseline([], TODAY)).toBeNull();
  });

  it.each(['25/11/2026', '2026-11-31', '2026-13-01', ''])('rejects an invalid today %p', (today) => {
    expect(() => wellnessBaseline([], today)).toThrow(RangeError);
  });

  it('rejects an entry with an invalid date', () => {
    expect(() => wellnessBaseline([entry('2026-11-xx', 3)], TODAY)).toThrow(RangeError);
  });
});

describe('FR2: wellness 7-day average (#9 AC3)', () => {
  it('averages today and the 6 days before, skipping missing days', () => {
    // Window 2026-11-19 to 2026-11-25. Sleep: (2 + 3 + 4) / 3 = 3. The 5 on 2026-11-18 is outside.
    const entries = [
      entry('2026-11-25', 4, { sleep: 2 }),
      entry('2026-11-22', 4, { sleep: 3 }),
      entry('2026-11-19', 4, { sleep: 4 }),
      entry('2026-11-18', 4, { sleep: 5 }),
    ];

    const average = wellnessSevenDayAverage(entries, TODAY);

    expect(average?.count).toBe(3);
    expect(average?.items.sleep).toBeCloseTo(3, 10);
    expect(average?.items.fatigue).toBe(4);
  });

  it('returns null when there is no check-in in the last 7 days', () => {
    expect(wellnessSevenDayAverage([entry('2026-11-18', 4)], TODAY)).toBeNull();
  });
});

describe('FR2: wellness trend for the Trends tab (#9 AC3)', () => {
  it('gives one point per week, oldest first, each with its 7-day average and baseline', () => {
    const trend = wellnessTrend(fifteenCheckIns, TODAY, 2);

    expect(trend.map((week) => week.endDate)).toEqual(['2026-11-18', '2026-11-25']);
    // This week: window 2026-11-19 to 2026-11-25 has check-ins at today - 1, 2, 4, 5
    // (sleep 3, 5, 3, 5), so the average is 16 / 4 = 4. Its baseline is the 15-check-in baseline.
    expect(trend[1].average?.count).toBe(4);
    expect(trend[1].average?.items.sleep).toBeCloseTo(4, 10);
    expect(trend[1].baseline).toEqual(wellnessBaseline(fifteenCheckIns, TODAY));
    // Last week ends 2026-11-18 (today - 7); its baseline window (2026-10-21 to 2026-11-17)
    // holds the check-ins at today - 9 to today - 28: 10 of them, so no baseline yet.
    expect(trend[0].baseline).toBeNull();
  });

  it('returns weeks with no data as null averages rather than zero', () => {
    const trend = wellnessTrend([], TODAY, 3);

    expect(trend).toHaveLength(3);
    expect(trend.every((week) => week.average === null && week.baseline === null)).toBe(true);
  });

  it.each([0, -1, 1.5, 53])('rejects %p weeks', (weeks) => {
    expect(() => wellnessTrend([], TODAY, weeks)).toThrow(RangeError);
  });
});
