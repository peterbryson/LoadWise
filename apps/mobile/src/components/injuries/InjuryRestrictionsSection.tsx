import type { SquadRole } from '@loadwise/shared';
import { useEffect, useMemo, useState } from 'react';
import { apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { InjuriesCard } from './InjuriesCard';
import { RestrictionsCard } from './RestrictionsCard';

interface InjuryRestrictionsSectionProps {
  squadId: string;
  athleteId: string;
}

/**
 * #21 on the staff athlete screen: active training restrictions for every staff role, and for the
 * squad's physio also the injury list and the forms to record injuries and set or end restrictions.
 *
 * The viewer's role comes from their own squad list and only decides which controls are shown.
 * The API checks role, squad and consent on every request (#11), so a wrong or missing role here
 * can hide a control but never reveal data. If the role cannot be read, the physio controls stay hidden.
 */
export function InjuryRestrictionsSection({ squadId, athleteId }: InjuryRestrictionsSectionProps) {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [role, setRole] = useState<SquadRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .mySquads()
      .then((squads) => {
        if (!cancelled) setRole(squads.find((squad) => squad.squadId === squadId)?.role ?? null);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api, squadId]);

  const isPhysio = role === 'PHYSIO';
  return (
    <>
      <RestrictionsCard api={api} squadId={squadId} athleteId={athleteId} canManage={isPhysio} />
      {isPhysio ? <InjuriesCard api={api} squadId={squadId} athleteId={athleteId} /> : null}
    </>
  );
}
