import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionLog, WellnessCheck } from '@loadwise/shared';
import { randomUUID } from 'expo-crypto';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { offlineQueueKey } from '@/lib/account-deletion';
import { ApiError, apiBaseUrl, createApiClient, SavedSession, SavedWellness } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { createOfflineQueue, FlushResult, NewEntry, OfflineQueue, PendingEntry, retryDelayMs } from '@/lib/offline-queue';

/** What a screen learns after saving: sent now, or stored on the device to sync later (#6 AC1). */
export type SaveOutcome<T> = { status: 'saved'; saved: T } | { status: 'queued' };

interface OfflineSyncValue {
  /** Entries waiting to sync, oldest first. */
  pending: PendingEntry[];
  /** Goes up each time an entry syncs, so lists know to load again. */
  syncCount: number;
  /** Entries the API refused while syncing in the background, to show the athlete once. */
  problems: string[];
  dismissProblems: () => void;
  saveSession: (input: SessionLog) => Promise<SaveOutcome<SavedSession>>;
  saveWellness: (input: WellnessCheck) => Promise<SaveOutcome<SavedWellness>>;
}

const OfflineSyncContext = createContext<OfflineSyncValue | null>(null);

const problemFor: Record<NewEntry['kind'], string> = {
  session: 'A session saved on this device could not be synced',
  wellness: 'A check-in saved on this device could not be synced',
};

/**
 * #6 offline logging and sync for the signed-in user. Every save goes into the queue first, then is
 * sent straight away. If that fails for lack of signal, the entry waits and is sent again:
 * - when the app starts or a user signs in,
 * - when the app comes back to the foreground (AppState "active"),
 * - on a timer while anything is waiting, 5 s after a failure and backing off to every 30 s.
 * The timer keeps AC2 (sync within a minute of reconnecting) without a network-status library.
 * Timers do not run while the app is in the background, so the foreground trigger covers that.
 */
export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { user, getIdToken } = useAuth();
  const uid = user?.uid ?? null;
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const queue = useMemo<OfflineQueue | null>(
    () =>
      uid
        ? createOfflineQueue({
            storage: AsyncStorage,
            key: offlineQueueKey(uid),
            send: (entry) => (entry.kind === 'session' ? api.logSession(entry.payload) : api.saveWellness(entry.payload)),
            now: () => new Date(),
            // The only place pending is updated from, so it always matches the stored list.
            onChange: setPending,
          })
        : null,
    [uid, api],
  );
  const [syncCount, setSyncCount] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleRetry = useRef<(remaining: PendingEntry[]) => void>(() => undefined);

  useEffect(() => {
    setPending([]);
    setProblems([]);
    if (!queue) return;
    const active = queue;
    let stopped = false;

    function apply(result: FlushResult) {
      if (result.synced.length > 0) setSyncCount((count) => count + 1);
      if (result.dropped.length > 0) {
        setProblems((current) => [
          ...current,
          ...result.dropped.map(({ entry, message }) => `${problemFor[entry.kind]}: ${message}`),
        ]);
      }
    }

    function schedule(remaining: PendingEntry[]) {
      clearTimeout(timer.current);
      if (stopped || remaining.length === 0) return;
      timer.current = setTimeout(run, retryDelayMs(remaining[0].attempts));
    }

    function run() {
      clearTimeout(timer.current);
      void active.flush().then((result) => {
        if (stopped) return;
        apply(result);
        schedule(result.remaining);
      });
    }

    scheduleRetry.current = schedule;
    // Show what is waiting straight away; the first send may take a while on a weak signal.
    void active.list().then((entries) => {
      if (!stopped) setPending(entries);
    });
    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => {
      stopped = true;
      clearTimeout(timer.current);
      subscription.remove();
      scheduleRetry.current = () => undefined;
    };
  }, [queue]);

  const save = useCallback(
    async <T,>(entry: NewEntry): Promise<SaveOutcome<T>> => {
      if (!queue) throw new ApiError(401, 'Your sign-in has expired. Sign in again.');
      const stored = await queue.enqueue(entry);
      const outcome = await queue.attempt(stored);
      // Refused by the API (e.g. already checked in today): the screen shows why, nothing waits.
      if (outcome.status === 'dropped') throw outcome.error;
      if (outcome.status === 'waiting') {
        scheduleRetry.current(await queue.list());
        return { status: 'queued' };
      }
      setSyncCount((count) => count + 1);
      return { status: 'saved', saved: outcome.saved as T };
    },
    [queue],
  );

  const value = useMemo<OfflineSyncValue>(
    () => ({
      pending,
      syncCount,
      problems,
      dismissProblems: () => setProblems([]),
      saveSession: (input) => save<SavedSession>({ kind: 'session', payload: { ...input, clientId: randomUUID() } }),
      saveWellness: (input) => save<SavedWellness>({ kind: 'wellness', payload: { ...input, clientId: randomUUID() } }),
    }),
    [pending, syncCount, problems, save],
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync(): OfflineSyncValue {
  const value = useContext(OfflineSyncContext);
  if (!value) throw new Error('useOfflineSync must be used inside OfflineSyncProvider');
  return value;
}
