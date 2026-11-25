import type { Flag, WellnessItem } from '@loadwise/analytics';

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

/** The value and the threshold it crossed, as shown on the flag detail screen (#9 AC2). */
export function flagNumbers(flag: Flag): { label: string; value: string }[] {
  if (flag.metric === 'acwr') {
    return [
      { label: 'Load ratio (ACWR)', value: flag.value.toFixed(2) },
      { label: 'Guide: flagged above', value: String(flag.threshold) },
    ];
  }
  return [
    { label: `${wellnessItemLabels[flag.metric]} today`, value: `${flag.value} of 5` },
    { label: 'Guide: flagged below', value: oneDecimal(flag.threshold) },
  ];
}

export function flagMeaning(flag: Flag): string {
  if (flag.rule === 'ACWR_HIGH') {
    return 'Your training load over the last 7 days is high compared with the last 28 days. A sudden rise is worth reviewing, even if you feel fine.';
  }
  return 'Today’s answer is well below your usual answers over the last 28 days. One low score can have many causes.';
}
