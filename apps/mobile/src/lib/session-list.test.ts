import type { SavedSession } from './api';
import type { PendingEntry } from './offline-queue';
import { mergeSessions } from './session-list';

function saved(id: string, date: string, clientId: string | null = null): SavedSession {
  return { id, type: 'MATCH', date, durationMinutes: 80, rpe: 8, load: 640, clientId };
}

function waiting(clientId: string, date: string, createdAt: string): PendingEntry {
  return {
    kind: 'session',
    clientId,
    payload: { type: 'TRAINING', date, durationMinutes: 45, rpe: 6, clientId },
    createdAt,
    attempts: 1,
  };
}

const checkIn: PendingEntry = {
  kind: 'wellness',
  clientId: 'w-1',
  payload: { date: '2026-11-24', sleep: 4, soreness: 3, fatigue: 3, stress: 4, clientId: 'w-1' },
  createdAt: '2026-11-24T07:00:00.000Z',
  attempts: 0,
};

describe('FR1: sessions waiting to sync are listed (#6 AC4)', () => {
  it('marks waiting sessions and works out their load', () => {
    const [item] = mergeSessions([], [waiting('c-1', '2026-11-24', '2026-11-24T18:00:00.000Z')]);

    expect(item).toEqual({
      key: 'c-1',
      type: 'TRAINING',
      date: '2026-11-24',
      durationMinutes: 45,
      rpe: 6,
      load: 270,
      waiting: true,
    });
  });

  it('lists newest day first, with a waiting session before a synced one on the same day', () => {
    const items = mergeSessions(
      [saved('s-2', '2026-11-24'), saved('s-1', '2026-11-20')],
      [
        waiting('c-old', '2026-11-22', '2026-11-22T18:00:00.000Z'),
        waiting('c-new', '2026-11-24', '2026-11-24T18:00:00.000Z'),
      ],
    );

    expect(items.map((item) => [item.key, item.waiting])).toEqual([
      ['c-new', true],
      ['s-2', false],
      ['c-old', true],
      ['s-1', false],
    ]);
  });

  it('puts the most recently saved first when two waiting sessions share a day', () => {
    const items = mergeSessions(
      [],
      [waiting('c-1', '2026-11-24', '2026-11-24T08:00:00.000Z'), waiting('c-2', '2026-11-24', '2026-11-24T18:00:00.000Z')],
    );

    expect(items.map((item) => item.key)).toEqual(['c-2', 'c-1']);
  });

  it('shows a session once after it has synced, even if the queue has not caught up yet (AC3)', () => {
    const items = mergeSessions([saved('s-9', '2026-11-24', 'c-1')], [waiting('c-1', '2026-11-24', '2026-11-24T18:00:00.000Z')]);

    expect(items.map((item) => [item.key, item.waiting])).toEqual([['s-9', false]]);
  });

  it('leaves out check-ins, which are not sessions', () => {
    expect(mergeSessions([], [checkIn])).toEqual([]);
  });

  it('returns an empty list when there is nothing saved or waiting', () => {
    expect(mergeSessions([], [])).toEqual([]);
  });
});
