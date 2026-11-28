import { fireEvent, screen } from '@testing-library/react-native';
import type { MyLoad } from '@loadwise/shared';
import { CheckInCard } from '@/components/today/CheckInCard';
import { WeekLoadCard } from '@/components/today/WeekLoadCard';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { PendingEntry } from '@/lib/offline-queue';
import { useOfflineSync } from '@/lib/offline-sync';
import { renderScreen } from '@/test-utils';

const mockPush = jest.fn();
const mockWellnessToday = jest.fn();
const mockMyLoad = jest.fn();
const mockRecentSessions = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(effect, [effect]);
  }
  return { useRouter: () => ({ push: mockPush }), useFocusEffect };
});
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({
    wellnessToday: mockWellnessToday,
    myLoad: mockMyLoad,
    recentSessions: mockRecentSessions,
  }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/offline-sync', () => ({ useOfflineSync: jest.fn() }));

function withQueue(pending: PendingEntry[]) {
  jest.mocked(useOfflineSync).mockReturnValue({
    pending,
    syncCount: 0,
    problems: [],
    dismissProblems: jest.fn(),
    saveSession: jest.fn(),
    saveWellness: jest.fn(),
  });
}

const entry = { id: 'w1', date: '2026-11-25', sleep: 4, soreness: 2, fatigue: 3, stress: 5, clientId: null };

function load(overrides: Partial<MyLoad> = {}): MyLoad {
  return {
    today: '2026-11-25',
    weeks: [
      { weekStart: '2026-10-19', load: 900, partial: false },
      { weekStart: '2026-10-26', load: 1100, partial: false },
      { weekStart: '2026-11-02', load: 1000, partial: false },
      { weekStart: '2026-11-09', load: 1200, partial: false },
      { weekStart: '2026-11-16', load: 1300, partial: false },
      { weekStart: '2026-11-23', load: 640, partial: true },
    ],
    usualWeek: 1150,
    acwr: { model: 'EWMA', value: 1.1, availableFrom: '2026-11-16' },
    monotony: null,
    strain: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({ getIdToken: jest.fn() } as never);
  withQueue([]);
});

describe('FR1 #45: morning check-in card on Today', () => {
  it('invites a check-in when there is none today, and opens the check-in', async () => {
    mockWellnessToday.mockResolvedValue({ date: '2026-11-25', entry: null });
    await renderScreen(<CheckInCard />);

    fireEvent.press(await screen.findByRole('button', { name: 'Start check-in' }));
    expect(mockPush).toHaveBeenCalledWith('/wellness');
  });

  it("shows today's four scores once the athlete has checked in", async () => {
    mockWellnessToday.mockResolvedValue({ date: '2026-11-25', entry });
    await renderScreen(<CheckInCard />);

    expect(await screen.findByText('Done')).toBeTruthy();
    expect(screen.getByLabelText('Sleep 4 of 5')).toBeTruthy();
    expect(screen.getByLabelText('Stress 5 of 5')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start check-in' })).toBeNull();
  });

  it("counts today's check-in saved offline (#6) as done, marked as waiting to sync", async () => {
    mockWellnessToday.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API."));
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    withQueue([
      {
        kind: 'wellness',
        clientId: 'w-1',
        payload: { date, sleep: 3, soreness: 3, fatigue: 2, stress: 4, clientId: 'w-1' },
        createdAt: `${date}T07:00:00.000Z`,
        attempts: 1,
      },
    ]);
    await renderScreen(<CheckInCard />);

    expect(await screen.findByText('Waiting to sync')).toBeTruthy();
    expect(screen.getByLabelText('Fatigue 2 of 5')).toBeTruthy();
  });

  it('still offers the check-in when the API cannot be reached, as it can be saved offline', async () => {
    mockWellnessToday.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API."));
    await renderScreen(<CheckInCard />);

    expect(await screen.findByRole('button', { name: 'Start check-in' })).toBeTruthy();
  });
});

describe('FR2 #45: This week on Today comes from GET /me/load', () => {
  it("shows this week's load, the session count and the usual week", async () => {
    mockMyLoad.mockResolvedValue(load());
    mockRecentSessions.mockResolvedValue([
      { id: 's1', type: 'TRAINING', date: '2026-11-24', durationMinutes: 60, rpe: 6, load: 360, clientId: null },
      { id: 's2', type: 'MATCH', date: '2026-11-25', durationMinutes: 40, rpe: 7, load: 280, clientId: null },
      { id: 's3', type: 'TRAINING', date: '2026-11-20', durationMinutes: 60, rpe: 5, load: 300, clientId: null },
    ]);
    await renderScreen(<WeekLoadCard />);

    expect(await screen.findByText('640')).toBeTruthy();
    expect(screen.getByText('2 sessions · usual week 1,150 AU')).toBeTruthy();
    expect(mockRecentSessions).toHaveBeenCalledWith(50);
  });

  it('explains that the usual week needs 4 completed weeks (DL-007)', async () => {
    mockMyLoad.mockResolvedValue(load({ usualWeek: null }));
    mockRecentSessions.mockResolvedValue([]);
    await renderScreen(<WeekLoadCard />);

    expect(await screen.findByText('0 sessions · usual week after 4 completed weeks')).toBeTruthy();
  });

  it('opens Trends', async () => {
    mockMyLoad.mockResolvedValue(load());
    mockRecentSessions.mockResolvedValue([]);
    await renderScreen(<WeekLoadCard />);

    fireEvent.press(await screen.findByRole('link', { name: /^This week: 640 AU/ }));
    expect(mockPush).toHaveBeenCalledWith('/trends');
  });

  it('says so when offline', async () => {
    mockMyLoad.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API."));
    mockRecentSessions.mockResolvedValue([]);
    await renderScreen(<WeekLoadCard />);

    expect(await screen.findByText('You are offline. Load updates when you are back online.')).toBeTruthy();
  });

  it('shows an API error with Try again, which loads once more', async () => {
    mockMyLoad.mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Try again.')).mockResolvedValueOnce(load());
    mockRecentSessions.mockResolvedValue([]);
    await renderScreen(<WeekLoadCard />);

    fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('640')).toBeTruthy();
    expect(mockMyLoad).toHaveBeenCalledTimes(2);
  });
});
