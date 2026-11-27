import type { LoadDetail, LoadTotals, StaffRole } from '@loadwise/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError, MySquad, StaffWellnessEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import SquadAthleteLoadScreen from '@/app/squad-athlete-load';

const mockAthleteLoad = jest.fn();
const mockAthleteLoadDetail = jest.fn();
const mockAthleteWellness = jest.fn();
const mockMySquads = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ squadId: 'sq-1', athleteId: 'a1', name: 'Athlete One' }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({
    athleteLoad: mockAthleteLoad,
    athleteLoadDetail: mockAthleteLoadDetail,
    athleteWellness: mockAthleteWellness,
    mySquads: mockMySquads,
  }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const totals: LoadTotals = {
  today: '2026-11-25',
  weeks: [
    { weekStart: '2026-10-19', load: 600, partial: false },
    { weekStart: '2026-10-26', load: 480, partial: false },
    { weekStart: '2026-11-02', load: 0, partial: false },
    { weekStart: '2026-11-09', load: 570, partial: false },
    { weekStart: '2026-11-16', load: 1800, partial: false },
    { weekStart: '2026-11-23', load: 720, partial: true },
  ],
  usualWeek: 712.5,
  acwr: { model: 'EWMA', value: 1.2345, availableFrom: '2026-11-15' },
};

const detail: LoadDetail = { today: '2026-11-25', monotony: 1.8472, strain: 3240.4 };

function checkIn(date: string, sleep = 4): StaffWellnessEntry {
  return { date, sleep, soreness: 3, fatigue: 2, stress: 5 };
}

function viewAs(role: StaffRole | 'ATHLETE' | null) {
  const squads: MySquad[] =
    role === null
      ? []
      : role === 'ATHLETE'
        ? [{ squadId: 'sq-1', squadName: 'Harriers', role, consentGiven: true }]
        : [{ squadId: 'sq-1', squadName: 'Harriers', role, inviteCode: 'ABCD2345' }];
  mockMySquads.mockResolvedValue(squads);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    user: { uid: 'staff' } as never,
    loading: false,
    configured: true,
    signIn: jest.fn(),
    createAccount: jest.fn(),
    resetPassword: jest.fn(),
    signOut: jest.fn(),
    getIdToken: jest.fn(),
  });
  mockAthleteLoad.mockResolvedValue(totals);
  mockAthleteLoadDetail.mockResolvedValue(detail);
  mockAthleteWellness.mockResolvedValue([checkIn('2026-11-25'), checkIn('2026-11-24', 2)]);
});

describe('FR4 #51 AC1: S&C coaches and physios see monotony and strain (I-28)', () => {
  it.each<StaffRole>(['SC_COACH', 'PHYSIO'])('shows them to a %s from load-detail', async (role) => {
    viewAs(role);
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByLabelText('Monotony: 1.85')).toBeTruthy();
    expect(screen.getByLabelText('Strain: 3,240 AU')).toBeTruthy();
    expect(screen.getByText(/Monotony is the average daily load divided by how much it varied/)).toBeTruthy();
    expect(screen.getByText(/Counted from their first logged session/)).toBeTruthy();
    expect(mockAthleteLoadDetail).toHaveBeenCalledWith('sq-1', 'a1');
  });

  it('explains when monotony and strain are not available for the last 7 days', async () => {
    viewAs('SC_COACH');
    mockAthleteLoadDetail.mockResolvedValue({ today: '2026-11-25', monotony: null, strain: null });
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText(/Not available for the last 7 days/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Monotony:/)).toBeNull();
  });
});

describe('FR4 #51 AC2: wellness scores follow the role matrix (DL-022)', () => {
  it('shows a physio the recent scores, newest first, with a spoken summary', async () => {
    viewAs('PHYSIO');
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('Recent wellness')).toBeTruthy();
    expect(
      await screen.findByLabelText('Wednesday 25 November: Sleep 4 of 5, Soreness 3 of 5, Fatigue 2 of 5, Stress 5 of 5'),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^Tuesday 24 November: Sleep 2 of 5/)).toBeTruthy();
    expect(screen.getByText(/Last 2 check-ins, newest first. Each score is 1 \(worst\) to 5 \(best\)/)).toBeTruthy();
    expect(mockAthleteWellness).toHaveBeenCalledWith('sq-1', 'a1');
  });

  it('shows an S&C coach the scores too, because DL-022 gives them WELLNESS_SCORES', async () => {
    viewAs('SC_COACH');
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('Recent wellness')).toBeTruthy();
    expect(await screen.findByLabelText(/^Wednesday 25 November: Sleep 4 of 5/)).toBeTruthy();
  });

  it('shows a coach no wellness scores, heading or link, and no monotony or strain', async () => {
    viewAs('COACH');
    await renderScreen(<SquadAthleteLoadScreen />);

    await screen.findByText('1,800');
    // Let the role lookup settle before checking nothing role-specific appeared.
    expect(await screen.findByText(/every squad this athlete trains with/)).toBeTruthy();
    expect(screen.queryByLabelText('Checking your role in this squad')).toBeNull();
    expect(screen.queryByText(/wellness/i)).toBeNull();
    expect(screen.queryByText(/monotony|strain/i)).toBeNull();
  });

  it('shows only the latest 7 of the 28 check-ins the API returns', async () => {
    viewAs('PHYSIO');
    const days = Array.from({ length: 28 }, (_, i) => `2026-11-${String(28 - i).padStart(2, '0')}`);
    mockAthleteWellness.mockResolvedValue(days.map((date) => checkIn(date)));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText(/Last 7 check-ins/)).toBeTruthy();
    expect(screen.getByLabelText(/^Saturday 28 November:/)).toBeTruthy();
    expect(screen.getByLabelText(/^Sunday 22 November:/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Saturday 21 November:/)).toBeNull();
  });

  it('says when the athlete has no check-ins yet', async () => {
    viewAs('PHYSIO');
    mockAthleteWellness.mockResolvedValue([]);
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('Athlete One has not done a wellness check-in yet.')).toBeTruthy();
  });
});

describe('NFR2 #51 AC3: the screen requests only what the viewer’s role allows', () => {
  async function settle() {
    await screen.findByText('1,800');
    await screen.findByText(/every squad this athlete trains with/);
    expect(screen.queryByLabelText('Checking your role in this squad')).toBeNull();
  }

  it('never requests load-detail or wellness for a coach', async () => {
    viewAs('COACH');
    await renderScreen(<SquadAthleteLoadScreen />);
    await settle();

    expect(mockMySquads).toHaveBeenCalled();
    expect(mockAthleteLoadDetail).not.toHaveBeenCalled();
    expect(mockAthleteWellness).not.toHaveBeenCalled();
  });

  it.each([
    ['not in the squad list', null],
    ['an athlete in the squad', 'ATHLETE'],
  ] as const)('requests nothing extra when the viewer is %s', async (_, role) => {
    viewAs(role);
    await renderScreen(<SquadAthleteLoadScreen />);
    await settle();

    expect(mockAthleteLoadDetail).not.toHaveBeenCalled();
    expect(mockAthleteWellness).not.toHaveBeenCalled();
  });

  it('requests nothing extra when the role cannot be checked, then loads on Try again', async () => {
    mockMySquads.mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Try again.'));
    viewAs('PHYSIO');
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText(/could not be checked. Only the load above is shown/)).toBeTruthy();
    expect(mockAthleteLoadDetail).not.toHaveBeenCalled();
    expect(mockAthleteWellness).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Monotony: 1.85')).toBeTruthy();
    expect(mockAthleteWellness).toHaveBeenCalledWith('sq-1', 'a1');
  });

  it('requests no section when the load itself is refused', async () => {
    viewAs('PHYSIO');
    mockAthleteLoad.mockRejectedValue(new ApiError(403, 'You do not have access to this athlete’s data'));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('You do not have access to this athlete’s data')).toBeTruthy();
    expect(screen.getByText(/stops sharing their data with this squad/)).toBeTruthy();
    expect(mockMySquads).not.toHaveBeenCalled();
    expect(mockAthleteLoadDetail).not.toHaveBeenCalled();
    expect(mockAthleteWellness).not.toHaveBeenCalled();
  });
});

describe('FR4 #51 AC4: loading, error and withdrawn-consent states', () => {
  it('shows a loading indicator for each section until it arrives', async () => {
    viewAs('PHYSIO');
    mockAthleteLoadDetail.mockReturnValue(new Promise(() => {}));
    mockAthleteWellness.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByLabelText('Loading monotony and strain')).toBeTruthy();
    expect(screen.getByLabelText('Loading wellness scores')).toBeTruthy();
  });

  it('shows the API’s refusal when the athlete stops sharing, and loads again on Try again', async () => {
    viewAs('PHYSIO');
    mockAthleteWellness
      .mockRejectedValueOnce(new ApiError(403, 'You do not have access to this athlete’s data'))
      .mockResolvedValueOnce([checkIn('2026-11-25')]);
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('You do not have access to this athlete’s data')).toBeTruthy();
    expect(screen.getByText(/stops sharing their data with this squad/)).toBeTruthy();
    // The other section is unaffected.
    expect(await screen.findByLabelText('Monotony: 1.85')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText(/^Wednesday 25 November:/)).toBeTruthy();
  });

  it('says when a section cannot reach LoadWise', async () => {
    viewAs('SC_COACH');
    mockAthleteLoadDetail.mockRejectedValue(new ApiError(0, 'Network request failed'));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText(/You are offline, so monotony and strain can't load/)).toBeTruthy();
  });

  it('shows an error with Try again when a section fails', async () => {
    viewAs('PHYSIO');
    mockAthleteLoadDetail.mockRejectedValue(new ApiError(500, 'Something went wrong. Try again.'));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows a loading indicator while the role is being checked', async () => {
    mockMySquads.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByLabelText('Checking your role in this squad')).toBeTruthy();
  });
});
