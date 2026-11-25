import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PendingEntry } from '@/lib/offline-queue';
import { useOfflineSync } from '@/lib/offline-sync';
import { renderScreen } from '@/test-utils';
import SessionsScreen from '@/app/sessions';

const mockPush = jest.fn();
const mockRecentSessions = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ recentSessions: mockRecentSessions }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/offline-sync', () => ({ useOfflineSync: jest.fn() }));

/** The offline queue's state as the screen sees it; the queue itself is tested in lib/. */
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

function waiting(clientId: string, type: 'TRAINING' | 'GYM', date: string, durationMinutes: number, rpe: number): PendingEntry {
  return {
    kind: 'session',
    clientId,
    payload: { type, date, durationMinutes, rpe, clientId },
    createdAt: `${date}T18:00:00.000Z`,
    attempts: 1,
  };
}

describe('FR1: recent sessions, newest first (#4 AC3, AC4)', () => {
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
  });

  it('lists sessions in the order the API returns them (newest first), with their load', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's2', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640, clientId: null },
      { id: 's1', type: 'TRAINING', date: '2026-11-18', durationMinutes: 45, rpe: 5, load: 225, clientId: null },
    ]);
    await renderScreen(<SessionsScreen />);

    const titles = await screen.findAllByText(/ · \d+ min$/);
    expect(titles.map((title) => title.props.children)).toEqual(['Match · 80 min', 'Training · 45 min']);
    expect(screen.getByText('640 AU')).toBeTruthy();
    expect(screen.getByText(/RPE 5$/)).toBeTruthy();
  });

  it('explains an empty history', async () => {
    mockRecentSessions.mockResolvedValue([]);
    await renderScreen(<SessionsScreen />);

    expect(await screen.findByText('No sessions yet')).toBeTruthy();
  });

  it('shows a loading indicator until the sessions arrive', async () => {
    mockRecentSessions.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SessionsScreen />);

    expect(screen.getByLabelText('Loading sessions')).toBeTruthy();
  });

  it('shows why loading failed and loads again on Try again', async () => {
    mockRecentSessions
      .mockRejectedValueOnce(new ApiError(401, 'Your sign-in has expired. Sign in again.'))
      .mockResolvedValueOnce([]);
    await renderScreen(<SessionsScreen />);

    expect(await screen.findByText('Your sign-in has expired. Sign in again.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No sessions yet')).toBeTruthy();
    expect(mockRecentSessions).toHaveBeenCalledTimes(2);
  });
});

describe('FR1: Recent sessions shows sessions waiting to sync (#6 AC4)', () => {
  const gym = waiting('c-1', 'GYM', '2026-11-24', 30, 5);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'u1' }, getIdToken: jest.fn() } as never);
  });

  it('lists a waiting session first, marked as waiting, with an accessible label', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's1', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640, clientId: null },
    ]);
    withQueue([gym]);
    await renderScreen(<SessionsScreen />);

    const titles = await screen.findAllByText(/ · \d+ min$/);
    expect(titles.map((title) => title.props.children)).toEqual(['Gym · 30 min', 'Match · 80 min']);
    expect(screen.getByLabelText('Gym, 30 minutes, Tue 24 Nov, RPE 5, 150 AU. Waiting to sync')).toBeTruthy();
    expect(screen.getByLabelText('Match, 80 minutes, Fri 20 Nov, RPE 8, 640 AU')).toBeTruthy();
    expect(screen.getAllByText('Waiting to sync')).toHaveLength(1);
  });

  it('still lists waiting sessions when the API cannot be reached, with the error and Try again', async () => {
    mockRecentSessions.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    withQueue([gym]);
    await renderScreen(<SessionsScreen />);

    expect(await screen.findByText(/Can't reach/)).toBeTruthy();
    expect(screen.getByText('Waiting to sync')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows a session once after it has synced, even before the queue catches up (AC3)', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's9', type: 'GYM', date: '2026-11-24', durationMinutes: 30, rpe: 5, load: 150, clientId: 'c-1' },
    ]);
    withQueue([gym]);
    await renderScreen(<SessionsScreen />);

    expect(await screen.findByLabelText('Gym, 30 minutes, Tue 24 Nov, RPE 5, 150 AU')).toBeTruthy();
    expect(screen.getAllByText('Gym · 30 min')).toHaveLength(1);
    expect(screen.queryByText('Waiting to sync')).toBeNull();
  });

  it('loads the list again after a queued entry syncs', async () => {
    mockRecentSessions.mockResolvedValue([]);
    withQueue([], { syncCount: 0 });
    const view = await renderScreen(<SessionsScreen />);
    await screen.findByText('No sessions yet');

    withQueue([], { syncCount: 1 });
    await view.rerender(<SessionsScreen />);

    await waitFor(() => expect(mockRecentSessions).toHaveBeenCalledTimes(2));
  });
});
