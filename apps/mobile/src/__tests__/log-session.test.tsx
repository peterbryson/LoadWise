import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localIsoDate } from '@/lib/dates';
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

async function save() {
  await fireEvent.press(screen.getByRole('button', { name: 'Save session' }));
}

describe('FR1: log session form (#4)', () => {
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

  it('asks for an RPE when it is missing, as in the "Missing RPE" design (AC2)', async () => {
    await renderScreen(<LogSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '60' }));
    await save();

    expect(screen.getByText('Choose an RPE from 1 to 10.')).toBeTruthy();
    expect(mockLogSession).not.toHaveBeenCalled();
  });

  it('rejects a typed duration over 600 minutes and saves nothing (AC2)', async () => {
    await renderScreen(<LogSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Other duration' }));
    await fireEvent.changeText(screen.getByLabelText('Minutes'), '601');
    await fireEvent.press(screen.getByRole('radio', { name: '6' }));
    await save();

    expect(screen.getByText('Choose a duration from 1 to 600 minutes.')).toBeTruthy();
    expect(mockLogSession).not.toHaveBeenCalled();
  });

  it('shows session load from the analytics engine: RPE 7 × 60 min = 420 AU', async () => {
    await renderScreen(<LogSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '60' }));
    await fireEvent.press(screen.getByRole('radio', { name: '7' }));

    expect(screen.getByText('420 AU')).toBeTruthy();
    expect(screen.getByText('7: Very hard')).toBeTruthy();
  });

  it("saves type, today's date, duration and RPE, then returns to Today (AC1)", async () => {
    mockLogSession.mockResolvedValue({ id: 's1' });
    await renderScreen(<LogSessionScreen />);

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
    });
  });

  it('shows why a save failed and stays on the form', async () => {
    mockLogSession.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    await renderScreen(<LogSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '45' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5' }));
    await save();

    expect(await screen.findByText("Can't reach the LoadWise API. Check it is running and try again.")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
