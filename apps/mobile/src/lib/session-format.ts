import type { SessionType } from '@loadwise/shared';
import type { SessionListItem } from './session-list';

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

/** One sentence a screen reader reads for a session row, including whether it is waiting to sync (#6 AC4). */
export function sessionAccessibilityLabel(session: SessionListItem): string {
  const summary = `${sessionTypeLabels[session.type]}, ${session.durationMinutes} minutes, ${shortDay(session.date)}, RPE ${session.rpe}, ${session.load} AU`;
  return session.waiting ? `${summary}. Waiting to sync` : summary;
}
