import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localIsoDate } from '@/lib/dates';
import { OFFLINE_SAVED_MESSAGE } from '@/lib/offline-queue';
import { OfflineSyncProvider } from '@/lib/offline-sync';
import { renderScreen } from '@/test-utils';
import WellnessScreen from '@/app/wellness';

const mockBack = jest.fn();
const mockSaveWellness = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: mockBack }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ saveWellness: mockSaveWellness }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => ({ randomUUID: () => '9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b' }));

/** The real offline queue, with the API and AsyncStorage faked. */
function renderForm() {
  return renderScreen(
    <OfflineSyncProvider>
      <WellnessScreen />
    </OfflineSyncProvider>,
  );
}

const questions = ['Sleep', 'Soreness', 'Fatigue', 'Stress'];

/** Picks a score for each question, in the order Sleep, Soreness, Fatigue, Stress. */
async function answer(scores: number[]) {
  for (const [index, score] of scores.entries()) {
    await fireEvent.press(screen.getAllByRole('radio', { name: String(score) })[index]);
  }
}

describe('FR1: wellness check screen (#5)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'u1' } as never,
      loading: false,
      configured: true,
      signIn: jest.fn(),
      createAccount: jest.fn(),
      resetPassword: jest.fn(),
      confirmPassword: jest.fn(),
      deleteSignIn: jest.fn(),
      signOut: jest.fn(),
      getIdToken: jest.fn(),
    });
  });

  it('labels both ends of every 1 to 5 scale in plain language (AC3)', async () => {
    await renderForm();

    for (const text of ['Poor', 'Great', 'Very sore', 'No soreness', 'Exhausted', 'Fresh', 'Very stressed', 'Relaxed']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByLabelText('Sleep, 1 is Poor, 5 is Great')).toBeTruthy();
    for (const question of questions) {
      expect(screen.getByText(question)).toBeTruthy();
    }
  });

  it("saves the four scores for today's date, then returns to Today", async () => {
    mockSaveWellness.mockResolvedValue({ id: 'w1' });
    await renderForm();

    await answer([4, 2, 3, 5]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSaveWellness).toHaveBeenCalledWith({
      date: localIsoDate(new Date()),
      sleep: 4,
      soreness: 2,
      fatigue: 3,
      stress: 5,
      clientId: '9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b',
    });
  });

  it('asks for every score before saving anything', async () => {
    await renderForm();

    await answer([4, 2, 3]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    expect(screen.getByText('Choose a score from 1 to 5 for each question.')).toBeTruthy();
    expect(mockSaveWellness).not.toHaveBeenCalled();
  });

  it('explains when today is already done, and stays on the form (AC2)', async () => {
    mockSaveWellness.mockRejectedValue(new ApiError(409, 'You have already checked in today'));
    await renderForm();

    await answer([4, 2, 3, 5]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    expect(await screen.findByText('You have already checked in today')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows a plain message when the check-in cannot even be stored on the device', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage full'));
    await renderForm();

    await answer([4, 2, 3, 5]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(mockSaveWellness).not.toHaveBeenCalled();
  });

  it('keeps the check-in on this device when there is no signal, and says so (#6 AC1)', async () => {
    mockSaveWellness.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    await renderForm();

    await answer([4, 2, 3, 5]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    expect(await screen.findByText(OFFLINE_SAVED_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save check-in' })).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
