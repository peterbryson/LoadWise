import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localIsoDate } from '@/lib/dates';
import { renderScreen } from '@/test-utils';
import LogTeamSessionScreen from '@/app/log-team-session';

const mockBack = jest.fn();
const mockCreate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ squadId: 'sq-a', squadName: 'Harriers' }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ createTeamSession: mockCreate }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const save = () => fireEvent.press(screen.getByRole('button', { name: 'Log for the squad' }));

describe('FR1 #17 AC1: the coach logs a team session once', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ getIdToken: jest.fn() } as never);
  });

  it('sends one request for the squad and says how many athletes are asked for their RPE', async () => {
    mockCreate.mockResolvedValue({ id: 'ts-1', squadId: 'sq-a', type: 'MATCH', date: '2026-11-27', durationMinutes: 75, athletesAsked: 12 });
    await renderScreen(<LogTeamSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Match' }));
    await fireEvent.press(screen.getByRole('radio', { name: '75' }));
    await save();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith('sq-a', { type: 'MATCH', date: localIsoDate(new Date()), durationMinutes: 75 });
    expect(await screen.findByText('Logged for Harriers')).toBeTruthy();
    expect(screen.getByText('12 athletes are asked to add their RPE on their Today screen.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('can be logged for yesterday', async () => {
    mockCreate.mockResolvedValue({ id: 'ts-1', squadId: 'sq-a', type: 'TRAINING', date: '2026-11-26', durationMinutes: 60, athletesAsked: 1 });
    await renderScreen(<LogTeamSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Yesterday' }));
    await fireEvent.press(screen.getByRole('radio', { name: '60' }));
    await save();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(mockCreate).toHaveBeenCalledWith('sq-a', expect.objectContaining({ date: localIsoDate(yesterday) }));
    expect(await screen.findByText('1 athlete is asked to add their RPE on their Today screen.')).toBeTruthy();
  });

  it.each([
    ['no duration', []],
    ['0 other minutes', ['0']],
    ['601 other minutes', ['601']],
  ])('rejects %s with a clear message and sends nothing', async (_case, other) => {
    await renderScreen(<LogTeamSessionScreen />);
    if (other.length > 0) {
      await fireEvent.press(screen.getByRole('radio', { name: 'Other duration' }));
      await fireEvent.changeText(screen.getByLabelText('Minutes'), other[0]);
    }
    await save();

    expect(await screen.findByText('Choose a duration from 1 to 600 minutes.')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['a physio', new ApiError(403, 'Only a coach or S&C coach in this squad can log a team session')],
    ['no signal', new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again.")],
  ])('shows the reason when the API refuses or cannot be reached (%s), and stays on the form', async (_case, error) => {
    mockCreate.mockRejectedValue(error);
    await renderScreen(<LogTeamSessionScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: '90' }));
    await save();

    expect(await screen.findByText(error.message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log for the squad' })).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
