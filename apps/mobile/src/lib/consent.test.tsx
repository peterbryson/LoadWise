import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { ConsentProvider, useConsent } from '@/lib/consent';

const mockMe = jest.fn();
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ me: mockMe }),
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
  const { status, retry, markGiven } = useConsent();
  return (
    <>
      <Text>{`status:${status}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={retry} />
      <Pressable accessibilityRole="button" accessibilityLabel="Mark given" onPress={markGiven} />
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
