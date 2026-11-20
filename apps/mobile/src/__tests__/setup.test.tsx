import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConsent } from '@/lib/consent';
import { renderScreen } from '@/test-utils';
import SetupScreen from '@/app/setup';

const mockReplace = jest.fn();
const mockGiveHealthConsent = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Redirect: () => null,
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ giveHealthConsent: mockGiveHealthConsent }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/consent', () => ({ useConsent: jest.fn() }));

const markGiven = jest.fn();

describe('NFR2: first-time setup records health-data consent (#1 AC4)', () => {
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
    jest.mocked(useConsent).mockReturnValue({ status: 'needed', retry: jest.fn(), markGiven });
  });

  it('keeps Continue disabled until the consent box is ticked', async () => {
    await renderScreen(<SetupScreen />);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  it('saves consent, then opens the app', async () => {
    mockGiveHealthConsent.mockResolvedValue({ healthConsentGiven: true });
    await renderScreen(<SetupScreen />);

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockGiveHealthConsent).toHaveBeenCalledTimes(1);
    expect(markGiven).toHaveBeenCalledTimes(1);
  });

  it('stays on setup and shows the reason when saving fails', async () => {
    mockGiveHealthConsent.mockRejectedValue(
      new ApiError(400, 'The privacy notice has changed. Update the app and try again.'),
    );
    await renderScreen(<SetupScreen />);

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('The privacy notice has changed. Update the app and try again.')).toBeTruthy();
    expect(markGiven).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a plain message for an unexpected failure', async () => {
    mockGiveHealthConsent.mockRejectedValue(new Error('boom'));
    await renderScreen(<SetupScreen />);

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
  });
});
