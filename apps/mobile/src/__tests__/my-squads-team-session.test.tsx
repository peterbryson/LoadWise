import { fireEvent, screen } from '@testing-library/react-native';
import { MySquads } from '@/components/MySquads';
import type { MySquad } from '@/lib/api';
import { renderScreen } from '@/test-utils';

// Kept apart from my-squads.test.tsx so #17 and the Squad tab work (#48) do not edit the same file.

const athleteSquad: MySquad = { squadId: 'sq-a', squadName: 'Harriers', role: 'ATHLETE', consentGiven: true };
const coachSquad: MySquad = { squadId: 'sq-c', squadName: 'U20s', role: 'COACH', inviteCode: 'ABCD2345' };
const scSquad: MySquad = { squadId: 'sq-s', squadName: 'Seniors', role: 'SC_COACH', inviteCode: 'EFGH2345' };
const physioSquad: MySquad = { squadId: 'sq-p', squadName: 'Clinic', role: 'PHYSIO', inviteCode: 'JKMN2345' };

async function setup(squads: MySquad[], onLogTeamSession?: jest.Mock) {
  await renderScreen(
    <MySquads
      api={{ mySquads: jest.fn().mockResolvedValue(squads), setSquadConsent: jest.fn() }}
      refreshKey={0}
      onOpenMembers={jest.fn()}
      onOpenOverview={jest.fn()}
      onLogTeamSession={onLogTeamSession}
    />,
  );
  await screen.findByText(squads[0].squadName);
}

describe('FR1 #17 AC1: Log team session from a staff squad card', () => {
  it('offers it to coaches and S&C coaches only, not physios or athletes', async () => {
    const onLog = jest.fn();
    await setup([athleteSquad, coachSquad, scSquad, physioSquad], onLog);

    const buttons = screen.getAllByRole('button', { name: 'Log team session' });
    expect(buttons).toHaveLength(2);
    await fireEvent.press(buttons[0]);
    await fireEvent.press(buttons[1]);
    expect(onLog.mock.calls).toEqual([[coachSquad], [scSquad]]);
  });

  it('is not shown where the screen does not handle it', async () => {
    await setup([coachSquad]);
    expect(screen.queryByRole('button', { name: 'Log team session' })).toBeNull();
  });
});
