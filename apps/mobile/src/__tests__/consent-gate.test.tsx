import { fireEvent, screen } from '@testing-library/react-native';
import { useAuth } from '@/lib/auth';
import { ConsentStatus, useConsent } from '@/lib/consent';
import { renderScreen } from '@/test-utils';
import TabsLayout from '@/app/(tabs)/_layout';

let mockPathname = '/';
let mockTabBarProps: { visible: string[] } | null = null;

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  // Renders the custom tab bar the layout passes in, so the visible tabs can be checked.
  const Tabs = ({ tabBar }: { tabBar: (props: unknown) => unknown }) => {
    const bar = tabBar({ state: { index: 0, routes: [{ key: 'k', name: 'index' }] }, navigateToTab: () => {} }) as {
      props: { visible: string[] };
    };
    mockTabBarProps = bar.props;
    return React.createElement(Text, null, 'tabs shown');
  };
  Tabs.Screen = () => null;
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `redirect:${href}`),
    Tabs,
    usePathname: () => mockPathname,
  };
});
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/consent', () => ({ useConsent: jest.fn() }));

const retry = jest.fn();

function given(signedIn: boolean, status: ConsentStatus, hasStaffSquad = false, pathname = '/') {
  mockPathname = pathname;
  mockTabBarProps = null;
  jest.mocked(useAuth).mockReturnValue({
    user: signedIn ? ({ uid: 'u1' } as never) : null,
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
  jest.mocked(useConsent).mockReturnValue({
    status,
    hasStaffSquad,
    retry,
    markGiven: jest.fn(),
    markStaffSquad: jest.fn(),
  });
}

describe('NFR2: tabs are gated on health-data consent (#1 AC4, I-7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a signed-out user to sign-in', async () => {
    given(false, 'loading');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('redirect:/sign-in')).toBeTruthy();
  });

  it('sends a returning user with no consent and no staff squad to setup', async () => {
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

describe('FR4 #48: role-aware entry (AC2, AC3, AC4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('AC4: lands a staff-only user on the Squad tab instead of Today', async () => {
    given(true, 'needed', true, '/');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('redirect:/squad')).toBeTruthy();
    expect(screen.queryByText('tabs shown')).toBeNull();
  });

  it('AC2: sends a staff-only user away from Trends, a health screen', async () => {
    given(true, 'needed', true, '/trends');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('redirect:/squad')).toBeTruthy();
  });

  it('AC2, AC3: shows a staff-only user the Squad and Profile tabs only', async () => {
    given(true, 'needed', true, '/squad');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('tabs shown')).toBeTruthy();
    expect(mockTabBarProps?.visible).toEqual(['squad', 'profile']);
  });

  it('AC4: lands an athlete on Today, with no Squad tab', async () => {
    given(true, 'given', false, '/');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('tabs shown')).toBeTruthy();
    expect(mockTabBarProps?.visible).toEqual(['index', 'trends', 'profile']);
  });

  it('AC3: sends an athlete without a staff squad from the Squad tab to Today', async () => {
    given(true, 'given', false, '/squad');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('redirect:/')).toBeTruthy();
  });

  it('AC4: lands a user who is both on Today, with the Squad tab as well', async () => {
    given(true, 'given', true, '/');
    await renderScreen(<TabsLayout />);

    expect(screen.getByText('tabs shown')).toBeTruthy();
    expect(mockTabBarProps?.visible).toEqual(['index', 'trends', 'squad', 'profile']);
  });
});
