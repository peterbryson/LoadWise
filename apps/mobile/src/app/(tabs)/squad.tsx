import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { MySquads } from '@/components/MySquads';
import { Screen, ScreenHeader } from '@/components/Screen';
import { CreateSquadForm } from '@/components/SquadForms';
import { apiBaseUrl, createApiClient, MySquad } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * #48 AC3: the staff home. Lists the squads the user supports as staff, each opening that squad's
 * overview and members, and holds the create-squad form. Shown only to users with a staff
 * membership (the tabs layout decides). Not in the Figma V1 design.
 */
export default function SquadScreen() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [squadsVersion, setSquadsVersion] = useState(0);

  function open(pathname: '/squad-overview' | '/squad-members', squad: MySquad) {
    router.push({ pathname, params: { squadId: squad.squadId, squadName: squad.squadName } });
  }

  return (
    <Screen withTabBar>
      <ScreenHeader caption="Staff" title="Your squads" />
      <MySquads
        api={api}
        only="staff"
        refreshKey={squadsVersion}
        onOpenOverview={(squad) => open('/squad-overview', squad)}
        onOpenMembers={(squad) => open('/squad-members', squad)}
      />
      <CreateSquadForm api={api} onCreated={() => setSquadsVersion((n) => n + 1)} />
    </Screen>
  );
}
