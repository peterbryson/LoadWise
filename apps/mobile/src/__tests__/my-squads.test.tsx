import { fireEvent, screen } from '@testing-library/react-native';
import { MySquads } from '@/components/MySquads';
import { ApiError, MySquad } from '@/lib/api';
import { renderScreen } from '@/test-utils';

const athleteSquad: MySquad = { squadId: 'sq-a', squadName: 'Harriers', role: 'ATHLETE', consentGiven: true };
const otherAthleteSquad: MySquad = { squadId: 'sq-b', squadName: 'Club GAA', role: 'ATHLETE', consentGiven: false };
const coachSquad: MySquad = { squadId: 'sq-c', squadName: 'U20s', role: 'COACH', inviteCode: 'ABCD2345' };

function setup(mySquads: jest.Mock, setSquadConsent: jest.Mock = jest.fn()) {
  const onOpenMembers = jest.fn();
  const view = renderScreen(
    <MySquads api={{ mySquads, setSquadConsent }} refreshKey={0} onOpenMembers={onOpenMembers} />,
  );
  return { onOpenMembers, view };
}

describe('FR4: My squads on Profile (#2 AC3)', () => {
  it('lists every squad with the caller’s role in it (#3 AC1: two squads)', async () => {
    const mySquads = jest.fn().mockResolvedValue([athleteSquad, otherAthleteSquad, coachSquad]);
    await setup(mySquads).view;

    expect(await screen.findByText('Harriers')).toBeTruthy();
    expect(screen.getByText('Club GAA')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Share my data with Harriers' }).props.value).toBe(true);
    expect(screen.getByRole('switch', { name: 'Share my data with Club GAA' }).props.value).toBe(false);
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

describe('NFR2: per-squad sharing switch (#3)', () => {
  const sharingSwitch = (name: string) => screen.getByRole('switch', { name: `Share my data with ${name}` });

  it('turns sharing on for one squad only, straight away (AC1, AC2)', async () => {
    const setSquadConsent = jest.fn().mockResolvedValue({ squadId: 'sq-b', consentGiven: true });
    await setup(jest.fn().mockResolvedValue([athleteSquad, otherAthleteSquad]), setSquadConsent).view;
    await screen.findByText('Club GAA');

    await fireEvent(sharingSwitch('Club GAA'), 'valueChange', true);

    expect(setSquadConsent).toHaveBeenCalledWith('sq-b', true);
    expect(await screen.findAllByText(/Staff in this squad can see your data/)).toHaveLength(2);
    expect(sharingSwitch('Club GAA').props.value).toBe(true);
  });

  it('explains that staff see nothing until sharing is on', async () => {
    await setup(jest.fn().mockResolvedValue([otherAthleteSquad])).view;

    expect(await screen.findByText(/Staff in this squad see none of your data until you turn this on/)).toBeTruthy();
  });

  it('asks before withdrawing, and withdraws on Stop sharing (AC3)', async () => {
    const setSquadConsent = jest.fn().mockResolvedValue({ squadId: 'sq-a', consentGiven: false });
    await setup(jest.fn().mockResolvedValue([athleteSquad]), setSquadConsent).view;
    await screen.findByText('Harriers');

    await fireEvent(sharingSwitch('Harriers'), 'valueChange', false);

    expect(screen.getByText(/Stop sharing with Harriers\? Its staff lose access to your data straight away/)).toBeTruthy();
    expect(setSquadConsent).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Stop sharing' }));

    expect(setSquadConsent).toHaveBeenCalledWith('sq-a', false);
    expect(await screen.findByText(/see none of your data/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop sharing' })).toBeNull();
  });

  it('keeps sharing on if the athlete changes their mind', async () => {
    const setSquadConsent = jest.fn();
    await setup(jest.fn().mockResolvedValue([athleteSquad]), setSquadConsent).view;
    await screen.findByText('Harriers');

    await fireEvent(sharingSwitch('Harriers'), 'valueChange', false);
    await fireEvent.press(screen.getByRole('button', { name: 'Keep sharing' }));

    expect(setSquadConsent).not.toHaveBeenCalled();
    expect(sharingSwitch('Harriers').props.value).toBe(true);
  });

  it('shows the API’s reason and leaves the switch unchanged when saving fails', async () => {
    const setSquadConsent = jest
      .fn()
      .mockRejectedValue(new ApiError(403, 'Agree to health-data processing in first-time setup first'));
    await setup(jest.fn().mockResolvedValue([otherAthleteSquad]), setSquadConsent).view;
    await screen.findByText('Club GAA');

    await fireEvent(sharingSwitch('Club GAA'), 'valueChange', true);

    expect(await screen.findByText('Agree to health-data processing in first-time setup first')).toBeTruthy();
    expect(sharingSwitch('Club GAA').props.value).toBe(false);
  });

  it('shows no sharing switch for staff memberships', async () => {
    await setup(jest.fn().mockResolvedValue([coachSquad])).view;
    await screen.findByText('U20s');

    expect(screen.queryByRole('switch')).toBeNull();
  });
});
