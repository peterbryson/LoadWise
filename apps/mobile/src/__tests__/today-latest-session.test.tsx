import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PendingEntry } from '@/lib/offline-queue';
import { useOfflineSync } from '@/lib/offline-sync';
import { renderScreen } from '@/test-utils';
import TodayScreen from '@/app/(tabs)/index';

const mockPush = jest.fn();
const mockRecentSessions = jest.fn();
const mockMyFlags = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  // Today is always in view in these tests, so a focus effect behaves like a normal effect.
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(effect, [effect]);
  }
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
    useFocusEffect,
    Link: ({ children }: { children: unknown }) => children,
  };
});
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ recentSessions: mockRecentSessions, myFlags: mockMyFlags }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/offline-sync', () => ({ useOfflineSync: jest.fn() }));

/** The offline queue's state as Today sees it; the queue itself is tested in lib/. */
function withQueue(pending: PendingEntry[], options: { syncCount?: number; problems?: string[] } = {}) {
  const dismissProblems = jest.fn();
  jest.mocked(useOfflineSync).mockReturnValue({
    pending,
    syncCount: options.syncCount ?? 0,
    problems: options.problems ?? [],
    dismissProblems,
    saveSession: jest.fn(),
    saveWellness: jest.fn(),
  });
  return { dismissProblems };
}

function waiting(clientId: string, date: string): PendingEntry {
  return {
    kind: 'session',
    clientId,
    payload: { type: 'TRAINING', date, durationMinutes: 45, rpe: 6, clientId },
    createdAt: `${date}T18:00:00.000Z`,
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

describe('FR1 #4: latest session on Today (AC4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'u1' } as never,
      loading: false,
      configured: true,
      signIn: jest.fn(),
      createAccount: jest.fn(),
      resetPassword: jest.fn(),
      signOut: jest.fn(),
      getIdToken: jest.fn(),
    });
    withQueue([]);
    mockMyFlags.mockResolvedValue({
      date: '2026-11-25',
      flags: [],
      checks: { acwr: 'unavailable', wellness: 'no-baseline' },
      baselineCheckIns: 0,
      minCheckIns: 14,
    });
  });

  it('shows the newest session with its type, duration, date, RPE and load', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's2', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640, clientId: null },
    ]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Match · 80 min')).toBeTruthy();
    expect(screen.getByText(/20 Nov · RPE 8 · 640 AU$/)).toBeTruthy();
    expect(mockRecentSessions).toHaveBeenCalledWith(1);
  });

  it('opens recent sessions when the card is pressed', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's1', type: 'TRAINING', date: '2026-11-18', durationMinutes: 45, rpe: 5, load: 225, clientId: null },
    ]);
    await renderScreen(<TodayScreen />);

    await fireEvent.press(await screen.findByRole('link', { name: /^Latest session: Training, 45 minutes, Wed 18 Nov, RPE 5, 225 AU\. Show recent sessions$/ }));

    expect(mockPush).toHaveBeenCalledWith('/sessions');
  });

  it('explains when nothing has been logged yet and offers to log a session', async () => {
    mockRecentSessions.mockResolvedValue([]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('No sessions yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Log your first session' }));

    expect(mockPush).toHaveBeenCalledWith('/log-session');
  });

  it('shows a loading indicator until the session arrives', async () => {
    mockRecentSessions.mockReturnValue(new Promise(() => {}));
    await renderScreen(<TodayScreen />);

    expect(screen.getByLabelText('Loading latest session')).toBeTruthy();
  });

  it('shows why loading failed without blocking the rest of Today, and loads again on Try again', async () => {
    mockRecentSessions
      .mockRejectedValueOnce(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."))
      .mockResolvedValueOnce([]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText("Can't reach the LoadWise API. Check it is running and try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log a session' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No sessions yet')).toBeTruthy();
    expect(mockRecentSessions).toHaveBeenCalledTimes(2);
  });
});

describe('FR1: Latest session shows sessions waiting to sync (#6 AC4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'u1' }, getIdToken: jest.fn() } as never);
  });

  it('shows a newer waiting session, marked as waiting, with an accessible label', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's1', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640, clientId: null },
    ]);
    withQueue([waiting('c-1', '2026-11-24')]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Training · 45 min')).toBeTruthy();
    expect(screen.getByText('Waiting to sync')).toBeTruthy();
    expect(
      screen.getByRole('link', {
        name: 'Latest session: Training, 45 minutes, Tue 24 Nov, RPE 6, 270 AU. Waiting to sync. Show recent sessions',
      }),
    ).toBeTruthy();
  });

  it('shows the waiting session instead of an error when the API cannot be reached', async () => {
    mockRecentSessions.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    withQueue([waiting('c-1', '2026-11-24')]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Waiting to sync')).toBeTruthy();
    expect(screen.queryByText(/Can't reach/)).toBeNull();
  });

  it('shows a synced session once, without the waiting mark, while its copy is still in the queue (AC3)', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's9', type: 'TRAINING', date: '2026-11-24', durationMinutes: 45, rpe: 6, load: 270, clientId: 'c-1' },
    ]);
    withQueue([waiting('c-1', '2026-11-24')]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Training · 45 min')).toBeTruthy();
    expect(screen.queryByText('Waiting to sync')).toBeNull();
  });

  it('loads the latest session again after a queued entry syncs', async () => {
    mockRecentSessions.mockResolvedValue([]);
    withQueue([], { syncCount: 0 });
    const view = await renderScreen(<TodayScreen />);
    await screen.findByText('No sessions yet');

    withQueue([], { syncCount: 1 });
    await view.rerender(<TodayScreen />);

    await waitFor(() => expect(mockRecentSessions).toHaveBeenCalledTimes(2));
  });
});

describe('FR1: Today shows what is waiting to sync (#6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'u1' }, getIdToken: jest.fn() } as never);
    mockRecentSessions.mockResolvedValue([]);
  });

  it('says how many entries are saved on this device', async () => {
    withQueue([waiting('c-1', '2026-11-24'), checkIn]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Saved on this device')).toBeTruthy();
    expect(screen.getByText('2 entries will sync automatically when you are back online.')).toBeTruthy();
  });

  it('shows nothing about syncing when nothing is waiting', async () => {
    withQueue([]);
    await renderScreen(<TodayScreen />);
    await screen.findByText('No sessions yet');

    expect(screen.queryByText('Saved on this device')).toBeNull();
  });

  it('shows an entry the API refused while syncing, until it is dismissed', async () => {
    const problem = 'A check-in saved on this device could not be synced: You have already checked in today';
    const { dismissProblems } = withQueue([], { problems: [problem] });
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText(problem)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismissProblems).toHaveBeenCalledTimes(1);
  });
});
