import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import DeleteAccountScreen from '@/app/delete-account';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDeleteAccount = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack }) }));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ deleteAccount: mockDeleteAccount }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const QUEUE_KEY = 'loadwise.offline-queue.v1.fb-1';
const auth = {
  user: { uid: 'fb-1', email: 'athlete@example.test' },
  getIdToken: jest.fn(),
  confirmPassword: jest.fn(),
  deleteSignIn: jest.fn(),
  signOut: jest.fn(),
};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(auth as never);
  auth.confirmPassword.mockResolvedValue(undefined);
  auth.deleteSignIn.mockResolvedValue(undefined);
  auth.signOut.mockResolvedValue(undefined);
  mockDeleteAccount.mockResolvedValue(undefined);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([{ kind: 'wellness', clientId: 'w-1' }]));
});

async function submit(password = 'secret-pass') {
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account and data' }));
}

describe('NFR2 #14: delete account and data screen', () => {
  it('says what will be deleted and needs the password before the button works', async () => {
    await renderScreen(<DeleteAccountScreen />);

    expect(screen.getByText('This deletes everything, for good')).toBeTruthy();
    expect(screen.getByText('• Anything on this phone still waiting to sync')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete account and data' })).toBeDisabled();
  });

  it('deletes the data and the sign-in, clears the phone queue, and goes to sign-in', async () => {
    await renderScreen(<DeleteAccountScreen />);
    await submit();

    expect(auth.confirmPassword).toHaveBeenCalledWith('secret-pass');
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();
    expect(auth.deleteSignIn).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('deletes nothing and says so when the password is wrong', async () => {
    auth.confirmPassword.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    await renderScreen(<DeleteAccountScreen />);
    await submit('wrong');

    expect(await screen.findByText('Email or password is incorrect. Try again.')).toBeTruthy();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(QUEUE_KEY)).not.toBeNull();
  });

  it('keeps everything and shows the error when the API cannot be reached', async () => {
    mockDeleteAccount.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    await renderScreen(<DeleteAccountScreen />);
    await submit();

    expect(await screen.findByText("Can't reach the LoadWise API. Check it is running and try again.")).toBeTruthy();
    expect(auth.deleteSignIn).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(QUEUE_KEY)).not.toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('explains when only the email sign-in is left, and signs out', async () => {
    auth.deleteSignIn.mockRejectedValue(new Error('auth/network-request-failed'));
    await renderScreen(<DeleteAccountScreen />);
    await submit();

    expect(await screen.findByText(/All your LoadWise data has been deleted/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/sign-in');
  });

  it('goes back without deleting anything', async () => {
    await renderScreen(<DeleteAccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));

    expect(mockBack).toHaveBeenCalled();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });
});
