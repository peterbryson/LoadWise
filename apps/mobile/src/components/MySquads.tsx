import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { ApiClient, ApiError, MySquad } from '@/lib/api';
import { roleLabels } from '@/lib/roles';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { InlineMessage } from './InlineMessage';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; squads: MySquad[] };

interface MySquadsProps {
  api: Pick<ApiClient, 'mySquads'>;
  /** Changing this reloads the list, e.g. after creating or joining a squad. */
  refreshKey: number;
  onOpenMembers: (squad: MySquad) => void;
}

/** #2 AC3: the squads the signed-in user belongs to, with their role in each. */
export function MySquads({ api, refreshKey, onOpenMembers }: MySquadsProps) {
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    api
      .mySquads()
      .then((squads) => {
        if (!cancelled) setState({ kind: 'loaded', squads });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [api, refreshKey, attempt]);

  return (
    <Card gap={10}>
      <AppText variant="heading" accessibilityRole="header">
        My squads
      </AppText>

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your squads" />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
        </>
      ) : null}

      {state.kind === 'loaded' && state.squads.length === 0 ? (
        <AppText variant="caption" color="textMuted">
          You are not in a squad yet. Join one with the invite code from your coach.
        </AppText>
      ) : null}

      {state.kind === 'loaded'
        ? state.squads.map((squad) => (
            <Card key={squad.squadId} tone="raised" gap={6}>
              <AppText variant="heading">{squad.squadName}</AppText>
              {squad.role === 'ATHLETE' ? (
                <AppText variant="caption" color="textMuted">
                  {`Athlete · ${squad.consentGiven ? 'Sharing your data' : 'Not sharing your data'}`}
                </AppText>
              ) : (
                <>
                  <AppText variant="caption" color="textMuted">
                    {`${roleLabels[squad.role]} · Invite code ${squad.inviteCode}`}
                  </AppText>
                  <Button
                    label="View members"
                    variant="secondary"
                    accessibilityHint={`Lists the members of ${squad.squadName}`}
                    onPress={() => onOpenMembers(squad)}
                  />
                </>
              )}
            </Card>
          ))
        : null}
    </Card>
  );
}
