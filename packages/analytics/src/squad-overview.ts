import { flagDisplay } from './flags';
import type { Flag, FlagChecks } from './flags';
import type { WellnessItem } from './wellness-baseline';

/**
 * #10: how one athlete appears in a squad overview.
 * - flagged: at least one rule fired today.
 * - clear: both rules ran and neither fired.
 * - incomplete: nothing fired, but at least one rule could not run (first 28 days, baseline still
 *   building, or no check-in today), so this is not an all-clear (DL-020).
 */
export type AthleteStatus = 'flagged' | 'clear' | 'incomplete';

export function athleteStatus(flags: readonly Flag[], checks: FlagChecks): AthleteStatus {
  if (flags.length > 0) return 'flagged';
  return checks.acwr === 'checked' && checks.wellness === 'checked' ? 'clear' : 'incomplete';
}

export interface StaffReasonOptions {
  /**
   * Whether the viewer's role may see individual wellness scores (WELLNESS_SCORES, DL-022). A coach
   * may not, so a coach's wellness reason gives the status only, with no score or guide value.
   */
  showScores: boolean;
  /** The configured wellness rule, so the reason states the same guide the engine used. */
  sdBelow: number;
}

const ITEM_LABELS: Record<WellnessItem, string> = {
  sleep: 'Sleep',
  soreness: 'Soreness',
  fatigue: 'Fatigue',
  stress: 'Stress',
};

/**
 * A flag's reason for staff, in the third person. Built from the engine's flag, never by an LLM,
 * and rounded with flagDisplay() so the value never appears to sit on the wrong side of its guide.
 * Decision-support wording only: it describes the measurement and the guide, not what to do.
 */
export function staffFlagReason(flag: Flag, { showScores, sdBelow }: StaffReasonOptions): string {
  const shown = flagDisplay(flag);
  if (flag.rule === 'ACWR_HIGH') {
    return `Load ratio (ACWR) is ${shown.value}, above the ${shown.threshold} guide.`;
  }
  const label = ITEM_LABELS[flag.metric as WellnessItem];
  return showScores
    ? `${label} today is ${shown.value}, more than ${sdBelow} SD below their usual (guide: ${shown.threshold}).`
    : `${label} today is more than ${sdBelow} SD below their usual.`;
}

/** The fields the overview is sorted by. Athletes who do not share have no status of their own. */
export interface OverviewRowKey {
  displayName: string;
  status: AthleteStatus | 'not-sharing';
  flagCount: number;
}

const STATUS_ORDER: Record<OverviewRowKey['status'], number> = {
  flagged: 0,
  incomplete: 1,
  clear: 2,
  'not-sharing': 3,
};

/**
 * Problems first, so a coach can spot them at a glance (#10): flagged athletes (most flags first),
 * then those not fully checked, then clear, then those not sharing; by name within each group.
 */
export function compareOverviewRows(a: OverviewRowKey, b: OverviewRowKey): number {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    b.flagCount - a.flagCount ||
    a.displayName.localeCompare(b.displayName, 'en-GB', { sensitivity: 'base' })
  );
}
