import { fireEvent, screen } from '@testing-library/react-native';
import type { Flag, FlagChecks } from '@loadwise/analytics';
import { ApiError } from '@/lib/api';
import type { CurrentFlags } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import FlagScreen from '@/app/flag';
import TodayScreen from '@/app/(tabs)/index';

const mockBack = jest.fn();
const mockMyFlags = jest.fn();
const mockRecentSessions = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  // The screen is always in view in these tests, so a focus effect behaves like a normal effect.
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(effect, [effect]);
  }
  return {
    useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
    useFocusEffect,
    Link: ({ children }: { children: unknown }) => children,
  };
});
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ myFlags: mockMyFlags, recentSessions: mockRecentSessions }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const acwrFlag: Flag = {
  rule: 'ACWR_HIGH',
  metric: 'acwr',
  value: 1.62,
  threshold: 1.5,
  reason: 'Your acute:chronic workload ratio is 1.62, above the 1.5 guide.',
};
const sleepFlag: Flag = {
  rule: 'WELLNESS_LOW',
  metric: 'sleep',
  value: 2,
  threshold: 2.5,
  reason: 'Your sleep score today is 2, more than 1.5 SD below your usual 4.0 (guide: 2.5).',
};

const allChecked: FlagChecks = { acwr: 'checked', wellness: 'checked' };

function flagsResponse(flags: Flag[], checks: FlagChecks = allChecked, baselineCheckIns = 20): CurrentFlags {
  return { date: '2026-11-25', flags, checks, baselineCheckIns, minCheckIns: 14 };
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
    signOut: jest.fn(),
    getIdToken: jest.fn(),
  });
  mockRecentSessions.mockResolvedValue([]);
});

describe('FR2 #9: flags on Today (AC2)', () => {
  it('shows each flag with its plain-language reason and a See why link', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([acwrFlag, sleepFlag]));
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText(acwrFlag.reason)).toBeTruthy();
    expect(screen.getByText(sleepFlag.reason)).toBeTruthy();
    expect(screen.getByText('Your load has increased faster than usual')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See why: Your sleep score is lower than usual for you' })).toBeTruthy();
  });

  it('says nothing has been flagged when there are no flags', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([]));
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Nothing has been flagged today')).toBeTruthy();
  });

  it('shows a loading indicator until flags arrive', async () => {
    mockMyFlags.mockReturnValue(new Promise(() => {}));
    await renderScreen(<TodayScreen />);

    expect(screen.getByLabelText('Loading flags')).toBeTruthy();
  });

  it('says flags update later when the phone is offline', async () => {
    mockMyFlags.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('You are offline. Flags update when you are back online.')).toBeTruthy();
  });

  it('shows an error inside the card and loads again on Try again', async () => {
    mockMyFlags
      .mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Try again.'))
      .mockResolvedValueOnce(flagsResponse([]));
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log a session' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Nothing has been flagged today')).toBeTruthy();
    expect(mockMyFlags).toHaveBeenCalledTimes(2);
  });
});

describe('FR2 #9: flag detail shows reason, value and threshold (AC2)', () => {
  it('shows the ACWR value and the guide it is above', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([acwrFlag]));
    await renderScreen(<FlagScreen />);

    expect(await screen.findByText(acwrFlag.reason)).toBeTruthy();
    expect(screen.getByLabelText('Load ratio (ACWR): 1.62')).toBeTruthy();
    expect(screen.getByLabelText('Guide: flagged above: 1.5')).toBeTruthy();
  });

  it("shows today's wellness score and the score it is below", async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([sleepFlag]));
    await renderScreen(<FlagScreen />);

    expect(await screen.findByText(sleepFlag.reason)).toBeTruthy();
    expect(screen.getByLabelText('Sleep today: 2 of 5')).toBeTruthy();
    expect(screen.getByLabelText('Guide: flagged below: 2.5')).toBeTruthy();
  });

  it('never tells the athlete to change load, rest or return to play, and points pain to a physio or GP', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([acwrFlag, sleepFlag]));
    await renderScreen(<FlagScreen />);
    await screen.findByText(acwrFlag.reason);

    const text = screen.getAllByText(/./).map((node) => String(node.props.children)).join(' ');
    expect(text).not.toMatch(/injury risk|diagnos|reduce your load|rest day|return to play/i);
    expect(screen.getByText(/For pain or injury, speak to a physio or GP/)).toBeTruthy();
  });

  it('has an empty state when nothing is flagged', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([]));
    await renderScreen(<FlagScreen />);

    expect(await screen.findByText('Nothing has been flagged today')).toBeTruthy();
  });

  it('shows an offline message when the API cannot be reached', async () => {
    mockMyFlags.mockRejectedValueOnce(new ApiError(0, 'unreachable'));
    await renderScreen(<FlagScreen />);
    expect(await screen.findByText('You are offline. Flags load when you are back online.')).toBeTruthy();
  });
});

describe('FR2 #9: no flags is never shown as an all-clear when a check could not run (AC1)', () => {
  it.each([
    ['Today', () => <TodayScreen />],
    ['the flag screen', () => <FlagScreen />],
  ])('on %s, says both checks ran only when they did', async (_name, ui) => {
    mockMyFlags.mockResolvedValue(flagsResponse([]));
    await renderScreen(ui());

    expect(await screen.findByText('Nothing has been flagged today')).toBeTruthy();
    expect(screen.getByText('Load ratio: checked, within the guide')).toBeTruthy();
    expect(screen.getByText('Wellness: checked, within the guide')).toBeTruthy();
  });

  it.each([
    ['Today', () => <TodayScreen />],
    ['the flag screen', () => <FlagScreen />],
  ])('on %s, says which checks could not run instead of an all-clear', async (_name, ui) => {
    mockMyFlags.mockResolvedValue(flagsResponse([], { acwr: 'unavailable', wellness: 'no-baseline' }, 9));
    await renderScreen(ui());

    expect(await screen.findByText('Not everything could be checked today')).toBeTruthy();
    expect(screen.queryByText('Nothing has been flagged today')).toBeNull();
    expect(screen.queryByText(/not outside your usual range/)).toBeNull();
    expect(screen.getByText('Load ratio: not available until 28 days after your first logged session')).toBeTruthy();
    expect(screen.getByText('Wellness: building your baseline (9 of 14 check-ins)')).toBeTruthy();
  });

  it('asks for a check-in today when the baseline exists but today has no check-in', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([], { acwr: 'checked', wellness: 'no-check-in' }));
    await renderScreen(<TodayScreen />);

    expect(await screen.findByText('Not everything could be checked today')).toBeTruthy();
    expect(screen.getByText('Load ratio: checked, within the guide')).toBeTruthy();
    expect(screen.getByText('Wellness: check in today to compare')).toBeTruthy();
  });

  it('on the flag screen, shows which checks ran alongside the flags', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([acwrFlag], { acwr: 'checked', wellness: 'no-check-in' }));
    await renderScreen(<FlagScreen />);

    expect(await screen.findByText(acwrFlag.reason)).toBeTruthy();
    expect(screen.getByText('Load ratio: checked, flagged')).toBeTruthy();
    expect(screen.getByText('Wellness: check in today to compare')).toBeTruthy();
  });
});

describe('FR2 #9: the shown value and guide never contradict the flag (AC2)', () => {
  it('shows ACWR 1.504 as above a 1.5 guide, not as 1.50', async () => {
    mockMyFlags.mockResolvedValue(
      flagsResponse([{ ...acwrFlag, value: 1.504, reason: 'Your acute:chronic workload ratio is 1.504, above the 1.5 guide.' }]),
    );
    await renderScreen(<FlagScreen />);

    expect(await screen.findByLabelText('Load ratio (ACWR): 1.504')).toBeTruthy();
    expect(screen.getByLabelText('Guide: flagged above: 1.5')).toBeTruthy();
  });

  it('shows a 1.0477 guide as 1.05 so a flagged score of 1 is visibly below it, not "1"', async () => {
    mockMyFlags.mockResolvedValue(flagsResponse([{ ...sleepFlag, value: 1, threshold: 1.0477 }]));
    await renderScreen(<FlagScreen />);

    expect(await screen.findByLabelText('Sleep today: 1 of 5')).toBeTruthy();
    expect(screen.getByLabelText('Guide: flagged below: 1.05')).toBeTruthy();
  });
});
