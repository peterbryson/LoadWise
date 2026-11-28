import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError, MySquad } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ConsentStatus, useConsent } from '@/lib/consent';
import { renderScreen } from '@/test-utils';
import ProfileScreen from '@/app/(tabs)/profile';
import SquadScreen from '@/app/(tabs)/squad';

const mockPush = jest.fn();
const mockMySquads = jest.fn();
const mockCreateSquad = jest.fn();
const mockJoinSquad = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({
    mySquads: mockMySquads,
    createSquad: mockCreateSquad,
    joinSquad: mockJoinSquad,
    setSquadConsent: jest.fn(),
  }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/consent', () => ({ useConsent: jest.fn() }));

const athleteSquad: MySquad = { squadId: 'sq-a', squadName: 'Harriers', role: 'ATHLETE', consentGiven: true };
const coachSquad: MySquad = { squadId: 'sq-c', squadName: 'U20s', role: 'COACH', inviteCode: 'ABCD2345' };
const physioSquad: MySquad = { squadId: 'sq-p', squadName: 'Seniors', role: 'PHYSIO', inviteCode: 'WXYZ6789' };

const markStaffSquad = jest.fn();

function signedIn(status: ConsentStatus, hasStaffSquad: boolean) {
  jest.mocked(useAuth).mockReturnValue({
    user: { uid: 'u1', email: 'coach@example.com', displayName: 'Sam Coach' } as never,
    loading: false,
    configured: true,
    signIn: jest.fn(),
    createAccount: jest.fn(),
    resetPassword: jest.fn(),
    signOut: jest.fn(),
    getIdToken: jest.fn(),
  });
  jest.mocked(useConsent).mockReturnValue({ status, hasStaffSquad, retry: jest.fn(), markGiven: jest.fn(), markStaffSquad });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMySquads.mockReset();
});

describe('FR4 #48 AC3: the Squad tab lists the squads the user supports', () => {
  beforeEach(() => signedIn('needed', true));

  it('lists staff squads only, without athlete memberships', async () => {
    mockMySquads.mockResolvedValue([athleteSquad, coachSquad, physioSquad]);
    await renderScreen(<SquadScreen />);

    expect(await screen.findByText('U20s')).toBeTruthy();
    expect(screen.getByText('Seniors')).toBeTruthy();
    expect(screen.queryByText('Harriers')).toBeNull();
    expect(screen.getByText('Coach · Invite code ABCD2345')).toBeTruthy();
    expect(screen.getByText('Squads I support')).toBeTruthy();
  });

  it("opens each squad's overview and members", async () => {
    mockMySquads.mockResolvedValue([coachSquad]);
    await renderScreen(<SquadScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Squad overview' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/squad-overview',
      params: { squadId: 'sq-c', squadName: 'U20s' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'View members' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/squad-members',
      params: { squadId: 'sq-c', squadName: 'U20s' },
    });
  });

  it('creates another squad and reloads the list', async () => {
    mockMySquads.mockResolvedValueOnce([coachSquad]).mockResolvedValueOnce([coachSquad, physioSquad]);
    mockCreateSquad.mockResolvedValue({ id: 'sq-p', name: 'Seniors', inviteCode: 'WXYZ6789', role: 'PHYSIO' });
    await renderScreen(<SquadScreen />);
    await screen.findByText('U20s');

    await fireEvent.changeText(screen.getByLabelText('Squad name'), 'Seniors');
    await fireEvent.press(screen.getByRole('radio', { name: 'Physio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create squad' }));

    expect(await screen.findByText('Created "Seniors". Invite code: WXYZ6789')).toBeTruthy();
    expect(mockCreateSquad).toHaveBeenCalledWith({ name: 'Seniors', role: 'PHYSIO' });
    expect(await screen.findByText('Physio · Invite code WXYZ6789')).toBeTruthy();
  });

  it('rejects an empty squad name with a clear error', async () => {
    mockMySquads.mockResolvedValue([coachSquad]);
    await renderScreen(<SquadScreen />);
    await screen.findByText('U20s');

    await fireEvent.press(screen.getByRole('button', { name: 'Create squad' }));

    expect(screen.getByText('Squad names are 2 to 60 characters.')).toBeTruthy();
    expect(mockCreateSquad).not.toHaveBeenCalled();
  });

  it('shows a loading indicator until the squads arrive', async () => {
    mockMySquads.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SquadScreen />);

    expect(screen.getByLabelText('Loading your squads')).toBeTruthy();
  });

  it('shows why loading failed and loads again on Try again', async () => {
    mockMySquads
      .mockRejectedValueOnce(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."))
      .mockResolvedValueOnce([coachSquad]);
    await renderScreen(<SquadScreen />);

    expect(await screen.findByText(/Can't reach the LoadWise API/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('U20s')).toBeTruthy();
  });

  it('explains the empty state when no staff squad is left in the list', async () => {
    mockMySquads.mockResolvedValue([athleteSquad]);
    await renderScreen(<SquadScreen />);

    expect(await screen.findByText('You do not support a squad yet. Create one below.')).toBeTruthy();
  });
});

describe('FR4 #48: Profile by entry mode', () => {
  it('AC5: offers a staff-only user to log their own training, through the consent step', async () => {
    signedIn('needed', true);
    await renderScreen(<ProfileScreen />);

    expect(screen.queryByRole('button', { name: 'Join squad' })).toBeNull();
    expect(screen.queryByText('My squads')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Start logging my training' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/setup', params: { start: 'consent' } });
    expect(mockMySquads).not.toHaveBeenCalled();
  });

  it('keeps joining a squad on Profile for athletes, and lists only their athlete squads', async () => {
    signedIn('given', true);
    mockMySquads.mockResolvedValue([athleteSquad, coachSquad]);
    await renderScreen(<ProfileScreen />);

    expect(await screen.findByText('Harriers')).toBeTruthy();
    expect(screen.queryByText('U20s')).toBeNull();
    expect(screen.getByRole('button', { name: 'Join squad' })).toBeTruthy();
    expect(screen.queryByText('Support a squad as staff')).toBeNull();
  });

  it('joins a squad with a valid code and rejects a malformed one', async () => {
    signedIn('given', false);
    mockMySquads.mockResolvedValue([]);
    mockJoinSquad.mockResolvedValue({ squadId: 'sq-a', squadName: 'Harriers', role: 'ATHLETE' });
    await renderScreen(<ProfileScreen />);

    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'bad');
    await fireEvent.press(screen.getByRole('button', { name: 'Join squad' }));
    expect(screen.getByText('Invite codes are 8 letters and numbers.')).toBeTruthy();
    expect(mockJoinSquad).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Invite code'), 'ABCD2345');
    await fireEvent.press(screen.getByRole('button', { name: 'Join squad' }));
    expect(await screen.findByText('Joined "Harriers" as an athlete.')).toBeTruthy();
  });

  it('lets an athlete start supporting a squad, which adds the Squad tab', async () => {
    signedIn('given', false);
    mockMySquads.mockResolvedValue([]);
    mockCreateSquad.mockResolvedValue({ id: 'sq-c', name: 'U20s', inviteCode: 'ABCD2345', role: 'COACH' });
    await renderScreen(<ProfileScreen />);

    expect(screen.getByText('Support a squad as staff')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Squad name'), 'U20s');
    await fireEvent.press(screen.getByRole('button', { name: 'Create squad' }));

    await waitFor(() => expect(markStaffSquad).toHaveBeenCalledTimes(1));
  });
});
