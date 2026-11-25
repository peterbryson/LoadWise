import { ApiError } from './api';
import {
  classifyFailure,
  createOfflineQueue,
  MAX_RETRY_MS,
  NewEntry,
  PendingEntry,
  QueueStorage,
  retryDelayMs,
  SendEntry,
} from './offline-queue';

// Synthetic entries only. Storage is an in-memory map, so these tests cover the queue's rules, not
// AsyncStorage itself.

const KEY = 'loadwise.offline-queue.v1.user-a';

function memoryStorage(initial: Record<string, string> = {}): QueueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
}

function session(clientId: string, date = '2026-11-24'): NewEntry {
  return { kind: 'session', payload: { type: 'TRAINING', date, durationMinutes: 60, rpe: 7, clientId } };
}

const wellness: NewEntry = {
  kind: 'wellness',
  payload: { date: '2026-11-24', sleep: 4, soreness: 3, fatigue: 3, stress: 4, clientId: 'w-1' },
};

const offline = () => new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again.");

function setup(send: SendEntry, storage = memoryStorage()) {
  const queue = createOfflineQueue({
    storage,
    key: KEY,
    send,
    now: () => new Date('2026-11-24T18:30:00.000Z'),
    sendTimeoutMs: 1_000,
  });
  return { queue, storage };
}

const stored = (storage: { data: Record<string, string> }) => JSON.parse(storage.data[KEY] ?? '[]') as PendingEntry[];

describe('FR1: offline queue (#6 AC1)', () => {
  it('stores an entry on the device before anything is sent', async () => {
    const send = jest.fn();
    const { queue, storage } = setup(send);

    await queue.enqueue(session('s-1'));

    expect(send).not.toHaveBeenCalled();
    expect(stored(storage)).toEqual([
      {
        kind: 'session',
        clientId: 's-1',
        payload: { type: 'TRAINING', date: '2026-11-24', durationMinutes: 60, rpe: 7, clientId: 's-1' },
        createdAt: '2026-11-24T18:30:00.000Z',
        attempts: 0,
      },
    ]);
  });

  it('keeps sessions and check-ins together, oldest first', async () => {
    const { queue } = setup(jest.fn());

    await queue.enqueue(session('s-1'));
    await queue.enqueue(wellness);

    expect((await queue.list()).map((entry) => entry.clientId)).toEqual(['s-1', 'w-1']);
  });

  it('keeps entries saved at the same moment from overwriting each other', async () => {
    const { queue } = setup(jest.fn());

    await Promise.all([queue.enqueue(session('s-1')), queue.enqueue(session('s-2')), queue.enqueue(wellness)]);

    expect(await queue.list()).toHaveLength(3);
  });

  it("keeps each user's queue under their own key", async () => {
    const storage = memoryStorage();
    const { queue } = setup(jest.fn(), storage);
    await queue.enqueue(session('s-1'));

    const otherUser = createOfflineQueue({ storage, key: 'loadwise.offline-queue.v1.user-b', send: jest.fn(), now: () => new Date() });

    expect(await otherUser.list()).toEqual([]);
  });

  it('treats unreadable stored data as an empty queue', async () => {
    const { queue } = setup(jest.fn(), memoryStorage({ [KEY]: '{not json' }));
    expect(await queue.list()).toEqual([]);
  });
});

describe('FR1: offline sync retries and drops (#6 AC2)', () => {
  it('removes an entry once the API has saved it', async () => {
    const send = jest.fn().mockResolvedValue({ id: 'api-1' });
    const { queue, storage } = setup(send);
    await queue.enqueue(session('s-1'));

    const result = await queue.flush();

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ clientId: 's-1' }));
    expect(result.synced.map((entry) => entry.clientId)).toEqual(['s-1']);
    expect(result.remaining).toEqual([]);
    expect(stored(storage)).toEqual([]);
  });

  it('keeps entries and counts the try when there is no signal, and stops trying the rest', async () => {
    const send = jest.fn().mockRejectedValue(offline());
    const { queue } = setup(send);
    await queue.enqueue(session('s-1'));
    await queue.enqueue(session('s-2'));

    const result = await queue.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.remaining.map((entry) => [entry.clientId, entry.attempts])).toEqual([
      ['s-1', 1],
      ['s-2', 0],
    ]);
  });

  it('treats a failure before the request (e.g. refreshing the sign-in token offline) as no signal', async () => {
    const { queue } = setup(jest.fn().mockRejectedValue(new Error('auth/network-request-failed')));
    await queue.enqueue(session('s-1'));

    expect((await queue.flush()).remaining).toHaveLength(1);
  });

  it('keeps an entry after a server error and still tries the others', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'Something went wrong. Try again.'))
      .mockResolvedValueOnce({ id: 'api-2' });
    const { queue } = setup(send);
    await queue.enqueue(session('s-1'));
    await queue.enqueue(session('s-2'));

    const result = await queue.flush();

    expect(result.synced.map((entry) => entry.clientId)).toEqual(['s-2']);
    expect(result.remaining.map((entry) => [entry.clientId, entry.attempts])).toEqual([['s-1', 1]]);
  });

  it('drops an entry the API refuses and reports why', async () => {
    const send = jest.fn().mockRejectedValue(new ApiError(409, 'You have already checked in today'));
    const { queue } = setup(send);
    await queue.enqueue(wellness);

    const result = await queue.flush();

    expect(result.dropped).toEqual([
      { entry: expect.objectContaining({ clientId: 'w-1' }), message: 'You have already checked in today' },
    ]);
    expect(result.remaining).toEqual([]);
  });

  it('abandons a send that hangs and keeps the entry for the next try', async () => {
    jest.useFakeTimers();
    try {
      const { queue } = setup(() => new Promise(() => undefined));
      await queue.enqueue(session('s-1'));

      const flushed = queue.flush();
      await jest.advanceTimersByTimeAsync(1_000);

      expect((await flushed).remaining.map((entry) => entry.attempts)).toEqual([1]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs one sync at a time, so overlapping triggers do not send an entry twice', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const send = jest.fn(() => new Promise((resolve) => (finish = resolve)));
    const { queue } = setup(send);
    await queue.enqueue(session('s-1'));

    const first = queue.flush();
    const second = queue.flush();
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    finish({ id: 'api-1' });

    expect(await first).toBe(await second);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no signal', 'no-signal', new ApiError(0, 'offline')],
    ['an unexpected error', 'no-signal', new TypeError('Network request failed')],
    ['a 500', 'temporary', new ApiError(500, 'x')],
    ['an expired sign-in (401)', 'temporary', new ApiError(401, 'x')],
    ['too many requests (429)', 'temporary', new ApiError(429, 'x')],
    ['invalid input (400)', 'rejected', new ApiError(400, 'x')],
    ['no consent (403)', 'rejected', new ApiError(403, 'x')],
    ['a conflict (409)', 'rejected', new ApiError(409, 'x')],
  ])('classifies %s as %s', (_case, expected, error) => {
    expect(classifyFailure(error)).toBe(expected);
  });

  it('backs off 5 s, 10 s, 20 s, then never waits more than 30 s', () => {
    expect([0, 1, 2, 3, 4, 10, 50].map(retryDelayMs)).toEqual([5_000, 5_000, 10_000, 20_000, 30_000, 30_000, 30_000]);
    expect(MAX_RETRY_MS).toBeLessThan(60_000);
  });
});

describe('FR1: offline sync creates no duplicates (#6 AC3)', () => {
  it('sends the same clientId again when the first response was lost, so the API can answer it as a replay', async () => {
    const send = jest.fn().mockRejectedValueOnce(offline()).mockResolvedValueOnce({ id: 'api-1' });
    const { queue } = setup(send);
    await queue.enqueue(session('s-1'));

    await queue.flush();
    await queue.flush();

    expect(send.mock.calls.map(([entry]) => (entry as PendingEntry).payload.clientId)).toEqual(['s-1', 's-1']);
  });

  it('stores an entry once even if it is queued twice', async () => {
    const { queue } = setup(jest.fn());

    await queue.enqueue(session('s-1'));
    await queue.enqueue(session('s-1'));

    expect(await queue.list()).toHaveLength(1);
  });
});
