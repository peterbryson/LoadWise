import type { SessionLog, WellnessCheck } from '@loadwise/shared';
import { ApiError } from './api';

/**
 * #6 offline logging and sync. Entries are written to this queue before they are sent, so nothing
 * is lost if the app has no signal or is closed mid-send. Each entry keeps the clientId it was given
 * when first saved, and the API treats a repeated clientId as the same entry (AC3), so sending an
 * entry twice is always safe.
 *
 * Storage, sending and the clock are passed in, so the rules here are tested without a phone,
 * AsyncStorage or a network (offline-queue.test.ts).
 */

/** Shown when a save is kept on the device to sync later (#6 AC1). */
export const OFFLINE_SAVED_MESSAGE = "Saved on this device — will sync when you're back online";

type WithClientId<T> = T & { clientId: string };

/** An entry as the screen hands it over. */
export type NewEntry =
  | { kind: 'session'; payload: WithClientId<SessionLog> }
  | { kind: 'wellness'; payload: WithClientId<WellnessCheck> };

/** An entry waiting to sync, as stored on the device. */
export type PendingEntry = NewEntry & {
  clientId: string;
  /** ISO time it was first saved, used to order waiting sessions newest first. */
  createdAt: string;
  /** Failed sends so far. Sets how long to wait before the next try. */
  attempts: number;
};

/** The two AsyncStorage methods the queue uses. */
export interface QueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type SendEntry = (entry: PendingEntry) => Promise<unknown>;

export type Failure = 'no-signal' | 'temporary' | 'rejected';

export type AttemptResult =
  | { status: 'synced'; saved: unknown }
  | { status: 'dropped'; message: string; error: unknown }
  | { status: 'waiting'; failure: Exclude<Failure, 'rejected'> };

export interface FlushResult {
  synced: PendingEntry[];
  dropped: { entry: PendingEntry; message: string }[];
  /** Entries still waiting, oldest first. */
  remaining: PendingEntry[];
}

interface OfflineQueueOptions {
  storage: QueueStorage;
  /** One key per signed-in user, so one person's entries are never sent as another's. */
  key: string;
  send: SendEntry;
  now: () => Date;
  /** A send that takes longer is treated as no signal; see SEND_TIMEOUT_MS. */
  sendTimeoutMs?: number;
  /** Called with the stored list after every change, in the order the changes were made. */
  onChange?: (entries: PendingEntry[]) => void;
}

/**
 * A send stuck on a weak signal is abandoned after this long and tried again later. If it did reach
 * the API, the retry is answered as a replay, so abandoning it never creates a duplicate.
 */
export const SEND_TIMEOUT_MS = 15_000;

const FIRST_RETRY_MS = 5_000;
/**
 * AC2 asks for sync within a minute of reconnecting. The worst case is a send that starts just
 * before the signal returns and times out (15 s), then the longest wait (30 s): 45 s, plus the
 * send itself.
 */
export const MAX_RETRY_MS = 30_000;

/** Wait before the next try: 5 s, 10 s, 20 s, then 30 s for every later try. */
export function retryDelayMs(attempts: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** Math.max(attempts - 1, 0), MAX_RETRY_MS);
}

/**
 * No signal and server errors are worth trying again; any other answer from the API (a 400, 403 or
 * 409) will be the same next time, so the entry is dropped and the athlete is told. A 401 is kept:
 * the token may only have expired while offline, and losing the entry would be worse than waiting.
 */
export function classifyFailure(error: unknown): Failure {
  if (!(error instanceof ApiError) || error.status === 0) return 'no-signal';
  if (error.status >= 500 || error.status === 401 || error.status === 408 || error.status === 429) return 'temporary';
  return 'rejected';
}

class SendTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SendTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parse(stored: string | null): PendingEntry[] {
  if (!stored) return [];
  try {
    const entries: unknown = JSON.parse(stored);
    return Array.isArray(entries) ? (entries as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

export function createOfflineQueue({
  storage,
  key,
  send,
  now,
  sendTimeoutMs = SEND_TIMEOUT_MS,
  onChange,
}: OfflineQueueOptions) {
  // Every read and read-modify-write of the stored list runs one at a time, in order. An entry
  // saved while a sync is running is never overwritten by the sync's write, and a read never
  // returns a list older than one already reported to onChange.
  let chain: Promise<unknown> = Promise.resolve();
  function inOrder<T>(step: () => Promise<T>): Promise<T> {
    const next = chain.then(step);
    chain = next.catch(() => undefined);
    return next;
  }

  function update(change: (entries: PendingEntry[]) => PendingEntry[]): Promise<PendingEntry[]> {
    return inOrder(async () => {
      const entries = change(parse(await storage.getItem(key)));
      await storage.setItem(key, JSON.stringify(entries));
      onChange?.(entries);
      return entries;
    });
  }

  const remove = (clientId: string) => update((entries) => entries.filter((entry) => entry.clientId !== clientId));

  function list(): Promise<PendingEntry[]> {
    return inOrder(async () => parse(await storage.getItem(key)));
  }

  /** AC1: stores the entry before any attempt to send it. */
  async function enqueue(entry: NewEntry): Promise<PendingEntry> {
    const pending = { ...entry, clientId: entry.payload.clientId, createdAt: now().toISOString(), attempts: 0 } as PendingEntry;
    await update((entries) => [...entries.filter((stored) => stored.clientId !== pending.clientId), pending]);
    return pending;
  }

  /** Sends one entry, then removes it (synced or rejected) or counts the failed try. */
  async function attempt(entry: PendingEntry): Promise<AttemptResult> {
    try {
      const saved = await withTimeout(send(entry), sendTimeoutMs);
      await remove(entry.clientId);
      return { status: 'synced', saved };
    } catch (error) {
      const failure = error instanceof SendTimeout ? 'no-signal' : classifyFailure(error);
      if (failure === 'rejected') {
        await remove(entry.clientId);
        return { status: 'dropped', message: error instanceof ApiError ? error.message : 'Something went wrong.', error };
      }
      await update((entries) =>
        entries.map((stored) => (stored.clientId === entry.clientId ? { ...stored, attempts: stored.attempts + 1 } : stored)),
      );
      return { status: 'waiting', failure };
    }
  }

  let flushing: Promise<FlushResult> | null = null;

  async function runFlush(): Promise<FlushResult> {
    const result: FlushResult = { synced: [], dropped: [], remaining: [] };
    for (const entry of await list()) {
      const outcome = await attempt(entry);
      if (outcome.status === 'synced') result.synced.push(entry);
      if (outcome.status === 'dropped') result.dropped.push({ entry, message: outcome.message });
      // With no signal the rest would fail the same way, so stop. A server error may be about
      // this entry only, so carry on with the others.
      if (outcome.status === 'waiting' && outcome.failure === 'no-signal') break;
    }
    result.remaining = await list();
    return result;
  }

  /**
   * AC2: tries every waiting entry, oldest first. Only one sync runs at a time; a second call while
   * one is running gets the same result instead of sending the entries twice.
   */
  function flush(): Promise<FlushResult> {
    flushing ??= runFlush().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  return { list, enqueue, attempt, flush };
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>;
