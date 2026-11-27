import { fireEvent, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import SquadInviteScreen from '@/app/squad-invite';

const mockSquadInvite = jest.fn();
const mockReplaceInviteCode = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ squadId: 'sq-1', squadName: 'Harriers' }),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => ({ squadInvite: mockSquadInvite, replaceInviteCode: mockReplaceInviteCode }),
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const coachInvite = { squadId: 'sq-1', squadName: 'Harriers', inviteCode: 'ABCD2345', canReplace: true };
const shareSpy = jest.spyOn(Share, 'share');

describe('FR4 #49: invite athletes from the squad screen', () => {
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
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true);
    shareSpy.mockResolvedValue({ action: Share.sharedAction });
  });

  describe('AC1: the code is always visible to staff', () => {
    it('shows the current code, spelled out for screen readers', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      await renderScreen(<SquadInviteScreen />);

      expect(await screen.findByText('ABCD2345')).toBeTruthy();
      expect(screen.getByLabelText('Invite code A B C D 2 3 4 5')).toBeTruthy();
      expect(screen.getByText(/only ever join as athletes/)).toBeTruthy();
      expect(mockSquadInvite).toHaveBeenCalledWith('sq-1');
    });

    it('shows a loading indicator until the code arrives', async () => {
      mockSquadInvite.mockReturnValue(new Promise(() => {}));
      await renderScreen(<SquadInviteScreen />);

      expect(screen.getByLabelText('Loading the invite code')).toBeTruthy();
    });

    it('shows the API’s reason when access is refused (AC4), and retries', async () => {
      mockSquadInvite
        .mockRejectedValueOnce(new ApiError(403, 'Only staff in this squad can see this'))
        .mockResolvedValueOnce(coachInvite);
      await renderScreen(<SquadInviteScreen />);

      expect(await screen.findByText('Only staff in this squad can see this')).toBeTruthy();
      expect(screen.queryByText('ABCD2345')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findByText('ABCD2345')).toBeTruthy();
    });

    it('explains when the API cannot be reached', async () => {
      mockSquadInvite.mockRejectedValue(
        new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."),
      );
      await renderScreen(<SquadInviteScreen />);

      expect(await screen.findByText(/Can't reach the LoadWise API/)).toBeTruthy();
    });
  });

  describe('AC2: copy or share the code', () => {
    it('copies the code and confirms it', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      await renderScreen(<SquadInviteScreen />);

      await fireEvent.press(await screen.findByRole('button', { name: 'Copy code' }));

      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABCD2345');
      expect(await screen.findByText('Invite code copied.')).toBeTruthy();
    });

    it('says so if the code could not be copied', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      jest.mocked(Clipboard.setStringAsync).mockResolvedValue(false);
      await renderScreen(<SquadInviteScreen />);

      await fireEvent.press(await screen.findByRole('button', { name: 'Copy code' }));

      expect(await screen.findByText(/Couldn't copy the code/)).toBeTruthy();
    });

    it('opens the share sheet with the squad name and code', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      await renderScreen(<SquadInviteScreen />);

      await fireEvent.press(await screen.findByRole('button', { name: 'Share code' }));

      expect(shareSpy).toHaveBeenCalledWith({
        message: 'Join Harriers on LoadWise with the invite code ABCD2345',
      });
    });

    it('suggests copying instead where there is no share sheet, such as some web browsers', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      shareSpy.mockRejectedValue(new Error('Share is not supported in this browser'));
      await renderScreen(<SquadInviteScreen />);

      await fireEvent.press(await screen.findByRole('button', { name: 'Share code' }));

      expect(await screen.findByText("Sharing isn't available here. Copy the code instead.")).toBeTruthy();
    });
  });

  describe('AC3: a coach replaces the code', () => {
    it('asks first, then shows the new code', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      mockReplaceInviteCode.mockResolvedValue({ ...coachInvite, inviteCode: 'WXYZ6789' });
      await renderScreen(<SquadInviteScreen />);

      await fireEvent.press(await screen.findByRole('button', { name: 'Replace code' }));
      expect(screen.getByText(/The old code stops working straight away/)).toBeTruthy();
      expect(mockReplaceInviteCode).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Replace with a new code' }));

      expect(mockReplaceInviteCode).toHaveBeenCalledWith('sq-1');
      expect(await screen.findByText('WXYZ6789')).toBeTruthy();
      expect(screen.queryByText('ABCD2345')).toBeNull();
      expect(screen.getByText('New invite code ready. The old code no longer works.')).toBeTruthy();
    });

    it('keeps the current code if the coach changes their mind', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      await renderScreen(<SquadInviteScreen />);

      await fireEvent.press(await screen.findByRole('button', { name: 'Replace code' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Keep current code' }));

      expect(mockReplaceInviteCode).not.toHaveBeenCalled();
      expect(screen.getByText('ABCD2345')).toBeTruthy();
      expect(screen.queryByText(/The old code stops working/)).toBeNull();
    });

    it('keeps showing the current code and the reason if replacing fails', async () => {
      mockSquadInvite.mockResolvedValue(coachInvite);
      mockReplaceInviteCode.mockRejectedValue(
        new ApiError(403, 'Only a coach in this squad can replace its invite code'),
      );
      await renderScreen(<SquadInviteScreen />);

      await fireEvent.press(await screen.findByRole('button', { name: 'Replace code' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Replace with a new code' }));

      expect(await screen.findByText('Only a coach in this squad can replace its invite code')).toBeTruthy();
      expect(screen.getByText('ABCD2345')).toBeTruthy();
    });

    it('offers no replace action to staff who are not the coach', async () => {
      mockSquadInvite.mockResolvedValue({ ...coachInvite, canReplace: false });
      await renderScreen(<SquadInviteScreen />);

      expect(await screen.findByText('ABCD2345')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Replace code' })).toBeNull();
      expect(screen.getByText('Only a coach in this squad can replace the code.')).toBeTruthy();
    });
  });
});
