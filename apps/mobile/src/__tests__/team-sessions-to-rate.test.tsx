import type { TeamSessionToRate } from '@loadwise/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TeamSessionsToRate } from '@/components/TeamSessionsToRate';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';

const mockToRate = jest.fn();
const mockRate = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  // Today is always in view in these tests, so a focus effect behaves like a normal effect.
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(effect, [effect]);
  }
  return { useFocusEffect };
});
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ teamSessionsToRate: mockToRate, rateTeamSession: mockRate }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
// A new key on every call, so a test can tell a reused key from a fresh one.
let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}` }));

const CLIENT_ID = '00000000-0000-4000-8000-000000000001';

const training: TeamSessionToRate = {
  id: 'ts-1',
  squadId: 'sq-a',
  squadName: 'Harriers',
  type: 'TRAINING',
  date: '2026-11-26',
  durationMinutes: 90,
};
const match: TeamSessionToRate = {
  id: 'ts-2',
  squadId: 'sq-b',
  squadName: 'Club GAA',
  type: 'MATCH',
  date: '2026-11-24',
  durationMinutes: 70,
};

const trainingGroup = 'RPE 6 to 10 for Harriers training on Thu 26 Nov';

describe('FR1 #17 AC2: athletes are asked for their RPE on Today', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUuid = 0;
    jest.mocked(useAuth).mockReturnValue({ getIdToken: jest.fn() } as never);
  });

  it('shows nothing while loading or when there is nothing to rate', async () => {
    let resolve: (items: TeamSessionToRate[]) => void = () => undefined;
    mockToRate.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderScreen(<TeamSessionsToRate />);
    expect(screen.queryByText(/RPE|Team sessions/)).toBeNull();

    resolve([]);
    await waitFor(() => expect(mockToRate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/RPE|Team sessions/)).toBeNull();
  });

  it('lists each team session to rate with its squad, type, duration and day', async () => {
    mockToRate.mockResolvedValue([training, match]);
    await renderScreen(<TeamSessionsToRate />);

    expect(await screen.findByRole('header', { name: 'Add your RPE (2)' })).toBeTruthy();
    expect(screen.getByText('Harriers')).toBeTruthy();
    expect(screen.getByText('Training · 90 min · Thu 26 Nov')).toBeTruthy();
    expect(screen.getByText('Club GAA')).toBeTruthy();
    expect(screen.getByText('Match · 70 min · Tue 24 Nov')).toBeTruthy();
    // Each picker names its session, so a screen reader can tell two of them apart.
    expect(screen.getByLabelText(trainingGroup).props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByLabelText('RPE 1 to 5 for Club GAA match on Tue 24 Nov')).toBeTruthy();
  });

  it('saves the chosen RPE in two taps, then thanks the athlete and removes the session', async () => {
    mockToRate.mockResolvedValue([training]);
    mockRate.mockResolvedValue({ id: 's1', type: 'TRAINING', date: training.date, durationMinutes: 90, rpe: 7, load: 630, clientId: CLIENT_ID });
    await renderScreen(<TeamSessionsToRate />);

    await fireEvent.press(await screen.findByRole('radio', { name: '7' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save RPE 7' }));

    expect(mockRate).toHaveBeenCalledWith('ts-1', { rpe: 7, clientId: CLIENT_ID });
    expect(await screen.findByText('Saved: Harriers, RPE 7, 630 AU')).toBeTruthy();
    expect(screen.queryByText('Training · 90 min · Thu 26 Nov')).toBeNull();
  });

  it('asks for an RPE before saving, and sends nothing', async () => {
    mockToRate.mockResolvedValue([training]);
    await renderScreen(<TeamSessionsToRate />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Save RPE' }));

    expect(await screen.findByText('Choose an RPE from 1 to 10.')).toBeTruthy();
    expect(mockRate).not.toHaveBeenCalled();
  });

  it('keeps the session and says why when it cannot be saved, and a retry reuses the same key', async () => {
    mockToRate.mockResolvedValue([training]);
    mockRate.mockRejectedValueOnce(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    await renderScreen(<TeamSessionsToRate />);

    await fireEvent.press(await screen.findByRole('radio', { name: '5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save RPE 5' }));

    expect(await screen.findByText("Can't reach the LoadWise API. Check it is running and try again.")).toBeTruthy();
    expect(screen.getByText('Training · 90 min · Thu 26 Nov')).toBeTruthy();

    mockRate.mockResolvedValueOnce({ id: 's1', type: 'TRAINING', date: training.date, durationMinutes: 90, rpe: 5, load: 450, clientId: CLIENT_ID });
    await fireEvent.press(screen.getByRole('button', { name: 'Save RPE 5' }));
    expect(await screen.findByText('Saved: Harriers, RPE 5, 450 AU')).toBeTruthy();
    expect(mockRate).toHaveBeenNthCalledWith(2, 'ts-1', { rpe: 5, clientId: CLIENT_ID });
  });

  it('shows the API’s message for an already rated session and loads the list again (409)', async () => {
    mockToRate.mockResolvedValueOnce([training]).mockResolvedValueOnce([]);
    mockRate.mockRejectedValue(new ApiError(409, 'You have already added your RPE to this team session'));
    await renderScreen(<TeamSessionsToRate />);

    await fireEvent.press(await screen.findByRole('radio', { name: '6' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save RPE 6' }));

    expect(await screen.findByText('You have already added your RPE to this team session')).toBeTruthy();
    await waitFor(() => expect(mockToRate).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Training · 90 min · Thu 26 Nov')).toBeNull();
  });

  it('shows an error with Try again when the list cannot be loaded', async () => {
    mockToRate.mockRejectedValueOnce(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    mockToRate.mockResolvedValueOnce([training]);
    await renderScreen(<TeamSessionsToRate />);

    expect(await screen.findByText("Can't reach the LoadWise API. Check it is running and try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Training · 90 min · Thu 26 Nov')).toBeTruthy();
  });
});
