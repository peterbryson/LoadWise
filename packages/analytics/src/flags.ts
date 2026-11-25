import { WELLNESS_ITEMS } from './wellness-baseline';
import type { WellnessBaseline, WellnessItem, WellnessScores } from './wellness-baseline';

/**
 * The flag rules (FR 2, #9). These numbers are starting hypotheses to be tested in the Sprint 4
 * flag spike (DL-007), not clinical thresholds, so callers pass them in.
 */
export interface FlagThresholds {
  /** Flag when ACWR is strictly above this. */
  acwrHigh: number;
  /** Flag a wellness item when today's score is more than this many SDs below its baseline mean. */
  wellnessSdBelow: number;
}

export const DEFAULT_FLAG_THRESHOLDS: Readonly<FlagThresholds> = { acwrHigh: 1.5, wellnessSdBelow: 1.5 };

export type FlagRule = 'ACWR_HIGH' | 'WELLNESS_LOW';

/** A flag always carries what was measured, the line it crossed and a plain-language reason. */
export interface Flag {
  rule: FlagRule;
  metric: 'acwr' | WellnessItem;
  value: number;
  threshold: number;
  reason: string;
}

export interface FlagInputs {
  /** EWMA ACWR for today, or null while it is not shown yet (first 28 days, DL-007). */
  acwr: number | null;
  /** Today's check-in, or null if the athlete has not checked in today. */
  wellnessToday: WellnessScores | null;
  /** From wellnessBaseline(); null until there are 14 check-ins. */
  baseline: WellnessBaseline | null;
}

/**
 * Which rules could actually be evaluated today. An empty flag list only means "nothing is
 * outside the guides" when both checks ran, so screens must not show an all-clear otherwise.
 */
export interface FlagChecks {
  acwr: 'checked' | 'unavailable';
  /** no-baseline takes priority: without 14 check-ins, checking in today still cannot be compared. */
  wellness: 'checked' | 'no-baseline' | 'no-check-in';
}

/** Mirrors the early returns in acwrFlag() and wellnessFlags(), so it says which rules ran. */
export function flagChecks({ acwr, wellnessToday, baseline }: FlagInputs): FlagChecks {
  let wellness: FlagChecks['wellness'] = 'checked';
  if (baseline === null) wellness = 'no-baseline';
  else if (wellnessToday === null) wellness = 'no-check-in';
  return { acwr: acwr === null ? 'unavailable' : 'checked', wellness };
}

function checkThresholds({ acwrHigh, wellnessSdBelow }: FlagThresholds): void {
  if (!Number.isFinite(acwrHigh) || acwrHigh <= 0) {
    throw new RangeError(`acwrHigh must be a positive number, got ${acwrHigh}`);
  }
  if (!Number.isFinite(wellnessSdBelow) || wellnessSdBelow < 0) {
    throw new RangeError(`wellnessSdBelow must be zero or more, got ${wellnessSdBelow}`);
  }
}

function acwrFlag(acwr: number | null, acwrHigh: number): Flag | null {
  if (acwr === null) return null;
  if (!Number.isFinite(acwr) || acwr < 0) throw new RangeError(`ACWR must be zero or more, got ${acwr}`);
  if (acwr <= acwrHigh) return null;
  return {
    rule: 'ACWR_HIGH',
    metric: 'acwr',
    value: acwr,
    threshold: acwrHigh,
    reason: `Your acute:chronic workload ratio is ${acwr.toFixed(2)}, above the ${acwrHigh} guide.`,
  };
}

function wellnessFlags(
  today: WellnessScores | null,
  baseline: WellnessBaseline | null,
  sdBelow: number,
): Flag[] {
  // DL-007: a flag can only fire once its metric is shown, which needs a baseline.
  if (today === null || baseline === null) return [];
  const flags: Flag[] = [];
  for (const item of WELLNESS_ITEMS) {
    const { mean, sd } = baseline.items[item];
    const threshold = mean - sdBelow * sd;
    // "More than 1.5 SD below" is strict, so a score exactly on the threshold is not flagged.
    // With SD 0 (the same answer every day) the threshold is the mean, so any lower score flags.
    if (today[item] < threshold) {
      flags.push({
        rule: 'WELLNESS_LOW',
        metric: item,
        value: today[item],
        threshold,
        reason:
          `Your ${item} score today is ${today[item]}, more than ${sdBelow} SD below your usual ` +
          `${mean.toFixed(1)} (guide: ${Number(threshold.toFixed(1))}).`,
      });
    }
  }
  return flags;
}

/**
 * Today's flags from the deterministic rules: ACWR first, then wellness items in a fixed order.
 * Pure, so the same inputs always give the same flags; the AI assistant never raises flags.
 *
 * @throws RangeError for invalid thresholds or a non-finite or negative ACWR.
 */
export function evaluateFlags(inputs: FlagInputs, thresholds: FlagThresholds = DEFAULT_FLAG_THRESHOLDS): Flag[] {
  checkThresholds(thresholds);
  const acwr = acwrFlag(inputs.acwr, thresholds.acwrHigh);
  return [
    ...(acwr ? [acwr] : []),
    ...wellnessFlags(inputs.wellnessToday, inputs.baseline, thresholds.wellnessSdBelow),
  ];
}
