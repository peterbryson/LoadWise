import type { Flag, FlagChecks } from './flags';
import { athleteStatus, compareOverviewRows, staffFlagReason } from './squad-overview';

const checked: FlagChecks = { acwr: 'checked', wellness: 'checked' };

const acwrFlag: Flag = {
  rule: 'ACWR_HIGH',
  metric: 'acwr',
  value: 1.6234,
  threshold: 1.5,
  reason: 'Your acute:chronic workload ratio is 1.62, above the 1.5 guide.',
};

// Baseline mean 4, SD 1, guide 1.5 SD below: threshold 4 − 1.5 × 1 = 2.5; today's sleep 2.
const sleepFlag: Flag = {
  rule: 'WELLNESS_LOW',
  metric: 'sleep',
  value: 2,
  threshold: 2.5,
  reason: 'Your sleep score today is 2, more than 1.5 SD below your usual 4.0 (guide: 2.5).',
};

describe('FR4: athlete status in the squad overview (#10 AC1)', () => {
  it('is flagged when any flag was raised, even if a check could not run', () => {
    expect(athleteStatus([acwrFlag], checked)).toBe('flagged');
    expect(athleteStatus([acwrFlag], { acwr: 'checked', wellness: 'no-check-in' })).toBe('flagged');
  });

  it('is clear only when both checks ran and nothing was flagged', () => {
    expect(athleteStatus([], checked)).toBe('clear');
  });

  it('is incomplete, never clear, when a check could not run (no false all-clear, DL-020)', () => {
    expect(athleteStatus([], { acwr: 'unavailable', wellness: 'checked' })).toBe('incomplete');
    expect(athleteStatus([], { acwr: 'checked', wellness: 'no-baseline' })).toBe('incomplete');
    expect(athleteStatus([], { acwr: 'checked', wellness: 'no-check-in' })).toBe('incomplete');
  });
});

describe('FR4: flag reasons for staff (#10 AC1, DL-022)', () => {
  it('describes a load ratio flag with its value and guide, rounded as the athlete sees it', () => {
    expect(staffFlagReason(acwrFlag, { showScores: false, sdBelow: 1.5 })).toBe(
      'Load ratio (ACWR) is 1.62, above the 1.5 guide.',
    );
  });

  it('keeps a value just over the guide visibly above it (1.504 is not shown as 1.50)', () => {
    const close: Flag = { ...acwrFlag, value: 1.504 };
    expect(staffFlagReason(close, { showScores: true, sdBelow: 1.5 })).toBe(
      'Load ratio (ACWR) is 1.504, above the 1.5 guide.',
    );
  });

  it('gives roles that may see scores the score and the guide', () => {
    expect(staffFlagReason(sleepFlag, { showScores: true, sdBelow: 1.5 })).toBe(
      'Sleep today is 2, more than 1.5 SD below their usual (guide: 2.5).',
    );
  });

  it('gives a coach the wellness status only, with no score or guide value', () => {
    const reason = staffFlagReason(sleepFlag, { showScores: false, sdBelow: 1.5 });
    expect(reason).toBe('Sleep today is more than 1.5 SD below their usual.');
    // The rule ("1.5 SD") is shown; the athlete's score (2) and the guide value (2.5) are not.
    expect(reason).not.toContain('2.5');
    expect(reason).not.toMatch(/\b2\b/);
    expect(reason).not.toMatch(/guide/);
  });

  it('names each wellness item in plain words', () => {
    for (const metric of ['soreness', 'fatigue', 'stress'] as const) {
      const flag: Flag = { ...sleepFlag, metric };
      const label = metric[0].toUpperCase() + metric.slice(1);
      expect(staffFlagReason(flag, { showScores: false, sdBelow: 2 })).toBe(
        `${label} today is more than 2 SD below their usual.`,
      );
    }
  });

  it('never uses advice, prediction or diagnosis wording', () => {
    const reasons = [acwrFlag, sleepFlag].flatMap((flag) => [
      staffFlagReason(flag, { showScores: true, sdBelow: 1.5 }),
      staffFlagReason(flag, { showScores: false, sdBelow: 1.5 }),
    ]);
    for (const reason of reasons) {
      expect(reason).not.toMatch(/injur|risk|diagnos|\brest\b|reduce|return to play|should/i);
    }
  });
});

describe('FR4: squad overview order (#10 AC1: spot problems at a glance)', () => {
  const row = (displayName: string, status: 'flagged' | 'incomplete' | 'clear' | 'not-sharing', flagCount = 0) => ({
    displayName,
    status,
    flagCount,
  });

  it('puts flagged athletes first, most flags first, then incomplete, clear and not sharing', () => {
    const rows = [
      row('Ava', 'clear'),
      row('Ben', 'not-sharing'),
      row('Cal', 'flagged', 1),
      row('Dee', 'incomplete'),
      row('Eve', 'flagged', 3),
    ];
    expect([...rows].sort(compareOverviewRows).map((r) => r.displayName)).toEqual(['Eve', 'Cal', 'Dee', 'Ava', 'Ben']);
  });

  it('orders athletes with the same status and flag count by name', () => {
    const rows = [row('zoe', 'clear'), row('Adam', 'clear'), row('Mia', 'clear')];
    expect([...rows].sort(compareOverviewRows).map((r) => r.displayName)).toEqual(['Adam', 'Mia', 'zoe']);
  });
});
