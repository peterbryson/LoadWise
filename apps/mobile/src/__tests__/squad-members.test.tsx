import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import SquadMembersScreen from '@/app/squad-members';

const mockSquadMembers = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ squadId: 'sq-1', squadName: 'Harriers' }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ squadMembers: mockSquadMembers }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

describe('FR4: squad members for staff (#2 AC3)', () => {
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

  it('lists athletes with whether they share data, and staff with their role', async () => {
    mockSquadMembers.mockResolvedValue([
      { userId: 'c1', displayName: 'Coach C', role: 'COACH' },
      { userId: 'a1', displayName: 'Athlete One', role: 'ATHLETE', consentGiven: true },
      { userId: 'a2', displayName: 'Athlete Two', role: 'ATHLETE', consentGiven: false },
    ]);
    await renderScreen(<SquadMembersScreen />);

    expect(await screen.findByText('Athletes (2)')).toBeTruthy();
    expect(screen.getByLabelText('Athlete One, Sharing data with this squad')).toBeTruthy();
    expect(screen.getByLabelText('Athlete Two, Not sharing data with this squad')).toBeTruthy();
    expect(screen.getByLabelText('Coach C, Coach')).toBeTruthy();
    expect(mockSquadMembers).toHaveBeenCalledWith('sq-1');
  });

  it('opens the combined load of an athlete who shares data (#8 AC2)', async () => {
    mockSquadMembers.mockResolvedValue([
      { userId: 'a1', displayName: 'Athlete One', role: 'ATHLETE', consentGiven: true },
    ]);
    await renderScreen(<SquadMembersScreen />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Athlete One, Sharing data with this squad' }),
    );

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/squad-athlete-load',
      params: { squadId: 'sq-1', athleteId: 'a1', name: 'Athlete One' },
    });
  });

  it('offers nothing to open for an athlete who does not share, or for staff (#3 AC2)', async () => {
    mockSquadMembers.mockResolvedValue([
      { userId: 'c1', displayName: 'Coach C', role: 'COACH' },
      { userId: 'a2', displayName: 'Athlete Two', role: 'ATHLETE', consentGiven: false },
    ]);
    await renderScreen(<SquadMembersScreen />);

    expect(await screen.findByLabelText('Athlete Two, Not sharing data with this squad')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /Athlete Two|Coach C/ })).toHaveLength(0);
  });

  it('explains a squad with no athletes yet', async () => {
    mockSquadMembers.mockResolvedValue([{ userId: 'c1', displayName: 'Coach C', role: 'COACH' }]);
    await renderScreen(<SquadMembersScreen />);

    expect(await screen.findByText(/No athletes yet/)).toBeTruthy();
  });

  it('shows a loading indicator until the members arrive', async () => {
    mockSquadMembers.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SquadMembersScreen />);

    expect(screen.getByLabelText('Loading members')).toBeTruthy();
  });

  it('shows the API’s reason when access is refused, and retries', async () => {
    mockSquadMembers
      .mockRejectedValueOnce(new ApiError(403, 'Only staff in this squad can see this'))
      .mockResolvedValueOnce([]);
    await renderScreen(<SquadMembersScreen />);

    expect(await screen.findByText('Only staff in this squad can see this')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Athletes (0)')).toBeTruthy();
  });
});
