import type { SquadOverview } from '@loadwise/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import SquadOverviewScreen from '@/app/squad-overview';

const mockPush = jest.fn();
const mockSquadOverview = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  // The screen is always in view in these tests, so a focus effect behaves like a normal effect.
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(effect, [effect]);
  }
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({ squadId: 'sq-1', squadName: 'Harriers' }),
    useFocusEffect,
  };
});
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ squadOverview: mockSquadOverview }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

/** As the API sends it for a coach: problems first, wellness scores withheld (DL-022). */
const overview: SquadOverview = {
  squadId: 'sq-1',
  squadName: 'Harriers',
  date: '2026-11-25',
  viewerRole: 'COACH',
  athletes: [
    {
      athleteId: 'a1',
      displayName: 'Sleep Athlete',
      sharing: true,
      status: 'flagged',
      flags: [
        {
          rule: 'WELLNESS_LOW',
          metric: 'sleep',
          value: null,
          threshold: null,
          reason: 'Sleep today is more than 1.5 SD below their usual.',
        },
      ],
      checks: { acwr: 'checked', wellness: 'checked' },
      load: { thisWeek: 360, usualWeek: 840, acwr: 1.05 },
    },
    {
      athleteId: 'a2',
      displayName: 'New Athlete',
      sharing: true,
      status: 'incomplete',
      flags: [],
      checks: { acwr: 'unavailable', wellness: 'no-baseline' },
      load: { thisWeek: 0, usualWeek: null, acwr: null },
    },
    {
      athleteId: 'a3',
      displayName: 'Clear Athlete',
      sharing: true,
      status: 'clear',
      flags: [],
      checks: { acwr: 'checked', wellness: 'checked' },
      load: { thisWeek: 1200, usualWeek: 1100, acwr: 0.98 },
    },
    { athleteId: 'a4', displayName: 'Private Athlete', sharing: false },
  ],
};

describe('FR4: squad overview for staff (#10 AC1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'coach' } as never,
      loading: false,
      configured: true,
      signIn: jest.fn(),
      createAccount: jest.fn(),
      resetPassword: jest.fn(),
      signOut: jest.fn(),
      getIdToken: jest.fn(),
    });
  });

  it('lists every athlete with a written status, in the order the API gives', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText('4 athletes: 1 flagged, 1 not fully checked, 1 with no flags, 1 not sharing.')).toBeTruthy();
    expect(screen.getByText('Flagged')).toBeTruthy();
    expect(screen.getByText('Not fully checked')).toBeTruthy();
    expect(screen.getByText('No flags today')).toBeTruthy();
    expect(screen.getByText('Not sharing data with this squad')).toBeTruthy();
    const names = screen.getAllByText(/Athlete$/).map((node) => node.props.children);
    expect(names).toEqual(['Sleep Athlete', 'New Athlete', 'Clear Athlete', 'Private Athlete']);
    expect(mockSquadOverview).toHaveBeenCalledWith('sq-1');
  });

  it('shows each flag’s reason from the engine', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText('Sleep today is more than 1.5 SD below their usual.')).toBeTruthy();
    expect(screen.getByText('This week 360 AU · Load ratio 1.05')).toBeTruthy();
  });

  it('says why an athlete with no flags is not fully checked, rather than showing an all-clear', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText('Load ratio not available yet.')).toBeTruthy();
    expect(screen.getByText('Wellness baseline still building.')).toBeTruthy();
    expect(screen.getByText('This week 0 AU · Load ratio not available yet')).toBeTruthy();
  });

  it('gives each sharing athlete one accessible row that opens their combined load (#8)', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    const row = await screen.findByRole('button', {
      name: 'Sleep Athlete, Flagged. Sleep today is more than 1.5 SD below their usual. This week 360 AU · Load ratio 1.05',
    });
    await fireEvent.press(row);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/squad-athlete-load',
      params: { squadId: 'sq-1', athleteId: 'a1', name: 'Sleep Athlete' },
    });
  });

  it('offers nothing to open for an athlete who does not share', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByLabelText('Private Athlete, not sharing data with this squad')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /Private Athlete/ })).toHaveLength(0);
  });

  it('never uses advice, prediction or diagnosis wording (DL-006)', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    await screen.findByText('Flagged');
    const text = screen
      .getAllByText(/./)
      .map((node) => String(node.props.children))
      .join(' ');
    expect(text).not.toMatch(/injur|risk|diagnos|\brest\b|reduce|return to play|should/i);
  });

  it('explains a squad with no athletes yet', async () => {
    mockSquadOverview.mockResolvedValue({ ...overview, athletes: [] });
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText('No athletes yet')).toBeTruthy();
  });

  it('shows the API’s reason when access is refused, and retries', async () => {
    mockSquadOverview
      .mockRejectedValueOnce(new ApiError(403, 'Only staff in this squad can see this'))
      .mockResolvedValueOnce(overview);
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText('Only staff in this squad can see this')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Flagged')).toBeTruthy();
  });

  it('says when LoadWise cannot be reached', async () => {
    mockSquadOverview.mockRejectedValue(new ApiError(0, 'Network request failed'));
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText(/Can't reach LoadWise/)).toBeTruthy();
  });

  it('shows a loading indicator until the overview arrives', async () => {
    mockSquadOverview.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SquadOverviewScreen />);

    expect(screen.getByLabelText('Loading the squad overview')).toBeTruthy();
  });
});
