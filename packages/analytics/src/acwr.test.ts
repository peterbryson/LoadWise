import { AcwrModel, ewma, EwmaAcwr, RollingAcwr } from './acwr';

/** n days of the same load. */
const days = (n: number, load = 0): number[] => Array<number>(n).fill(load);

// EWMA (Williams et al., 2017): today = λ × load today + (1 − λ) × yesterday, λ = 2 / (N + 1).
// Acute N = 7: λa = 2/8 = 0.25, so 1 − λa = 0.75.
// Chronic N = 28: λc = 2/29 ≈ 0.068966, so 1 − λc = 27/29 ≈ 0.931034.
// Both start at 0 on the day before the first session.
describe('FR2: EWMA (#7 AC2)', () => {
  it('matches a hand calculation over three days with N = 7', () => {
    // day 1: 0.25 × 100 + 0.75 × 0     = 25
    // day 2: 0.25 × 0   + 0.75 × 25    = 18.75   (a rest day still decays the average)
    // day 3: 0.25 × 200 + 0.75 × 18.75 = 50 + 14.0625 = 64.0625
    expect(ewma([100, 0, 200], 7)).toBe(64.0625);
  });

  it('matches a hand calculation over two days with N = 28', () => {
    // day 1: (2/29) × 290 = 20
    // day 2: (27/29) × 20 = 540/29 ≈ 18.6207
    expect(ewma([290, 0], 28)).toBeCloseTo(540 / 29, 10);
  });

  it('is 0 before any load (the seed)', () => {
    expect(ewma([], 7)).toBe(0);
  });

  it.each([0, -7, 7.5])('rejects a window of %p days', (window) => {
    expect(() => ewma([100], window)).toThrow(RangeError);
  });
});

describe('FR2: EWMA ACWR (#7 AC2, DL-007)', () => {
  const model: AcwrModel = new EwmaAcwr();

  it('is the default EWMA model', () => {
    expect(model.name).toBe('EWMA');
  });

  it('is not shown 27 days after the first session', () => {
    // 1000 AU on day 0, then nothing: 28 values, the last one 27 days after the first session.
    expect(model.calculate([1000, ...days(27)])).toBeNull();
  });

  it('is shown 28 days after the first session and matches the closed form', () => {
    // One session of L = 1000 AU on day 0, then 28 rest days (29 values).
    // acute   = L × 0.25    × 0.75^28    ≈ 0.0793698
    // chronic = L × (2/29)  × (27/29)^28 ≈ 9.3255285
    // ACWR = (0.25 / (2/29)) × (0.75 / (27/29))^28 = 3.625 × (87/108)^28 ≈ 0.0085110
    expect(model.calculate([1000, ...days(28)])).toBeCloseTo(3.625 * (87 / 108) ** 28, 10);
    expect(model.calculate([1000, ...days(28)])).toBeCloseTo(0.008511, 6);
  });

  it('matches the closed form for steady daily load, showing the effect of the zero seed', () => {
    // L every day for 29 days (day 0 to day 28). Starting from 0, each average after n + 1 days is
    // L × (1 − (1 − λ)^(n + 1)), so L cancels:
    // ACWR = (1 − 0.75^29) / (1 − (27/29)^29) ≈ 0.9997619 / 0.8741054 ≈ 1.14375
    // Steady training reads above 1 at first because the chronic average is still filling up
    // from 0; it tends to 1 as more days pass.
    const expected = (1 - 0.75 ** 29) / (1 - (27 / 29) ** 29);
    expect(model.calculate(days(29, 500))).toBeCloseTo(expected, 10);
    expect(expected).toBeCloseTo(1.14375, 5);
  });

  it('counts the 28 days from the first session, not from the start of the series', () => {
    // Three empty days before the first session change nothing: the seed is the day before it.
    expect(model.calculate([...days(3), 1000, ...days(28)])).toBeCloseTo(3.625 * (87 / 108) ** 28, 10);
    expect(model.calculate([...days(3), 1000, ...days(27)])).toBeNull();
  });

  it('is not shown for an athlete with no sessions (chronic load is 0)', () => {
    expect(model.calculate([])).toBeNull();
    expect(model.calculate(days(60))).toBeNull();
  });

  it.each([-1, NaN, Infinity])('rejects a daily load of %p', (bad) => {
    expect(() => model.calculate([100, bad, ...days(28)])).toThrow(RangeError);
  });
});

describe('FR2: rolling-average ACWR, the alternative model (#7, DL-007)', () => {
  const model: AcwrModel = new RollingAcwr();

  it('is named ROLLING', () => {
    expect(model.name).toBe('ROLLING');
  });

  it('matches a hand calculation: mean of last 7 days ÷ mean of last 28 days (coupled)', () => {
    // Day 0: 100 AU (first session). Days 1 to 21: 0. Days 22 to 28: 70 each. Today is day 28.
    // acute   = (7 × 70) / 7  = 70
    // chronic = days 1 to 28 = (21 × 0 + 7 × 70) / 28 = 490 / 28 = 17.5 (day 0 is outside it)
    // ACWR = 70 / 17.5 = 4
    expect(model.calculate([100, ...days(21), ...days(7, 70)])).toBe(4);
  });

  it('is not shown 27 days after the first session', () => {
    expect(model.calculate([100, ...days(20), ...days(7, 70)])).toBeNull();
  });

  it('is not shown when nothing was logged in the last 28 days (chronic load is 0)', () => {
    // First session 40 days ago, nothing since: 0 / 0 has no meaning, so no ratio.
    expect(model.calculate([100, ...days(40)])).toBeNull();
  });

  it('gives a different answer from EWMA on the same days, so the models really are swappable', () => {
    const series = [100, ...days(21), ...days(7, 70)];
    const ewmaValue = new EwmaAcwr().calculate(series);
    expect(ewmaValue).not.toBeNull();
    expect(ewmaValue).not.toBeCloseTo(4, 1);
  });

  it.each([-1, NaN])('rejects a daily load of %p', (bad) => {
    expect(() => model.calculate([100, bad, ...days(28)])).toThrow(RangeError);
  });
});
