import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { ConsentProvider, useConsent } from '@/lib/consent';

const mockMe = jest.fn();
const mockMySquads = jest.fn();
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ me: mockMe, mySquads: mockMySquads }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const getIdToken = jest.fn();

function signedInAs(uid: string | null) {
  jest.mocked(useAuth).mockReturnValue({
    user: uid ? ({ uid } as never) : null,
    loading: false,
    configured: true,
    signIn: jest.fn(),
    createAccount: jest.fn(),
    resetPassword: jest.fn(),
    signOut: jest.fn(),
    getIdToken,
  });
}

function Probe() {
  const { status, hasStaffSquad, retry, markGiven, markStaffSquad } = useConsent();
  return (
    <>
      <Text>{`status:${status}`}</Text>
      <Text>{`staff:${hasStaffSquad}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={retry} />
      <Pressable accessibilityRole="button" accessibilityLabel="Mark given" onPress={markGiven} />
      <Pressable accessibilityRole="button" accessibilityLabel="Mark staff" onPress={markStaffSquad} />
    </>
  );
}

async function renderProbe() {
  return await render(
    <ConsentProvider>
      <Probe />
    </ConsentProvider>,
  );
}

const me = (healthConsentGiven: boolean) => ({
  id: 'u1',
  email: 'athlete@example.com',
  displayName: null,
  healthConsentGiven,
  healthConsentAt: healthConsentGiven ? '2026-11-20T09:00:00.000Z' : null,
});

describe('NFR2: consent status for the signed-in user (#1 AC4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signedInAs('u1');
    mockMySquads.mockResolvedValue([]);
  });

  it('does not call the API when nobody is signed in', async () => {
    signedInAs(null);
    await renderProbe();

    expect(screen.getByText('status:loading')).toBeTruthy();
    expect(mockMe).not.toHaveBeenCalled();
  });

  it('reports consent as needed when none is recorded', async () => {
    mockMe.mockResolvedValue(me(false));
    await renderProbe();

    expect(await screen.findByText('status:needed')).toBeTruthy();
  });

  it('reports consent as given when the API has it recorded', async () => {
    mockMe.mockResolvedValue(me(true));
    await renderProbe();

    expect(await screen.findByText('status:given')).toBeTruthy();
  });

  it('reports an error when the API cannot be reached, and asks again on retry', async () => {
    mockMe.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(me(true));
    await renderProbe();

    expect(await screen.findByText('status:error')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('status:given')).toBeTruthy();
    expect(mockMe).toHaveBeenCalledTimes(2);
  });

  it('switches to given straight after consent is saved at setup', async () => {
    mockMe.mockResolvedValue(me(false));
    await renderProbe();
    await screen.findByText('status:needed');

    await fireEvent.press(screen.getByRole('button', { name: 'Mark given' }));

    expect(screen.getByText('status:given')).toBeTruthy();
  });
});

const coachSquad = { squadId: 'sq-c', squadName: 'U20s', role: 'COACH', inviteCode: 'ABCD2345' };
const athleteSquad = { squadId: 'sq-a', squadName: 'Harriers', role: 'ATHLETE', consentGiven: true };

describe('FR4 #48: staff membership for the signed-in user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signedInAs('u1');
  });

  it('reports a staff squad when the user holds any staff membership, without consent', async () => {
    mockMe.mockResolvedValue(me(false));
    mockMySquads.mockResolvedValue([athleteSquad, coachSquad]);
    await renderProbe();

    expect(await screen.findByText('status:needed')).toBeTruthy();
    expect(screen.getByText('staff:true')).toBeTruthy();
  });

  it('does not count athlete memberships as staff', async () => {
    mockMe.mockResolvedValue(me(true));
    mockMySquads.mockResolvedValue([athleteSquad]);
    await renderProbe();

    expect(await screen.findByText('status:given')).toBeTruthy();
    expect(screen.getByText('staff:false')).toBeTruthy();
  });

  it('reports an error when the squads cannot be loaded', async () => {
    mockMe.mockResolvedValue(me(true));
    mockMySquads.mockRejectedValue(new Error('offline'));
    await renderProbe();

    expect(await screen.findByText('status:error')).toBeTruthy();
  });

  it('switches to staff straight after a squad is created at setup, keeping consent', async () => {
    mockMe.mockResolvedValue(me(false));
    mockMySquads.mockResolvedValue([]);
    await renderProbe();
    await screen.findByText('staff:false');

    await fireEvent.press(screen.getByRole('button', { name: 'Mark staff' }));
    expect(screen.getByText('staff:true')).toBeTruthy();
    expect(screen.getByText('status:needed')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Mark given' }));
    expect(screen.getByText('status:given')).toBeTruthy();
    expect(screen.getByText('staff:true')).toBeTruthy();
  });
});
