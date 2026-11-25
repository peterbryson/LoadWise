import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
      { id: 's2', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640 },
    ]);
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Match · 80 min')).toBeTruthy();
    expect(screen.getByText(/20 Nov · RPE 8 · 640 AU$/)).toBeTruthy();
    expect(mockRecentSessions).toHaveBeenCalledWith(1);
  });

  it('opens recent sessions when the card is pressed', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's1', type: 'TRAINING', date: '2026-11-18', durationMinutes: 45, rpe: 5, load: 225 },
    ]);
    await renderScreen(<TodayScreen />);

    await fireEvent.press(await screen.findByRole('link', { name: 'Latest session. Show recent sessions' }));

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
