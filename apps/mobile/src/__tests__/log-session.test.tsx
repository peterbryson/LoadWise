import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localIsoDate } from '@/lib/dates';
import { OFFLINE_SAVED_MESSAGE } from '@/lib/offline-queue';
import { OfflineSyncProvider } from '@/lib/offline-sync';
import { renderScreen } from '@/test-utils';
import LogSessionScreen from '@/app/log-session';

const mockBack = jest.fn();
const mockLogSession = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ logSession: mockLogSession }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => ({ randomUUID: () => '9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b' }));

const CLIENT_ID = '9b2f6a1e-3c4d-4e5f-8a7b-1c2d3e4f5a6b';
const noSignal = () => new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again.");

/** The real offline queue, with the API and AsyncStorage faked. */
function renderForm() {
  return renderScreen(
    <OfflineSyncProvider>
      <LogSessionScreen />
    </OfflineSyncProvider>,
  );
}

async function storedQueue(): Promise<unknown[]> {
  return JSON.parse((await AsyncStorage.getItem('loadwise.offline-queue.v1.u1')) ?? '[]');
}

async function save() {
  await fireEvent.press(screen.getByRole('button', { name: 'Save session' }));
}

describe('FR1: log session form (#4)', () => {
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

  it('asks for an RPE when it is missing, as in the "Missing RPE" design (AC2)', async () => {
    await renderForm();

    await fireEvent.press(screen.getByRole('radio', { name: '60' }));
    await save();

    expect(screen.getByText('Choose an RPE from 1 to 10.')).toBeTruthy();
    expect(mockLogSession).not.toHaveBeenCalled();
  });

  it('rejects a typed duration over 600 minutes and saves nothing (AC2)', async () => {
    await renderForm();

    await fireEvent.press(screen.getByRole('radio', { name: 'Other duration' }));
    await fireEvent.changeText(screen.getByLabelText('Minutes'), '601');
    await fireEvent.press(screen.getByRole('radio', { name: '6' }));
    await save();

    expect(screen.getByText('Choose a duration from 1 to 600 minutes.')).toBeTruthy();
    expect(mockLogSession).not.toHaveBeenCalled();
  });

  it('shows session load from the analytics engine: RPE 7 × 60 min = 420 AU', async () => {
    await renderForm();

    await fireEvent.press(screen.getByRole('radio', { name: '60' }));
    await fireEvent.press(screen.getByRole('radio', { name: '7' }));

    expect(screen.getByText('420 AU')).toBeTruthy();
    expect(screen.getByText('7: Very hard')).toBeTruthy();
  });

  it("saves type, today's date, duration and RPE, then returns to Today (AC1)", async () => {
    mockLogSession.mockResolvedValue({ id: 's1' });
    await renderForm();

    await fireEvent.press(screen.getByRole('radio', { name: 'Match' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Other duration' }));
    await fireEvent.changeText(screen.getByLabelText('Minutes'), '50');
    await fireEvent.press(screen.getByRole('radio', { name: '8' }));
    await save();

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockLogSession).toHaveBeenCalledWith({
      type: 'MATCH',
      date: localIsoDate(new Date()),
      durationMinutes: 50,
      rpe: 8,
      clientId: CLIENT_ID,
    });
    expect(await storedQueue()).toEqual([]);
  });

  it('shows why the API refused a save, stays on the form and keeps nothing to sync', async () => {
    mockLogSession.mockRejectedValue(new ApiError(403, 'Agree to health-data processing first'));
    await renderForm();

    await fireEvent.press(screen.getByRole('radio', { name: '45' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5' }));
    await save();

    expect(await screen.findByText('Agree to health-data processing first')).toBeTruthy();
    expect(screen.queryByText(OFFLINE_SAVED_MESSAGE)).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
    expect(await storedQueue()).toEqual([]);
  });
});

describe('FR1: logging a session with no signal (#6 AC1)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'u1' } as never, getIdToken: jest.fn() } as never);
  });

  it('keeps the session on this device, says so, and offers the way back to Today', async () => {
    mockLogSession.mockRejectedValue(noSignal());
    await renderForm();

    await fireEvent.press(screen.getByRole('radio', { name: '45' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5' }));
    await save();

    expect(await screen.findByText(OFFLINE_SAVED_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/Can't reach/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save session' })).toBeNull();
    expect(await storedQueue()).toEqual([expect.objectContaining({ kind: 'session', clientId: CLIENT_ID })]);
    expect(mockBack).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
