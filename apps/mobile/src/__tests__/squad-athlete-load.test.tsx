import type { LoadTotals } from '@loadwise/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import SquadAthleteLoadScreen from '@/app/squad-athlete-load';

const mockAthleteLoad = jest.fn();
// #51: the screen looks up the viewer's role; these tests view it as a coach.
const mockMySquads = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ squadId: 'sq-1', athleteId: 'a1', name: 'Athlete One' }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ athleteLoad: mockAthleteLoad, mySquads: mockMySquads }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
// #21's section loads its own data and is tested in injury-restrictions.test.tsx.
jest.mock('@/components/injuries/InjuryRestrictionsSection', () => ({ InjuryRestrictionsSection: () => null }));

function totals(overrides: Partial<LoadTotals> = {}): LoadTotals {
  return {
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
    ...overrides,
  };
}

describe('FR2: staff see an athlete’s combined load (#8 AC2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMySquads.mockResolvedValue([{ squadId: 'sq-1', squadName: 'Harriers', role: 'COACH', inviteCode: 'ABCD2345' }]);
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
  });

  it('asks the API for this athlete in this squad and shows weekly load and the ratio', async () => {
    mockAthleteLoad.mockResolvedValue(totals());
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('1,800')).toBeTruthy();
    expect(screen.getByText('720')).toBeTruthy();
    expect(screen.getByText('1.23')).toBeTruthy();
    expect(screen.getByText('Their recent load is higher than their longer-term load.')).toBeTruthy();
    expect(screen.getByText(/every squad this athlete trains with, each session counted once/)).toBeTruthy();
    expect(mockAthleteLoad).toHaveBeenCalledWith('sq-1', 'a1');
  });

  it('never shows monotony or strain, which a coach may not see (#11)', async () => {
    mockAthleteLoad.mockResolvedValue(totals());
    await renderScreen(<SquadAthleteLoadScreen />);

    await screen.findByText('1,800');
    expect(screen.queryByText(/monotony|strain/i)).toBeNull();
  });

  it('says when the ratio will be available, in the third person', async () => {
    mockAthleteLoad.mockResolvedValue(
      totals({ acwr: { model: 'EWMA', value: null, availableFrom: '2026-12-21' } }),
    );
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('Available from 21 December, once LoadWise has 28 days of their data.')).toBeTruthy();
  });

  it('explains an athlete with no sessions yet', async () => {
    mockAthleteLoad.mockResolvedValue(
      totals({
        weeks: totals().weeks.map((week) => ({ ...week, load: 0 })),
        usualWeek: null,
        acwr: { model: 'EWMA', value: null, availableFrom: null },
      }),
    );
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('Athlete One has not logged any sessions yet.')).toBeTruthy();
  });

  it('shows the API’s reason when access is refused, for example after sharing stops, and retries', async () => {
    mockAthleteLoad
      .mockRejectedValueOnce(new ApiError(403, 'You do not have access to this athlete’s data'))
      .mockResolvedValueOnce(totals());
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('You do not have access to this athlete’s data')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('1,800')).toBeTruthy();
  });

  it('says when LoadWise cannot be reached', async () => {
    mockAthleteLoad.mockRejectedValue(new ApiError(0, 'Network request failed'));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText(/Can't reach LoadWise/)).toBeTruthy();
  });

  it('shows a loading indicator until the load arrives', async () => {
    mockAthleteLoad.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(screen.getByLabelText("Loading Athlete One's load")).toBeTruthy();
  });
});
