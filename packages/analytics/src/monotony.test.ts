import { monotony, strain } from './monotony';

// Foster (1998): monotony = mean daily load ÷ standard deviation of daily load over 7 days;
// strain = 7-day load × monotony. Both use the last 7 values of the daily series (today last).
describe('FR2: training monotony and strain (#7)', () => {
  // Last 7 days: 400, 50, 150, 250, 150, 200, 200 (sum 1400). The 9999 is day 8, outside the window.
  const week = [9999, 400, 50, 150, 250, 150, 200, 200];

  it('matches a hand-calculated monotony using the population SD', () => {
    // mean = 1400 / 7 = 200
    // deviations: 200, −150, −50, 50, −50, 0, 0
    // squares: 40000 + 22500 + 2500 + 2500 + 2500 + 0 + 0 = 70000
    // population variance = 70000 / 7 = 10000, so SD = 100
    // monotony = 200 / 100 = 2
    expect(monotony(week)).toBe(2);
  });

  it('matches a hand-calculated strain', () => {
    // strain = 1400 × 2 = 2800
    expect(strain(week)).toBe(2800);
  });

  it('includes rest days as zero load', () => {
    // 0, 0, 0, 180, 360, 0, 60: mean = 600 / 7 ≈ 85.714
    // Σx² = 180² + 360² + 60² = 32400 + 129600 + 3600 = 165600
    // variance = 165600 / 7 − 85.714² ≈ 23657.14 − 7346.94 = 16310.20, so SD ≈ 127.711
    // monotony ≈ 85.714 / 127.711 ≈ 0.67116; strain ≈ 600 × 0.67116 ≈ 402.69
    const rest = [0, 0, 0, 180, 360, 0, 60];
    expect(monotony(rest)).toBeCloseTo(0.67116, 5);
    expect(strain(rest)).toBeCloseTo(402.694, 3);
  });

  it('is not shown when every day has the same load (SD is 0, so the ratio has no value)', () => {
    expect(monotony(Array<number>(7).fill(100))).toBeNull();
    expect(strain(Array<number>(7).fill(100))).toBeNull();
  });

  it('is not shown for a week with no load at all', () => {
    expect(monotony(Array<number>(7).fill(0))).toBeNull();
    expect(strain(Array<number>(7).fill(0))).toBeNull();
  });

  it('rejects a series shorter than 7 days', () => {
    expect(() => monotony([100, 200, 300])).toThrow(RangeError);
    expect(() => strain([100, 200, 300])).toThrow(RangeError);
  });

  it.each([-5, NaN])('rejects a daily load of %p', (bad) => {
    expect(() => monotony([100, 200, 300, bad, 100, 200, 300])).toThrow(RangeError);
  });
});
