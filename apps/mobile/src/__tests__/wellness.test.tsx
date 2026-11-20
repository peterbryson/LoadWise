import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localIsoDate } from '@/lib/dates';
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

const questions = ['Sleep', 'Soreness', 'Fatigue', 'Stress'];

/** Picks a score for each question, in the order Sleep, Soreness, Fatigue, Stress. */
async function answer(scores: number[]) {
  for (const [index, score] of scores.entries()) {
    await fireEvent.press(screen.getAllByRole('radio', { name: String(score) })[index]);
  }
}

describe('FR1: wellness check screen (#5)', () => {
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

  it('labels both ends of every 1 to 5 scale in plain language (AC3)', async () => {
    await renderScreen(<WellnessScreen />);

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
    await renderScreen(<WellnessScreen />);

    await answer([4, 2, 3, 5]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSaveWellness).toHaveBeenCalledWith({
      date: localIsoDate(new Date()),
      sleep: 4,
      soreness: 2,
      fatigue: 3,
      stress: 5,
    });
  });

  it('asks for every score before saving anything', async () => {
    await renderScreen(<WellnessScreen />);

    await answer([4, 2, 3]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    expect(screen.getByText('Choose a score from 1 to 5 for each question.')).toBeTruthy();
    expect(mockSaveWellness).not.toHaveBeenCalled();
  });

  it('explains when today is already done, and stays on the form (AC2)', async () => {
    mockSaveWellness.mockRejectedValue(new ApiError(409, 'You have already checked in today'));
    await renderScreen(<WellnessScreen />);

    await answer([4, 2, 3, 5]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    expect(await screen.findByText('You have already checked in today')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows a plain message for an unexpected failure', async () => {
    mockSaveWellness.mockRejectedValue(new Error('boom'));
    await renderScreen(<WellnessScreen />);

    await answer([4, 2, 3, 5]);
    await fireEvent.press(screen.getByRole('button', { name: 'Save check-in' }));

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
  });
});
