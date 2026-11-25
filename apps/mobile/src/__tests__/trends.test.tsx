import type { MyLoad } from '@loadwise/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import TrendsScreen from '@/app/(tabs)/trends';

const mockPush = jest.fn();
const mockMyLoad = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  // Trends is always in view in these tests, so a focus effect behaves like a normal effect.
  function useFocusEffect(effect: () => void | (() => void)) {
    useEffect(effect, [effect]);
  }
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
    useFocusEffect,
  };
});
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  // The wellness card is tested in wellness-trend.test.tsx, so here it just stays loading.
  createApiClient: () => ({ myLoad: mockMyLoad, myWellnessTrend: () => new Promise(() => {}) }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const weeks = [
  { weekStart: '2026-10-19', load: 600, partial: false },
  { weekStart: '2026-10-26', load: 480, partial: false },
  { weekStart: '2026-11-02', load: 0, partial: false },
  { weekStart: '2026-11-09', load: 570, partial: false },
  { weekStart: '2026-11-16', load: 1800, partial: false },
  { weekStart: '2026-11-23', load: 420, partial: true },
];

function myLoad(overrides: Partial<MyLoad> = {}): MyLoad {
  return {
    today: '2026-11-25',
    weeks,
    usualWeek: 712.5,
    acwr: { model: 'EWMA', value: 1.2345, availableFrom: '2026-11-15' },
    monotony: 0.67,
    strain: 402.7,
    ...overrides,
  };
}

describe('FR2: Trends shows weekly load and ACWR (#7 AC3)', () => {
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

  it('shows the last 6 weeks of load with this week labelled, and the usual week', async () => {
    mockMyLoad.mockResolvedValue(myLoad());
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByText('1,800')).toBeTruthy();
    expect(screen.getByText('19 Oct')).toBeTruthy();
    expect(screen.getByText('This wk')).toBeTruthy();
    expect(screen.getByText('Usual 713 AU')).toBeTruthy();
  });

  it('summarises every week for screen readers', async () => {
    mockMyLoad.mockResolvedValue(myLoad());
    await renderScreen(<TrendsScreen />);

    expect(
      await screen.findByLabelText(
        'Weekly load for the last 6 weeks. Week of 19 Oct: 600 AU. Week of 26 Oct: 480 AU. ' +
          'Week of 2 Nov: 0 AU. Week of 9 Nov: 570 AU. Week of 16 Nov: 1,800 AU. ' +
          'This week so far: 420 AU. Usual week 713 AU.',
      ),
    ).toBeTruthy();
  });

  it('shows ACWR to two decimal places with a plain-language description, not a diagnosis', async () => {
    mockMyLoad.mockResolvedValue(myLoad());
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByText('1.23')).toBeTruthy();
    expect(screen.getByText('Your recent load is higher than your longer-term load.')).toBeTruthy();
    expect(screen.queryByText(/injur|risk/i)).toBeNull();
  });

  it.each([
    [0.8, 'Your recent load is lower than your longer-term load.'],
    [1.004, 'Your recent load is about the same as your longer-term load.'],
  ])('describes an ACWR of %p plainly', async (value, sentence) => {
    mockMyLoad.mockResolvedValue(myLoad({ acwr: { model: 'EWMA', value, availableFrom: '2026-11-15' } }));
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByText(sentence)).toBeTruthy();
  });

  it('says when ACWR will be available before 28 days have passed', async () => {
    mockMyLoad.mockResolvedValue(
      myLoad({ usualWeek: null, acwr: { model: 'EWMA', value: null, availableFrom: '2026-12-02' } }),
    );
    await renderScreen(<TrendsScreen />);

    expect(
      await screen.findByText('Available from 2 December, once LoadWise has 28 days of your data.'),
    ).toBeTruthy();
    // 2 Dec is 7 days after 25 Nov, so 21 of the 28 days have passed.
    expect(screen.getByLabelText('Load ratio: 21 of 28 days')).toBeTruthy();
    expect(screen.queryByText(/^Usual/)).toBeNull();
  });

  it('explains when there is no recent load to compare with', async () => {
    mockMyLoad.mockResolvedValue(myLoad({ acwr: { model: 'ROLLING', value: null, availableFrom: '2026-09-01' } }));
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByText('No load in the last 28 days to compare with.')).toBeTruthy();
  });

  it('shows an empty state and offers to log a session when nothing has been logged', async () => {
    mockMyLoad.mockResolvedValue(
      myLoad({
        weeks: weeks.map((week) => ({ ...week, load: 0 })),
        usualWeek: null,
        acwr: { model: 'EWMA', value: null, availableFrom: null },
        monotony: null,
        strain: null,
      }),
    );
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByText('No sessions yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Log your first session' }));
    expect(mockPush).toHaveBeenCalledWith('/log-session');
  });

  it('shows a loading indicator until the metrics arrive', async () => {
    mockMyLoad.mockReturnValue(new Promise(() => {}));
    await renderScreen(<TrendsScreen />);

    expect(screen.getByLabelText('Loading your weekly load')).toBeTruthy();
  });

  it('explains when the phone is offline, and loads again on Try again', async () => {
    mockMyLoad
      .mockRejectedValueOnce(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."))
      .mockResolvedValueOnce(myLoad());
    await renderScreen(<TrendsScreen />);

    expect(
      await screen.findByText("Can't reach LoadWise, so your trends can't load. Check your connection, then try again."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('1.23')).toBeTruthy();
    expect(mockMyLoad).toHaveBeenCalledTimes(2);
  });

  it('shows the API message for other errors, such as missing consent', async () => {
    mockMyLoad.mockRejectedValue(new ApiError(403, 'Agree to health-data processing in first-time setup first'));
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByText('Agree to health-data processing in first-time setup first')).toBeTruthy();
  });

  it('shows the real wellness trend (#9) with no sample-data preview banner left on Trends', async () => {
    mockMyLoad.mockResolvedValue(myLoad());
    await renderScreen(<TrendsScreen />);

    expect(await screen.findByLabelText('Loading wellness trend')).toBeTruthy();
    expect(screen.queryByText(/Preview: sample/)).toBeNull();
  });
});
