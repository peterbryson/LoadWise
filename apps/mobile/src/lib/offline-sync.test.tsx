import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { AppState, AppStateStatus, Text } from 'react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { OfflineSyncProvider, useOfflineSync } from '@/lib/offline-sync';

// Synthetic entries only. The API client and AsyncStorage are fakes; the timers are Jest's fake
// timers, so these tests show the sync schedule, not real network behaviour on a phone.

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }));

const mockLogSession = jest.fn();
const mockSaveWellness = jest.fn();
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ logSession: mockLogSession, saveWellness: mockSaveWellness }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const QUEUE_KEY = 'loadwise.offline-queue.v1.user-a';
const session = { type: 'TRAINING' as const, date: '2026-11-24', durationMinutes: 60, rpe: 7 };
const check = { date: '2026-11-24', sleep: 4, soreness: 3, fatigue: 3, stress: 4 };
const noSignal = () => new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again.");

let sync: ReturnType<typeof useOfflineSync>;
function Probe() {
  sync = useOfflineSync();
  return <Text>{`pending:${sync.pending.length}`}</Text>;
}

let appStateListener: (state: AppStateStatus) => void = () => undefined;

async function renderProvider() {
  const view = await render(
    <OfflineSyncProvider>
      <Probe />
    </OfflineSyncProvider>,
  );
  await act(() => jest.advanceTimersByTimeAsync(0));
  return view;
}

const advance = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));

async function storedQueue(): Promise<{ clientId: string }[]> {
  return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]');
}

beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-a' }, getIdToken: jest.fn() } as never);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FR1: offline queue (#6 AC1)', () => {
  it('sends straight away when online, with a clientId, and keeps nothing on the device', async () => {
    mockLogSession.mockResolvedValue({ id: 's1', ...session, load: 420, clientId: 'x' });
    await renderProvider();

    const outcome = await act(() => sync.saveSession(session));

    expect(outcome).toEqual({ status: 'saved', saved: expect.objectContaining({ id: 's1' }) });
    expect(mockLogSession).toHaveBeenCalledWith({ ...session, clientId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(await storedQueue()).toEqual([]);
  });

  it('keeps a session on the device when there is no signal', async () => {
    mockLogSession.mockRejectedValue(noSignal());
    await renderProvider();

    const outcome = await act(() => sync.saveSession(session));

    expect(outcome).toEqual({ status: 'queued' });
    expect(sync.pending).toHaveLength(1);
    expect(await storedQueue()).toHaveLength(1);
  });

  it('keeps a check-in on the device when there is no signal', async () => {
    mockSaveWellness.mockRejectedValue(noSignal());
    await renderProvider();

    const outcome = await act(() => sync.saveWellness(check));

    expect(outcome).toEqual({ status: 'queued' });
    expect(sync.pending.map((entry) => entry.kind)).toEqual(['wellness']);
  });

  it('shows a refused entry as an error and does not keep it', async () => {
    mockSaveWellness.mockRejectedValue(new ApiError(409, 'You have already checked in today'));
    await renderProvider();

    const refused = await act(() => sync.saveWellness(check).catch((error: unknown) => error));

    expect(refused).toMatchObject({ status: 409, message: 'You have already checked in today' });
    expect(mockSaveWellness).toHaveBeenCalledTimes(1);
    expect(sync.pending).toEqual([]);
    expect(await storedQueue()).toEqual([]);
  });
});

describe('FR1: queued entries sync within 1 minute of reconnecting (#6 AC2)', () => {
  it('syncs on the first retry, 5 s after the signal comes back', async () => {
    mockLogSession.mockRejectedValueOnce(noSignal()).mockResolvedValue({ id: 's1' });
    await renderProvider();
    await act(() => sync.saveSession(session));
    const before = sync.syncCount;

    await advance(5_000);

    expect(sync.pending).toEqual([]);
    expect(sync.syncCount).toBe(before + 1);
    expect(mockLogSession).toHaveBeenCalledTimes(2);
  });

  it('syncs within 60 s of reconnecting, even when the signal returns just after a send has hung', async () => {
    // The worst case for AC2: a send goes out with no signal and hangs, the signal returns straight
    // after, and the queue has backed off to its longest wait.
    let online = false;
    let reconnectDuringNextSend = false;
    mockLogSession.mockImplementation(() => {
      if (online) return Promise.resolve({ id: 's1' });
      if (reconnectDuringNextSend) {
        reconnectDuringNextSend = false;
        online = true;
      }
      return new Promise(() => undefined);
    });
    await renderProvider();
    void sync.saveSession(session);
    await advance(10 * 60_000);
    expect(sync.pending).toHaveLength(1);

    reconnectDuringNextSend = true;
    for (let second = 0; second < 60 && !online; second += 1) await advance(1_000);
    expect(online).toBe(true);

    await advance(59_000);

    expect(sync.pending).toEqual([]);
  });

  it('syncs as soon as the app comes back to the foreground', async () => {
    mockLogSession.mockRejectedValueOnce(noSignal()).mockResolvedValue({ id: 's1' });
    await renderProvider();
    await act(() => sync.saveSession(session));

    await act(async () => appStateListener('active'));
    await advance(0);

    expect(sync.pending).toEqual([]);
  });

  it('syncs entries left from an earlier run when the app starts', async () => {
    await AsyncStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        {
          kind: 'session',
          clientId: 'c-1',
          payload: { ...session, clientId: 'c-1' },
          createdAt: '2026-11-24T18:00:00.000Z',
          attempts: 3,
        },
      ]),
    );
    mockLogSession.mockResolvedValue({ id: 's1' });

    await renderProvider();

    expect(mockLogSession).toHaveBeenCalledWith({ ...session, clientId: 'c-1' });
    expect(sync.pending).toEqual([]);
  });

  it('tells the athlete when the API refuses an entry while syncing in the background', async () => {
    mockSaveWellness.mockRejectedValueOnce(noSignal()).mockRejectedValue(new ApiError(409, 'You have already checked in today'));
    await renderProvider();
    await act(() => sync.saveWellness(check));

    await advance(5_000);

    expect(sync.pending).toEqual([]);
    expect(sync.problems).toEqual([
      'A check-in saved on this device could not be synced: You have already checked in today',
    ]);
    await act(async () => sync.dismissProblems());
    expect(sync.problems).toEqual([]);
  });

  it('stops trying once nothing is waiting', async () => {
    mockLogSession.mockRejectedValueOnce(noSignal()).mockResolvedValue({ id: 's1' });
    await renderProvider();
    await act(() => sync.saveSession(session));
    await advance(5_000);

    await advance(5 * 60_000);

    expect(mockLogSession).toHaveBeenCalledTimes(2);
  });
});

describe('FR1: offline sync creates no duplicates (#6 AC3)', () => {
  it('sends the same clientId on every try for one entry', async () => {
    mockLogSession.mockRejectedValueOnce(noSignal()).mockRejectedValueOnce(noSignal()).mockResolvedValue({ id: 's1' });
    await renderProvider();
    await act(() => sync.saveSession(session));

    await advance(5_000);
    await advance(10_000);

    const clientIds = mockLogSession.mock.calls.map(([input]) => (input as { clientId: string }).clientId);
    expect(clientIds).toHaveLength(3);
    expect(new Set(clientIds).size).toBe(1);
  });

  it("does not send one user's waiting entries after another user signs in", async () => {
    mockLogSession.mockRejectedValue(noSignal());
    const view = await renderProvider();
    await act(() => sync.saveSession(session));
    mockLogSession.mockClear();

    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-b' }, getIdToken: jest.fn() } as never);
    await view.rerender(
      <OfflineSyncProvider>
        <Probe />
      </OfflineSyncProvider>,
    );
    await advance(60_000);

    expect(mockLogSession).not.toHaveBeenCalled();
    expect(sync.pending).toEqual([]);
    expect(await storedQueue()).toHaveLength(1);
  });
});
