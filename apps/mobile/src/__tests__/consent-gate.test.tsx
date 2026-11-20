import { fireEvent, screen } from '@testing-library/react-native';
import { useAuth } from '@/lib/auth';
import { ConsentStatus, useConsent } from '@/lib/consent';
import { renderScreen } from '@/test-utils';
import TabsLayout from '@/app/(tabs)/_layout';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  const Tabs = () => React.createElement(Text, null, 'tabs shown');
  Tabs.Screen = () => null;
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `redirect:${href}`),
    Tabs,
  };
});
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/consent', () => ({ useConsent: jest.fn() }));

const retry = jest.fn();

function given(signedIn: boolean, status: ConsentStatus) {
  jest.mocked(useAuth).mockReturnValue({
    user: signedIn ? ({ uid: 'u1' } as never) : null,
    loading: false,
    configured: true,
    signIn: jest.fn(),
    createAccount: jest.fn(),
    resetPassword: jest.fn(),
    signOut: jest.fn(),
    getIdToken: jest.fn(),
  });
  jest.mocked(useConsent).mockReturnValue({ status, retry, markGiven: jest.fn() });
}

describe('NFR2: tabs are gated on health-data consent (#1 AC4, I-7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a signed-out user to sign-in', async () => {
    given(false, 'loading');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('redirect:/sign-in')).toBeTruthy();
  });

  it('sends a returning user without recorded consent to setup', async () => {
    given(true, 'needed');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('redirect:/setup')).toBeTruthy();
    expect(screen.queryByText('tabs shown')).toBeNull();
  });

  it('shows the tabs once consent is recorded', async () => {
    given(true, 'given');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('tabs shown')).toBeTruthy();
  });

  it('shows a loading indicator, not the tabs, while consent is checked', async () => {
    given(true, 'loading');
    await renderScreen(<TabsLayout />);

    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByText('tabs shown')).toBeNull();
  });

  it('explains a failed check and lets the user try again', async () => {
    given(true, 'error');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('Could not load your account')).toBeTruthy();
    expect(screen.queryByText('tabs shown')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
