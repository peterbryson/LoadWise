import { fireEvent, screen } from '@testing-library/react-native';
import { MySquads } from '@/components/MySquads';
import { ApiError, MySquad } from '@/lib/api';
import { renderScreen } from '@/test-utils';

const athleteSquad: MySquad = { squadId: 'sq-a', squadName: 'Harriers', role: 'ATHLETE', consentGiven: true };
const otherAthleteSquad: MySquad = { squadId: 'sq-b', squadName: 'Club GAA', role: 'ATHLETE', consentGiven: false };
const coachSquad: MySquad = { squadId: 'sq-c', squadName: 'U20s', role: 'COACH', inviteCode: 'ABCD2345' };

function setup(mySquads: jest.Mock, refreshKey = 0) {
  const onOpenMembers = jest.fn();
  const view = renderScreen(
    <MySquads api={{ mySquads }} refreshKey={refreshKey} onOpenMembers={onOpenMembers} />,
  );
  return { onOpenMembers, view };
}

describe('FR4: My squads on Profile (#2 AC3)', () => {
  it('lists every squad with the caller’s role in it (#3 AC1: two squads)', async () => {
    const mySquads = jest.fn().mockResolvedValue([athleteSquad, otherAthleteSquad, coachSquad]);
    await setup(mySquads).view;

    expect(await screen.findByText('Harriers')).toBeTruthy();
    expect(screen.getByText('Club GAA')).toBeTruthy();
    expect(screen.getByText('Athlete · Sharing your data')).toBeTruthy();
    expect(screen.getByText('Athlete · Not sharing your data')).toBeTruthy();
    expect(screen.getByText('Coach · Invite code ABCD2345')).toBeTruthy();
  });

  it('offers the members list only for squads where the caller is staff', async () => {
    const mySquads = jest.fn().mockResolvedValue([athleteSquad, coachSquad]);
    const { onOpenMembers, view } = setup(mySquads);
    await view;

    const buttons = await screen.findAllByRole('button', { name: 'View members' });
    expect(buttons).toHaveLength(1);
    await fireEvent.press(buttons[0]);
    expect(onOpenMembers).toHaveBeenCalledWith(coachSquad);
  });

  it('explains what to do when the caller is in no squads', async () => {
    await setup(jest.fn().mockResolvedValue([])).view;

    expect(await screen.findByText(/You are not in a squad yet/)).toBeTruthy();
  });

  it('shows a loading indicator until the squads arrive', async () => {
    await setup(jest.fn().mockReturnValue(new Promise(() => {}))).view;

    expect(screen.getByLabelText('Loading your squads')).toBeTruthy();
  });

  it('shows why loading failed and loads again on Try again', async () => {
    const mySquads = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again."))
      .mockResolvedValueOnce([athleteSquad]);
    await setup(mySquads).view;

    expect(await screen.findByText(/Can't reach the LoadWise API/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Harriers')).toBeTruthy();
    expect(mySquads).toHaveBeenCalledTimes(2);
  });
});
