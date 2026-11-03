import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import SignInScreen from '@/app/sign-in';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Redirect: () => null,
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const auth = {
  user: null,
  loading: false,
  configured: true,
  signIn: jest.fn(),
  createAccount: jest.fn(),
  resetPassword: jest.fn(),
  signOut: jest.fn(),
  getIdToken: jest.fn(),
};

async function fillIn(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

describe('FR4: sign-in screen (#1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ ...auth });
  });

  it('signs in with the trimmed email and the password', async () => {
    auth.signIn.mockResolvedValue(undefined);
    await renderScreen(<SignInScreen />);

    await fillIn('  athlete@example.com ', 'secret-pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('athlete@example.com', 'secret-pw'));
  });

  it('asks for an email before calling Firebase', async () => {
    await renderScreen(<SignInScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('asks for a password before calling Firebase', async () => {
    await renderScreen(<SignInScreen />);

    await fillIn('athlete@example.com', '');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('shows the design error for a wrong email or password', async () => {
    auth.signIn.mockRejectedValue({ code: 'auth/invalid-credential' });
    await renderScreen(<SignInScreen />);

    await fillIn('athlete@example.com', 'wrong');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email or password is incorrect. Try again.')).toBeTruthy();
  });

  it('sends a new account to first-time setup', async () => {
    auth.createAccount.mockResolvedValue(undefined);
    await renderScreen(<SignInScreen />);

    await fillIn('new@example.com', 'secret-pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/setup'));
    expect(auth.createAccount).toHaveBeenCalledWith('new@example.com', 'secret-pw');
  });

  it('disables sign-in and explains why when Firebase is not configured', async () => {
    jest.mocked(useAuth).mockReturnValue({ ...auth, configured: false });
    await renderScreen(<SignInScreen />);

    expect(screen.getByText(/Sign-in is not configured/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });
});
