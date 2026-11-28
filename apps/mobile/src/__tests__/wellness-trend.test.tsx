import { fireEvent, screen } from '@testing-library/react-native';
import type { WellnessBaseline, WellnessTrendPoint } from '@loadwise/analytics';
import { ApiError } from '@/lib/api';
import type { WellnessTrend as WellnessTrendData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import { WellnessTrend } from '@/components/WellnessTrend';
import TrendsScreen from '@/app/(tabs)/trends';

const mockMyWellnessTrend = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(effect, [effect]);
  }
  return { useFocusEffect, useRouter: () => ({ push: jest.fn() }) };
});
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  // The load card is tested in trends.test.tsx, so here it just stays loading.
  createApiClient: () => ({ myWellnessTrend: mockMyWellnessTrend, myLoad: () => new Promise(() => {}) }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const baseline: WellnessBaseline = {
  count: 20,
  items: {
    sleep: { mean: 3.94, sd: 0.6 },
    soreness: { mean: 3.7, sd: 0.5 },
    fatigue: { mean: 3.6, sd: 0.5 },
    stress: { mean: 3.8, sd: 0.4 },
  },
};
const thisWeekAverage = { count: 6, items: { sleep: 3.2, soreness: 3.8, fatigue: 3.4, stress: 3.9 } };

function trend(thisWeek: WellnessTrendPoint, baselineCheckIns: number): WellnessTrendData {
  return { date: '2026-11-25', baselineCheckIns, minCheckIns: 14, weeks: [thisWeek] };
}

beforeEach(() => {
  jest.clearAllMocks();
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

describe('FR2 #9 AC3: wellness 7-day averages against baseline on Trends', () => {
  it("shows each item's 7-day average and usual, with an accessible label", async () => {
    mockMyWellnessTrend.mockResolvedValue(
      trend({ endDate: '2026-11-25', average: thisWeekAverage, baseline }, 20),
    );
    await renderScreen(<WellnessTrend />);

    expect(await screen.findByLabelText('Sleep: 7-day average 3.2, usual 3.9')).toBeTruthy();
    expect(screen.getByLabelText('Soreness: 7-day average 3.8, usual 3.7')).toBeTruthy();
    expect(screen.getByLabelText('Fatigue: 7-day average 3.4, usual 3.6')).toBeTruthy();
    expect(screen.getByLabelText('Stress: 7-day average 3.9, usual 3.8')).toBeTruthy();
  });

  it('explains the baseline needs 14 check-ins and shows how many so far', async () => {
    mockMyWellnessTrend.mockResolvedValue(
      trend({ endDate: '2026-11-25', average: thisWeekAverage, baseline: null }, 9),
    );
    await renderScreen(<WellnessTrend />);

    expect(await screen.findByText('Your usual needs 14 check-ins in 28 days (9 so far).')).toBeTruthy();
    expect(screen.getByLabelText('Wellness baseline: 9 of 14 check-ins')).toBeTruthy();
    expect(screen.getByLabelText('Sleep: 7-day average 3.2')).toBeTruthy();
  });

  it('says when there are no check-ins in the last 7 days', async () => {
    mockMyWellnessTrend.mockResolvedValue(trend({ endDate: '2026-11-25', average: null, baseline: null }, 0));
    await renderScreen(<WellnessTrend />);

    expect(await screen.findByText('No check-ins in the last 7 days.')).toBeTruthy();
  });

  it('shows a loading indicator', async () => {
    mockMyWellnessTrend.mockReturnValue(new Promise(() => {}));
    await renderScreen(<WellnessTrend />);

    expect(screen.getByLabelText('Loading wellness trend')).toBeTruthy();
  });

  it('shows an offline message when the API cannot be reached', async () => {
    mockMyWellnessTrend.mockRejectedValue(new ApiError(0, 'unreachable'));
    await renderScreen(<WellnessTrend />);

    expect(await screen.findByText('You are offline. Your wellness trend loads when you are back online.')).toBeTruthy();
  });

  it('shows an error and loads again on Try again', async () => {
    mockMyWellnessTrend
      .mockRejectedValueOnce(new ApiError(403, 'Agree to health-data processing in first-time setup first'))
      .mockResolvedValueOnce(trend({ endDate: '2026-11-25', average: null, baseline: null }, 0));
    await renderScreen(<WellnessTrend />);

    expect(await screen.findByText('Agree to health-data processing in first-time setup first')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No check-ins in the last 7 days.')).toBeTruthy();
  });

  it('shows every week, oldest first, against the usual for that week (AC3)', async () => {
    const earlier = { count: 4, items: { sleep: 3.5, soreness: 3, fatigue: 2.75, stress: 4 } };
    mockMyWellnessTrend.mockResolvedValue({
      date: '2026-11-25',
      baselineCheckIns: 20,
      minCheckIns: 14,
      weeks: [
        { endDate: '2026-11-11', average: earlier, baseline: null },
        { endDate: '2026-11-18', average: null, baseline },
        { endDate: '2026-11-25', average: thisWeekAverage, baseline },
      ],
    });
    await renderScreen(<WellnessTrend />);

    expect(
      await screen.findByLabelText(
        'Sleep, 7-day averages over the last 3 weeks, oldest first: 3.5 (no usual yet); no check-ins; 3.2 (usual 3.9)',
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Fatigue, 7-day averages over the last 3 weeks, oldest first: 2.8 (no usual yet); no check-ins; 3.4 (usual 3.6)',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Last 3 weeks, oldest on the left')).toBeTruthy();
    expect(screen.getByLabelText('Sleep: 7-day average 3.2, usual 3.9')).toBeTruthy();
  });

  it('still shows earlier weeks when there is no check-in in the last 7 days', async () => {
    mockMyWellnessTrend.mockResolvedValue({
      date: '2026-11-25',
      baselineCheckIns: 20,
      minCheckIns: 14,
      weeks: [
        { endDate: '2026-11-18', average: thisWeekAverage, baseline },
        { endDate: '2026-11-25', average: null, baseline },
      ],
    });
    await renderScreen(<WellnessTrend />);

    expect(await screen.findByText('No check-ins in the last 7 days.')).toBeTruthy();
    expect(
      screen.getByLabelText('Stress, 7-day averages over the last 2 weeks, oldest first: 3.9 (usual 3.8); no check-ins'),
    ).toBeTruthy();
  });

  it('appears on the Trends tab', async () => {
    mockMyWellnessTrend.mockResolvedValue(
      trend({ endDate: '2026-11-25', average: thisWeekAverage, baseline }, 20),
    );
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByLabelText('Sleep: 7-day average 3.2, usual 3.9')).toBeTruthy();
  });
});
