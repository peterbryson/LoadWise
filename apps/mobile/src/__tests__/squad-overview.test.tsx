import type { SquadOverview } from '@loadwise/shared';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
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
  generatedAt: '2026-11-25T09:15:00.000Z',
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
      logging: { checkedInToday: true, lastSessionDate: '2026-11-25' },
      load: { thisWeek: 360, usualWeek: 840, acwr: 1.05 },
    },
    {
      athleteId: 'a2',
      displayName: 'New Athlete',
      sharing: true,
      status: 'incomplete',
      flags: [],
      checks: { acwr: 'unavailable', wellness: 'no-baseline' },
      logging: { checkedInToday: false, lastSessionDate: null },
      load: { thisWeek: 0, usualWeek: null, acwr: null },
    },
    {
      athleteId: 'a3',
      displayName: 'Clear Athlete',
      sharing: true,
      status: 'clear',
      flags: [],
      checks: { acwr: 'checked', wellness: 'checked' },
      logging: { checkedInToday: true, lastSessionDate: '2026-11-24' },
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
      confirmPassword: jest.fn(),
      deleteSignIn: jest.fn(),
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
      name: 'Sleep Athlete, Flagged. Sleep today is more than 1.5 SD below their usual. Checked in today · Last session today. This week 360 AU · Load ratio 1.05',
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

describe('FR4 #50: who has logged today, filters and refresh', () => {
  /** The phone shows times in its own zone, so the expected text is formatted the same way. */
  const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const names = () => screen.queryAllByText(/Athlete$/).map((node) => node.props.children);
  /** The gesture itself cannot run in Jest; this fires the refresh the pull triggers. */
  const pullToRefresh = async () => {
    // This RNTL version's fireEvent does not reach a ScrollView's refreshControl, so call the
    // RefreshControl attached to the screen's ScrollView directly.
    const { refreshControl } = screen.getByTestId('squad-overview').props;
    await act(async () => {
      await refreshControl.props.onRefresh();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Also drops any queued mockResolvedValueOnce answers, so one test cannot leak into the next.
    mockSquadOverview.mockReset();
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'coach' } as never,
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

  it('AC1: shows whether each sharing athlete checked in today and when they last trained', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText('Checked in today · Last session today')).toBeTruthy();
    expect(screen.getByText('Not checked in today · No sessions logged yet')).toBeTruthy();
    expect(screen.getByText('Checked in today · Last session yesterday')).toBeTruthy();
    // The check-in is not also repeated as a "not fully checked" note.
    expect(screen.queryByText('No wellness check-in today.')).toBeNull();
  });

  it('shows no logging data for an athlete who does not share', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    const row = await screen.findByLabelText('Private Athlete, not sharing data with this squad');
    expect(within(row).queryByText(/checked in|session/i)).toBeNull();
    expect(screen.getAllByText(/checked in today/i)).toHaveLength(3);
  });

  it('AC2: filters to flagged athletes, to those not logged today, and back to all', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);
    await screen.findByText('Flagged');

    await fireEvent.press(screen.getByRole('radio', { name: 'Flagged, 1' }));
    expect(names()).toEqual(['Sleep Athlete']);
    expect(screen.getByRole('radio', { name: 'Flagged, 1' }).props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole('radio', { name: 'Not logged today, 1' }));
    expect(names()).toEqual(['New Athlete']);

    await fireEvent.press(screen.getByRole('radio', { name: 'All athletes, 4' }));
    expect(names()).toEqual(['Sleep Athlete', 'New Athlete', 'Clear Athlete', 'Private Athlete']);
    expect(mockSquadOverview).toHaveBeenCalledTimes(1);
  });

  it('AC2: says so when nobody matches a filter', async () => {
    const everyoneIn = {
      ...overview,
      athletes: overview.athletes.map((a) =>
        a.sharing ? { ...a, status: 'clear' as const, flags: [], logging: { ...a.logging, checkedInToday: true } } : a,
      ),
    };
    mockSquadOverview.mockResolvedValue(everyoneIn);
    await renderScreen(<SquadOverviewScreen />);
    await screen.findByText('All (4)');

    await fireEvent.press(screen.getByRole('radio', { name: 'Flagged, 0' }));
    expect(screen.getByText('No athletes are flagged today.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Not logged today, 0' }));
    expect(screen.getByText('Every athlete sharing data has checked in today.')).toBeTruthy();
    expect(names()).toEqual([]);
  });

  it('AC3: shows when the overview was last updated', async () => {
    mockSquadOverview.mockResolvedValue(overview);
    await renderScreen(<SquadOverviewScreen />);

    expect(await screen.findByText(`Last updated ${clock(overview.generatedAt)}`)).toBeTruthy();
  });

  it('AC3: pull to refresh reloads the overview and its time, keeping the filter', async () => {
    const later: SquadOverview = {
      ...overview,
      generatedAt: '2026-11-25T16:40:00.000Z',
      athletes: overview.athletes.map((a) =>
        a.athleteId === 'a2' && a.sharing ? { ...a, logging: { checkedInToday: true, lastSessionDate: null } } : a,
      ),
    };
    mockSquadOverview.mockResolvedValueOnce(overview).mockResolvedValueOnce(later);
    await renderScreen(<SquadOverviewScreen />);
    await screen.findByText('Flagged');
    await fireEvent.press(screen.getByRole('radio', { name: 'Not logged today, 1' }));
    expect(names()).toEqual(['New Athlete']);

    await pullToRefresh();

    expect(await screen.findByText(`Last updated ${clock(later.generatedAt)}`)).toBeTruthy();
    expect(mockSquadOverview).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Every athlete sharing data has checked in today.')).toBeTruthy();
  });

  it('AC3: offers a Refresh button as well, for anyone who cannot pull (WCAG 2.5.1)', async () => {
    mockSquadOverview
      .mockResolvedValueOnce(overview)
      .mockResolvedValueOnce({ ...overview, generatedAt: '2026-11-25T17:05:00.000Z' });
    await renderScreen(<SquadOverviewScreen />);
    await screen.findByText('Flagged');

    await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByText(`Last updated ${clock('2026-11-25T17:05:00.000Z')}`)).toBeTruthy();
  });

  it('keeps the last overview, with its time, when a refresh has no signal', async () => {
    mockSquadOverview.mockResolvedValueOnce(overview).mockRejectedValueOnce(new ApiError(0, 'Network request failed'));
    await renderScreen(<SquadOverviewScreen />);
    await screen.findByText('Flagged');

    await pullToRefresh();

    expect(
      await screen.findByText(`Couldn't refresh, so this is still the overview from ${clock(overview.generatedAt)}.`),
    ).toBeTruthy();
    expect(screen.getByText('Sleep Athlete')).toBeTruthy();
  });

  it('removes the list when a refresh is refused, so no data the viewer lost access to stays on screen', async () => {
    mockSquadOverview
      .mockResolvedValueOnce(overview)
      .mockRejectedValueOnce(new ApiError(404, 'Squad not found'));
    await renderScreen(<SquadOverviewScreen />);
    await screen.findByText('Flagged');

    await pullToRefresh();

    expect(await screen.findByText('Squad not found')).toBeTruthy();
    expect(screen.queryByText('Sleep Athlete')).toBeNull();
  });
});
