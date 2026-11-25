import { sessionLoad } from '@loadwise/analytics';
import type { SessionType } from '@loadwise/shared';
import type { SavedSession } from './api';
import type { PendingEntry } from './offline-queue';

/** One row in Recent sessions or the Latest session card. */
export interface SessionListItem {
  /** The API id for a synced session, the clientId for one still waiting. */
  key: string;
  type: SessionType;
  date: string;
  durationMinutes: number;
  rpe: number;
  load: number;
  /** #6 AC4: saved on this device and not yet synced. */
  waiting: boolean;
}

/**
 * #6 AC4: synced sessions plus those still waiting to sync, newest day first. On the same day a
 * waiting session comes first, as it was logged most recently. A queued session whose clientId is
 * already in the synced list is left out, so the moment between syncing and the queue being
 * cleared never shows it twice.
 */
export function mergeSessions(saved: SavedSession[], pending: PendingEntry[]): SessionListItem[] {
  const syncedIds = new Set(saved.map((session) => session.clientId).filter((id) => id !== null));
  const waiting: SessionListItem[] = [];
  for (const entry of pending) {
    if (entry.kind !== 'session' || syncedIds.has(entry.clientId)) continue;
    const { type, date, durationMinutes, rpe } = entry.payload;
    waiting.push({ key: entry.clientId, type, date, durationMinutes, rpe, load: sessionLoad(rpe, durationMinutes), waiting: true });
  }
  // The queue is oldest first; reversing puts the newest waiting session first before the
  // stable sort by day below.
  waiting.reverse();

  const synced = saved.map(({ id, type, date, durationMinutes, rpe, load }) => ({
    key: id,
    type,
    date,
    durationMinutes,
    rpe,
    load,
    waiting: false,
  }));

  // YYYY-MM-DD strings sort the same way as the days they name.
  return [...waiting, ...synced].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}
