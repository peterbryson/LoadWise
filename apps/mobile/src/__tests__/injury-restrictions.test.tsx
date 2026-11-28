import type { InjuryRecord, StaffRole, TrainingRestriction } from '@loadwise/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { renderScreen } from '@/test-utils';
import { InjuryRestrictionsSection } from '@/components/injuries/InjuryRestrictionsSection';
import SquadAthleteLoadScreen from '@/app/squad-athlete-load';

const mockApi = {
  mySquads: jest.fn(),
  athleteLoad: jest.fn(),
  athleteRestrictions: jest.fn(),
  addRestriction: jest.fn(),
  endRestriction: jest.fn(),
  athleteInjuries: jest.fn(),
  recordInjury: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ squadId: 'sq-1', athleteId: 'a1', name: 'Athlete One' }),
}));
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),
  createApiClient: () => mockApi,
}));
jest.mock('@/lib/auth', () => ({ useAuth: jest.fn() }));

const NO_CONTACT: TrainingRestriction = {
  id: 'res-1',
  description: 'No contact training',
  reviewOn: '2026-12-04',
  recordedAt: '2026-11-27T10:00:00.000Z',
  active: true,
};
const HAMSTRING: InjuryRecord = {
  id: 'inj-1',
  bodyArea: 'Left hamstring',
  onsetDate: '2026-11-20',
  returnDate: null,
  notes: 'Synthetic note for testing',
};

function viewerIs(role: StaffRole) {
  mockApi.mySquads.mockResolvedValue([
    { squadId: 'other', squadName: 'Other', role: 'PHYSIO', inviteCode: 'X' },
    { squadId: 'sq-1', squadName: 'Club', role, inviteCode: 'ABC' },
  ]);
}

const renderSection = () =>
  renderScreen(<InjuryRestrictionsSection squadId="sq-1" athleteId="a1" />);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    user: { uid: 'staff' } as never,
    loading: false,
    configured: true,
    signIn: jest.fn(),
    createAccount: jest.fn(),
    resetPassword: jest.fn(),
    signOut: jest.fn(),
    getIdToken: jest.fn(),
  });
  mockApi.athleteRestrictions.mockResolvedValue([NO_CONTACT]);
  mockApi.athleteInjuries.mockResolvedValue([HAMSTRING]);
});

describe('FR4 #21 AC2: coaches see the athlete’s active restrictions', () => {
  it.each(['COACH', 'SC_COACH'] as const)(
    '%s sees each restriction and its review date, and nothing to change',
    async (role) => {
      viewerIs(role);
      await renderSection();

      expect(await screen.findByText('No contact training')).toBeTruthy();
      expect(screen.getByText('Physio review on Fri 4 Dec')).toBeTruthy();
      expect(mockApi.athleteRestrictions).toHaveBeenCalledWith('sq-1', 'a1');
      expect(screen.queryByRole('button', { name: 'End restriction' })).toBeNull();
      expect(screen.queryByLabelText('Restriction')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Record injury' })).toBeNull();
    },
  );

  it.each(['COACH', 'SC_COACH'] as const)(
    '%s never asks for or sees injury records (#11 AC1)',
    async (role) => {
      viewerIs(role);
      await renderSection();

      await screen.findByText('No contact training');
      expect(mockApi.athleteInjuries).not.toHaveBeenCalled();
      expect(screen.queryByText(/hamstring|Synthetic note/i)).toBeNull();
    },
  );

  it('says plainly that the physio sets restrictions and LoadWise does not decide return to play', async () => {
    viewerIs('COACH');
    await renderSection();

    expect(
      await screen.findByText(
        'Set and ended by the squad’s physio. LoadWise does not set restrictions or decide return to play.',
      ),
    ).toBeTruthy();
  });

  it('says when there are no active restrictions', async () => {
    viewerIs('COACH');
    mockApi.athleteRestrictions.mockResolvedValue([]);
    await renderSection();

    expect(await screen.findByText('No active restrictions.')).toBeTruthy();
  });

  it('leaves out the review line when no review date was set', async () => {
    viewerIs('COACH');
    mockApi.athleteRestrictions.mockResolvedValue([{ ...NO_CONTACT, reviewOn: null }]);
    await renderSection();

    await screen.findByText('No contact training');
    expect(screen.queryByText(/Physio review on/)).toBeNull();
  });

  it('shows a loading indicator until the restrictions arrive', async () => {
    viewerIs('COACH');
    mockApi.athleteRestrictions.mockReturnValue(new Promise(() => {}));
    await renderSection();

    expect(screen.getByLabelText('Loading training restrictions')).toBeTruthy();
  });

  it('shows the API’s reason when access is refused, for example after the athlete stops sharing, and retries', async () => {
    viewerIs('COACH');
    mockApi.athleteRestrictions
      .mockRejectedValueOnce(new ApiError(403, 'You do not have access to this athlete’s data'))
      .mockResolvedValueOnce([NO_CONTACT]);
    await renderSection();

    expect(await screen.findByText('You do not have access to this athlete’s data')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No contact training')).toBeTruthy();
  });

  it('says when LoadWise cannot be reached', async () => {
    viewerIs('COACH');
    mockApi.athleteRestrictions.mockRejectedValue(new ApiError(0, 'Network request failed'));
    await renderSection();

    expect(
      await screen.findByText(/Can't reach LoadWise, so training restrictions can't load/),
    ).toBeTruthy();
  });

  it('keeps the physio controls hidden when the viewer’s role cannot be read', async () => {
    mockApi.mySquads.mockRejectedValue(new ApiError(0, 'Network request failed'));
    await renderSection();

    expect(await screen.findByText('No contact training')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'End restriction' })).toBeNull();
    expect(mockApi.athleteInjuries).not.toHaveBeenCalled();
  });

  it('appears on the staff athlete screen under the load', async () => {
    viewerIs('COACH');
    mockApi.athleteLoad.mockReturnValue(new Promise(() => {}));
    await renderScreen(<SquadAthleteLoadScreen />);

    expect(await screen.findByText('No contact training')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Training restrictions' })).toBeTruthy();
  });
});

describe('FR4 #21 AC1: the physio records an injury and restrictions', () => {
  beforeEach(() => viewerIs('PHYSIO'));

  it('lists the squad’s injuries with their dates and notes', async () => {
    mockApi.athleteInjuries.mockResolvedValue([
      HAMSTRING,
      {
        id: 'inj-0',
        bodyArea: 'Right ankle',
        onsetDate: '2026-10-01',
        returnDate: '2026-10-20',
        notes: null,
      },
    ]);
    await renderSection();

    expect(await screen.findByText('Left hamstring')).toBeTruthy();
    expect(screen.getByText('From Fri 20 Nov, not yet returned')).toBeTruthy();
    expect(screen.getByText('Synthetic note for testing')).toBeTruthy();
    expect(screen.getByText('From Thu 1 Oct, returned Tue 20 Oct')).toBeTruthy();
    expect(mockApi.athleteInjuries).toHaveBeenCalledWith('sq-1', 'a1');
  });

  it('says when no injuries are recorded in this squad', async () => {
    mockApi.athleteInjuries.mockResolvedValue([]);
    await renderSection();

    expect(await screen.findByText('No injuries recorded in this squad.')).toBeTruthy();
  });

  it('records an injury and shows it in the list', async () => {
    mockApi.athleteInjuries.mockResolvedValue([]);
    mockApi.recordInjury.mockResolvedValue({
      ...HAMSTRING,
      id: 'inj-9',
      bodyArea: 'Knee',
      onsetDate: '2026-11-25',
      notes: null,
    });
    await renderSection();

    await fireEvent.press(await screen.findByRole('button', { name: 'Record injury' }));
    await fireEvent.changeText(screen.getByLabelText('Body area'), '  Knee ');
    await fireEvent.changeText(screen.getByLabelText('Onset date (YYYY-MM-DD)'), '2026-11-25');
    await fireEvent.press(screen.getByRole('button', { name: 'Save injury' }));

    expect(await screen.findByText('Knee')).toBeTruthy();
    expect(mockApi.recordInjury).toHaveBeenCalledWith('sq-1', 'a1', {
      bodyArea: 'Knee',
      onsetDate: '2026-11-25',
    });
    expect(screen.queryByRole('button', { name: 'Save injury' })).toBeNull();
  });

  it.each<[string, { body: string; onset?: string; back?: string }, string]>([
    ['an empty body area', { body: '' }, 'Enter the body area, at least 2 characters'],
    [
      'an onset date that is not a date',
      { body: 'Knee', onset: '25/11/2026' },
      'Enter the onset date as YYYY-MM-DD',
    ],
    [
      'a return before onset',
      { body: 'Knee', onset: '2026-11-25', back: '2026-11-24' },
      'The return date cannot be before the onset date',
    ],
  ])(
    'refuses an injury with %s, with a clear message, and sends nothing',
    async (_case, input, message) => {
      await renderSection();

      await fireEvent.press(await screen.findByRole('button', { name: 'Record injury' }));
      await fireEvent.changeText(screen.getByLabelText('Body area'), input.body);
      if (input.onset)
        await fireEvent.changeText(screen.getByLabelText('Onset date (YYYY-MM-DD)'), input.onset);
      if (input.back)
        await fireEvent.changeText(
          screen.getByLabelText('Return date (optional, YYYY-MM-DD)'),
          input.back,
        );
      await fireEvent.press(screen.getByRole('button', { name: 'Save injury' }));

      expect(await screen.findByText(message)).toBeTruthy();
      expect(mockApi.recordInjury).not.toHaveBeenCalled();
    },
  );

  it('keeps the form and shows the API’s reason when saving an injury fails', async () => {
    mockApi.recordInjury.mockRejectedValue(
      new ApiError(403, 'You do not have access to this athlete’s data'),
    );
    await renderSection();

    await fireEvent.press(await screen.findByRole('button', { name: 'Record injury' }));
    await fireEvent.changeText(screen.getByLabelText('Body area'), 'Knee');
    await fireEvent.press(screen.getByRole('button', { name: 'Save injury' }));

    expect(await screen.findByText('You do not have access to this athlete’s data')).toBeTruthy();
    expect(screen.getByLabelText('Body area').props.value).toBe('Knee');
  });

  it('warns that coaches will see a restriction, then sets one and shows it', async () => {
    mockApi.athleteRestrictions.mockResolvedValue([]);
    mockApi.addRestriction.mockResolvedValue({
      ...NO_CONTACT,
      id: 'res-2',
      description: 'Non-contact drills only',
    });
    await renderSection();

    expect(
      await screen.findByText(/Coaches and S&C coaches in this squad will see this/),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Restriction'), 'Non-contact drills only');
    await fireEvent.changeText(
      screen.getByLabelText('Physio review date (optional, YYYY-MM-DD)'),
      '2026-12-04',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save restriction' }));

    expect(await screen.findByText('Non-contact drills only')).toBeTruthy();
    expect(mockApi.addRestriction).toHaveBeenCalledWith('sq-1', 'a1', {
      description: 'Non-contact drills only',
      reviewOn: '2026-12-04',
    });
    expect(screen.getByLabelText('Restriction').props.value).toBe('');
  });

  it.each<[string, { text: string; review?: string }, string]>([
    ['a two-character restriction', { text: 'ab' }, 'Enter the restriction, at least 3 characters'],
    [
      'a review date that is not a date',
      { text: 'No contact', review: '04/12/2026' },
      'Enter the review date as YYYY-MM-DD',
    ],
  ])('refuses %s with a clear message, and sends nothing', async (_case, input, message) => {
    await renderSection();

    await fireEvent.changeText(await screen.findByLabelText('Restriction'), input.text);
    if (input.review) {
      await fireEvent.changeText(
        screen.getByLabelText('Physio review date (optional, YYYY-MM-DD)'),
        input.review,
      );
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Save restriction' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(mockApi.addRestriction).not.toHaveBeenCalled();
  });

  it('ends a restriction and removes it from the list', async () => {
    mockApi.endRestriction.mockResolvedValue({ ...NO_CONTACT, active: false });
    await renderSection();

    await fireEvent.press(await screen.findByRole('button', { name: 'End restriction' }));

    expect(await screen.findByText('No active restrictions.')).toBeTruthy();
    expect(mockApi.endRestriction).toHaveBeenCalledWith('sq-1', 'a1', 'res-1');
  });

  it('keeps the restriction and shows why when ending it fails', async () => {
    mockApi.endRestriction.mockRejectedValue(new ApiError(404, 'Restriction not found'));
    await renderSection();

    await fireEvent.press(await screen.findByRole('button', { name: 'End restriction' }));

    expect(await screen.findByText('Restriction not found')).toBeTruthy();
    expect(screen.getByText('No contact training')).toBeTruthy();
  });

  it('shows its own error for injuries without hiding the restrictions', async () => {
    mockApi.athleteInjuries.mockRejectedValue(
      new ApiError(500, 'Something went wrong. Try again.'),
    );
    await renderSection();

    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(screen.getByText('No contact training')).toBeTruthy();
  });
});
