import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  });

  it('lists sessions in the order the API returns them (newest first), with their load', async () => {
    mockRecentSessions.mockResolvedValue([
      { id: 's2', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640 },
      { id: 's1', type: 'TRAINING', date: '2026-11-18', durationMinutes: 45, rpe: 5, load: 225 },
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
