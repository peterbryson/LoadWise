import { STAFF_DATA_ACCESS } from '@loadwise/shared';
import type { DataCategory, SquadRole } from '@loadwise/shared';
import { useCallback, useEffect, useState } from 'react';
import { ApiClient, ApiError, MySquad } from '@/lib/api';

/** The viewer's role in one squad, from their own squad list. Null if they are not in it. */
export function roleInSquad(squads: readonly MySquad[], squadId: string): SquadRole | null {
  return squads.find((squad) => squad.squadId === squadId)?.role ?? null;
}

/**
 * #51: whether the screen should ask for a category at all. It reads the same matrix the API
 * enforces (DL-022), so the screen cannot drift from the server. It only decides which requests
 * are made: the API still checks role, squad and consent on every one, and a refusal is shown.
 * An unknown role sees nothing extra, so a failed role lookup fails closed.
 */
export function viewerCanSee(role: SquadRole | null, category: DataCategory): boolean {
  return role !== null && STAFF_DATA_ACCESS[role].includes(category);
}

export type ViewerRoleState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'known'; role: SquadRole | null };

/** Looks up the viewer's role in a squad from `GET /squads`, with a retry for when it fails. */
export function useViewerRole(api: ApiClient, squadId: string): { state: ViewerRoleState; retry: () => void } {
  const [state, setState] = useState<ViewerRoleState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .mySquads()
      .then((squads) => {
        if (!cancelled) setState({ kind: 'known', role: roleInSquad(squads, squadId) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiError && error.status === 0
            ? "Can't reach LoadWise to check your role in this squad."
            : 'Your role in this squad could not be checked.';
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
    // attempt is a dependency so that Try again loads once more.
  }, [api, squadId, attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
