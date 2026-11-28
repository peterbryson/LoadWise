import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConsent } from '@/lib/consent';
import { renderScreen } from '@/test-utils';
import SetupScreen from '@/app/setup';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockGiveHealthConsent = jest.fn();
const mockCreateSquad = jest.fn();
let mockParams: { start?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ giveHealthConsent: mockGiveHealthConsent, createSquad: mockCreateSquad }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/consent', () => ({ useConsent: jest.fn() }));

const markGiven = jest.fn();
const markStaffSquad = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
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
  jest.mocked(useConsent).mockReturnValue({
    status: 'needed',
    hasStaffSquad: false,
    retry: jest.fn(),
    markGiven,
    markStaffSquad,
  });
});

async function choose(label: string) {
  await fireEvent.press(screen.getByRole('radio', { name: label }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
}

async function createSquad(name: string, role = 'Coach') {
  await fireEvent.changeText(screen.getByLabelText('Squad name'), name);
  await fireEvent.press(screen.getByRole('radio', { name: role }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create squad' }));
}

describe('FR4 #48 AC1: setup asks how the user will use LoadWise', () => {
  it('offers own training, staff, or both, and needs a choice before continuing', async () => {
    await renderScreen(<SetupScreen />);

    expect(screen.getByRole('radio', { name: 'I log my own training' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'I support a squad as staff' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Both' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Both' }));
    expect(screen.getByRole('radio', { name: 'Both' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });
});

describe('NFR2: first-time setup records health-data consent (#1 AC4)', () => {
  it('keeps Continue disabled until the consent box is ticked', async () => {
    await renderScreen(<SetupScreen />);
    await choose('I log my own training');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  it('saves consent, then opens the app', async () => {
    mockGiveHealthConsent.mockResolvedValue({ healthConsentGiven: true });
    await renderScreen(<SetupScreen />);
    await choose('I log my own training');

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockGiveHealthConsent).toHaveBeenCalledTimes(1);
    expect(markGiven).toHaveBeenCalledTimes(1);
    expect(mockCreateSquad).not.toHaveBeenCalled();
  });

  it('stays on setup and shows the reason when saving fails', async () => {
    mockGiveHealthConsent.mockRejectedValue(
      new ApiError(400, 'The privacy notice has changed. Update the app and try again.'),
    );
    await renderScreen(<SetupScreen />);
    await choose('I log my own training');

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('The privacy notice has changed. Update the app and try again.')).toBeTruthy();
    expect(markGiven).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a plain message for an unexpected failure', async () => {
    mockGiveHealthConsent.mockRejectedValue(new Error('boom'));
    await renderScreen(<SetupScreen />);
    await choose('I log my own training');

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
  });

  it('goes back to the choice from the consent step', async () => {
    await renderScreen(<SetupScreen />);
    await choose('I log my own training');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('How will you use LoadWise?')).toBeTruthy();
  });
});

describe('FR4 #48 AC2: a staff-only user finishes setup without health-data consent', () => {
  it('creates their squad and lands on the Squad tab, never asking for consent', async () => {
    mockCreateSquad.mockResolvedValue({ id: 'sq-1', name: 'U20s', inviteCode: 'ABCD2345', role: 'PHYSIO' });
    await renderScreen(<SetupScreen />);
    await choose('I support a squad as staff');

    expect(screen.queryByRole('checkbox')).toBeNull();
    await createSquad('U20s', 'Physio');

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/squad'));
    expect(mockCreateSquad).toHaveBeenCalledWith({ name: 'U20s', role: 'PHYSIO' });
    expect(markStaffSquad).toHaveBeenCalledTimes(1);
    expect(mockGiveHealthConsent).not.toHaveBeenCalled();
    expect(markGiven).not.toHaveBeenCalled();
  });

  it('rejects a squad name that is too short with a clear error, and saves nothing', async () => {
    await renderScreen(<SetupScreen />);
    await choose('I support a squad as staff');
    await createSquad('U');

    expect(screen.getByText('Squad names are 2 to 60 characters.')).toBeTruthy();
    expect(mockCreateSquad).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the API message and stays on setup when creating fails', async () => {
    mockCreateSquad.mockRejectedValue(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."));
    await renderScreen(<SetupScreen />);
    await choose('I support a squad as staff');
    await createSquad('U20s');

    expect(await screen.findByText(/Can't reach the LoadWise API/)).toBeTruthy();
    expect(markStaffSquad).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('goes back to the choice from the squad step', async () => {
    await renderScreen(<SetupScreen />);
    await choose('I support a squad as staff');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('How will you use LoadWise?')).toBeTruthy();
  });
});

describe('FR4 #48 AC4: a user who is both', () => {
  it('gives consent, then creates a squad, then lands on Today', async () => {
    mockGiveHealthConsent.mockResolvedValue({ healthConsentGiven: true });
    mockCreateSquad.mockResolvedValue({ id: 'sq-1', name: 'U20s', inviteCode: 'ABCD2345', role: 'COACH' });
    await renderScreen(<SetupScreen />);
    await choose('Both');

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Set up your squad')).toBeTruthy();
    expect(markGiven).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();

    await createSquad('U20s');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(markStaffSquad).toHaveBeenCalledTimes(1);
  });

  it('can skip creating a squad after giving consent', async () => {
    mockGiveHealthConsent.mockResolvedValue({ healthConsentGiven: true });
    await renderScreen(<SetupScreen />);
    await choose('Both');
    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Skip for now' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockCreateSquad).not.toHaveBeenCalled();
  });
});

describe('NFR2 #48 AC5: a staff-only user later chooses to log their own training', () => {
  beforeEach(() => {
    mockParams = { start: 'consent' };
    jest.mocked(useConsent).mockReturnValue({
      status: 'needed',
      hasStaffSquad: true,
      retry: jest.fn(),
      markGiven,
      markStaffSquad,
    });
  });

  it('asks for health-data consent first, then opens Today', async () => {
    mockGiveHealthConsent.mockResolvedValue({ healthConsentGiven: true });
    await renderScreen(<SetupScreen />);

    expect(screen.getByText('Log your own training')).toBeTruthy();
    expect(screen.queryByText('How will you use LoadWise?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(markGiven).toHaveBeenCalledTimes(1);
    expect(mockCreateSquad).not.toHaveBeenCalled();
  });

  it('changes nothing if they go back without agreeing', async () => {
    await renderScreen(<SetupScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockGiveHealthConsent).not.toHaveBeenCalled();
    expect(markGiven).not.toHaveBeenCalled();
  });
});
