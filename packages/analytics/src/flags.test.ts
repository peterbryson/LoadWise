import { DEFAULT_FLAG_THRESHOLDS, evaluateFlags } from './flags';
import type { WellnessBaseline, WellnessScores } from './wellness-baseline';

const goodDay: WellnessScores = { sleep: 4, soreness: 4, fatigue: 4, stress: 4 };

/** Every item has mean 4 and SD 1, so the wellness threshold is 4 - 1.5 × 1 = 2.5. */
const baseline: WellnessBaseline = {
  count: 20,
  items: {
    sleep: { mean: 4, sd: 1 },
    soreness: { mean: 4, sd: 1 },
    fatigue: { mean: 4, sd: 1 },
    stress: { mean: 4, sd: 1 },
  },
};

const noWellness = { wellnessToday: null, baseline: null };

describe('FR2: flag thresholds are configurable hypotheses (#9 AC1)', () => {
  it('defaults to ACWR above 1.5 and wellness more than 1.5 SD below baseline', () => {
    expect(DEFAULT_FLAG_THRESHOLDS).toEqual({ acwrHigh: 1.5, wellnessSdBelow: 1.5 });
  });

  it.each([
    { acwrHigh: 0, wellnessSdBelow: 1.5 },
    { acwrHigh: NaN, wellnessSdBelow: 1.5 },
    { acwrHigh: 1.5, wellnessSdBelow: -1 },
    { acwrHigh: 1.5, wellnessSdBelow: Infinity },
  ])('rejects invalid thresholds %p', (thresholds) => {
    expect(() => evaluateFlags({ acwr: 1, ...noWellness }, thresholds)).toThrow(RangeError);
  });
});

describe('FR2: ACWR flag (#9 AC1, AC2)', () => {
  it('does not flag ACWR of exactly 1.5: the rule is strictly above', () => {
    expect(evaluateFlags({ acwr: 1.5, ...noWellness })).toEqual([]);
  });

  it('flags ACWR 1.51 with its reason, value and threshold', () => {
    expect(evaluateFlags({ acwr: 1.51, ...noWellness })).toEqual([
      {
        rule: 'ACWR_HIGH',
        metric: 'acwr',
        value: 1.51,
        threshold: 1.5,
        reason: 'Your acute:chronic workload ratio is 1.51, above the 1.5 guide.',
      },
    ]);
  });

  it('raises no ACWR flag while ACWR is not available yet (null)', () => {
    expect(evaluateFlags({ acwr: null, ...noWellness })).toEqual([]);
  });

  it('uses a configured ACWR threshold', () => {
    expect(evaluateFlags({ acwr: 1.4, ...noWellness }, { acwrHigh: 1.3, wellnessSdBelow: 1.5 })).toHaveLength(1);
  });

  it('rejects a non-finite or negative ACWR', () => {
    expect(() => evaluateFlags({ acwr: NaN, ...noWellness })).toThrow(RangeError);
    expect(() => evaluateFlags({ acwr: -0.1, ...noWellness })).toThrow(RangeError);
  });
});

describe('FR2: wellness flag (#9 AC1, AC2)', () => {
  it('flags an item more than 1.5 SD below its baseline with reason, value and threshold', () => {
    // Sleep 2 < 4 - 1.5 × 1 = 2.5, so it is flagged; the other items (4) are not.
    const flags = evaluateFlags({ acwr: null, wellnessToday: { ...goodDay, sleep: 2 }, baseline });

    expect(flags).toEqual([
      {
        rule: 'WELLNESS_LOW',
        metric: 'sleep',
        value: 2,
        threshold: 2.5,
        reason: 'Your sleep score today is 2, more than 1.5 SD below your usual 4.0 (guide: 2.5).',
      },
    ]);
  });

  it('does not flag a score exactly 1.5 SD below baseline: the rule is strictly more than', () => {
    // Mean 3.5, SD 1: threshold 3.5 - 1.5 = 2. A score of 2 is exactly on it; 1 is below.
    const onBoundary: WellnessBaseline = { ...baseline, items: { ...baseline.items, fatigue: { mean: 3.5, sd: 1 } } };

    expect(evaluateFlags({ acwr: null, wellnessToday: { ...goodDay, fatigue: 2 }, baseline: onBoundary })).toEqual([]);
    expect(
      evaluateFlags({ acwr: null, wellnessToday: { ...goodDay, fatigue: 1 }, baseline: onBoundary }),
    ).toHaveLength(1);
  });

  it('with SD 0, flags any score below the mean and not a score equal to it', () => {
    // Threshold = 4 - 1.5 × 0 = 4.
    const steady: WellnessBaseline = { ...baseline, items: { ...baseline.items, stress: { mean: 4, sd: 0 } } };

    expect(evaluateFlags({ acwr: null, wellnessToday: goodDay, baseline: steady })).toEqual([]);
    expect(evaluateFlags({ acwr: null, wellnessToday: { ...goodDay, stress: 3 }, baseline: steady })).toEqual([
      expect.objectContaining({ rule: 'WELLNESS_LOW', metric: 'stress', value: 3, threshold: 4 }),
    ]);
  });

  it('raises one flag per low item, in a fixed item order', () => {
    const flags = evaluateFlags({ acwr: null, wellnessToday: { sleep: 1, soreness: 4, fatigue: 2, stress: 1 }, baseline });

    expect(flags.map((flag) => flag.metric)).toEqual(['sleep', 'fatigue', 'stress']);
  });

  it('uses a configured number of SDs', () => {
    // 2 SD below: threshold 4 - 2 × 1 = 2. A score of 2 is not flagged.
    const thresholds = { acwrHigh: 1.5, wellnessSdBelow: 2 };

    expect(evaluateFlags({ acwr: null, wellnessToday: { ...goodDay, sleep: 2 }, baseline }, thresholds)).toEqual([]);
  });

  it('raises no wellness flag without a baseline (fewer than 14 check-ins) or without a check-in today', () => {
    expect(evaluateFlags({ acwr: null, wellnessToday: { ...goodDay, sleep: 1 }, baseline: null })).toEqual([]);
    expect(evaluateFlags({ acwr: null, wellnessToday: null, baseline })).toEqual([]);
  });

  it('lists the ACWR flag before wellness flags', () => {
    const flags = evaluateFlags({ acwr: 1.62, wellnessToday: { ...goodDay, sleep: 1 }, baseline });

    expect(flags.map((flag) => flag.rule)).toEqual(['ACWR_HIGH', 'WELLNESS_LOW']);
  });
});

describe('FR2/DL-006: flag wording is decision support, never diagnostic', () => {
  it('never mentions injury, risk, diagnosis or what to do', () => {
    const flags = evaluateFlags({ acwr: 2, wellnessToday: { sleep: 1, soreness: 1, fatigue: 1, stress: 1 }, baseline });

    for (const flag of flags) {
      expect(flag.reason).not.toMatch(/injur|risk|diagnos|rest|reduce|return to play/i);
    }
  });
});
