import type { SessionType } from '@loadwise/shared';

/** Plain-language names for each session type. */
export const sessionTypeLabels: Record<SessionType, string> = {
  TRAINING: 'Training',
  MATCH: 'Match',
  GYM: 'Gym',
  OTHER: 'Other',
};

/** "Fri 20 Nov" for a YYYY-MM-DD date, read as a local calendar day. */
export function shortDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
