import { flagDisplay } from '@loadwise/analytics';
import type { Flag, WellnessItem } from '@loadwise/analytics';
import type { CurrentFlags } from '@/lib/api';

export const wellnessItemLabels: Record<WellnessItem, string> = {
  sleep: 'Sleep',
  soreness: 'Soreness',
  fatigue: 'Fatigue',
  stress: 'Stress',
};

/** One decimal place, without a trailing ".0" on whole numbers: 2.5, 4. */
export function oneDecimal(value: number): string {
  return String(Number(value.toFixed(1)));
}

/** Plain-language title. Never says what caused the change or what will happen next (DL-006). */
export function flagTitle(flag: Flag): string {
  if (flag.metric === 'acwr') return 'Your load has increased faster than usual';
  return `Your ${wellnessItemLabels[flag.metric].toLowerCase()} score is lower than usual for you`;
}

/**
 * The value and the threshold it crossed, as shown on the flag detail screen (#9 AC2). Rounded by
 * the same flagDisplay() as the reason, so the numbers never appear to contradict the flag.
 */
export function flagNumbers(flag: Flag): { label: string; value: string }[] {
  const shown = flagDisplay(flag);
  if (flag.metric === 'acwr') {
    return [
      { label: 'Load ratio (ACWR)', value: shown.value },
      { label: 'Guide: flagged above', value: shown.threshold },
    ];
  }
  return [
    { label: `${wellnessItemLabels[flag.metric]} today`, value: `${shown.value} of 5` },
    { label: 'Guide: flagged below', value: shown.threshold },
  ];
}

export function flagMeaning(flag: Flag): string {
  if (flag.rule === 'ACWR_HIGH') {
    return 'Your training load over the last 7 days is high compared with the last 28 days. A sudden rise is worth reviewing, even if you feel fine.';
  }
  return 'Today’s answer is well below your usual answers over the last 28 days. One low score can have many causes.';
}

/** True only when both rules ran, the one case where no flags can be called "nothing flagged". */
export function allChecksRan({ checks }: CurrentFlags): boolean {
  return checks.acwr === 'checked' && checks.wellness === 'checked';
}

/** One line per rule saying whether it ran and, if not, why (#9: no false all-clear). */
export function checkLines(data: CurrentFlags): string[] {
  const flagged = (rule: Flag['rule']) => data.flags.some((flag) => flag.rule === rule);
  const result = (rule: Flag['rule']) => (flagged(rule) ? 'checked, flagged' : 'checked, within the guide');

  const acwr =
    data.checks.acwr === 'checked'
      ? `Load ratio: ${result('ACWR_HIGH')}`
      : 'Load ratio: not available until 28 days after your first logged session';

  const wellness = {
    checked: `Wellness: ${result('WELLNESS_LOW')}`,
    'no-baseline': `Wellness: building your baseline (${data.baselineCheckIns} of ${data.minCheckIns} check-ins)`,
    'no-check-in': 'Wellness: check in today to compare',
  }[data.checks.wellness];

  return [acwr, wellness];
}
