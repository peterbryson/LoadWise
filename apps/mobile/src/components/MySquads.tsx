import { TEAM_SESSION_CREATOR_ROLES } from '@loadwise/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';
import { ApiClient, ApiError, MySquad } from '@/lib/api';
import { whatEachRoleSees } from '@/lib/data-access';
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

type AthleteSquad = Extract<MySquad, { role: 'ATHLETE' }>;

interface MySquadsProps {
  api: Pick<ApiClient, 'mySquads' | 'setSquadConsent'>;
  /** Changing this reloads the list, e.g. after creating or joining a squad. */
  refreshKey: number;
  onOpenMembers: (squad: MySquad) => void;
  /** #10: staff open the squad overview of athletes' status and flags. */
  onOpenOverview: (squad: MySquad) => void;
  /**
   * #48: list only the squads the user supports as staff (the Squad tab) or only those they play
   * in (Profile). Lists every squad when left out.
   */
  only?: 'staff' | 'athlete';
  /** #49: staff open the squad's invite code to copy, share or replace it. Hidden if not given. */
  onOpenInvite?: (squad: MySquad) => void;
  /** #17: coaches and S&C coaches log a team session for the squad. Not shown if left out. */
  onLogTeamSession?: (squad: MySquad) => void;
}

const headings = { all: 'My squads', staff: 'Squads I support', athlete: 'My squads' };
const emptyTexts = {
  all: 'You are not in a squad yet. Join one with the invite code from your coach.',
  staff: 'You do not support a squad yet. Create one below.',
  athlete: 'You are not in a squad yet. Join one with the invite code from your coach.',
};

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * #2 AC3 and #3: the squads the signed-in user belongs to, with their role in each. For athlete
 * memberships it holds the per-squad "Share my data" switch.
 */
export function MySquads({
  api,
  refreshKey,
  onOpenMembers,
  onOpenOverview,
  only,
  onOpenInvite,
  onLogTeamSession,
}: MySquadsProps) {
  const filter = only ?? 'all';
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    api
      .mySquads()
      .then((squads) => {
        const shown = squads.filter(
          (squad) => filter === 'all' || (filter === 'athlete') === (squad.role === 'ATHLETE'),
        );
        if (!cancelled) setState({ kind: 'loaded', squads: shown });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: errorText(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, refreshKey, attempt, filter]);

  function sharingChanged(squadId: string, consentGiven: boolean) {
    setState((current) =>
      current.kind === 'loaded'
        ? {
            kind: 'loaded',
            squads: current.squads.map((squad) =>
              squad.squadId === squadId && squad.role === 'ATHLETE' ? { ...squad, consentGiven } : squad,
            ),
          }
        : current,
    );
  }

  return (
    <Card gap={10}>
      <AppText variant="heading" accessibilityRole="header">
        {headings[filter]}
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
          {emptyTexts[filter]}
        </AppText>
      ) : null}

      {state.kind === 'loaded'
        ? state.squads.map((squad) => (
            <Card key={squad.squadId} tone="raised" gap={6}>
              <AppText variant="heading">{squad.squadName}</AppText>
              {squad.role === 'ATHLETE' ? (
                <SquadSharing api={api} squad={squad} onChanged={sharingChanged} />
              ) : (
                <>
                  <AppText variant="caption" color="textMuted">
                    {`${roleLabels[squad.role]} · Invite code ${squad.inviteCode}`}
                  </AppText>
                  <Button
                    label="Squad overview"
                    accessibilityHint={`Shows each athlete's status and flags in ${squad.squadName}`}
                    onPress={() => onOpenOverview(squad)}
                  />
                  {onLogTeamSession && TEAM_SESSION_CREATOR_ROLES.includes(squad.role) ? (
                    <Button
                      label="Log team session"
                      variant="secondary"
                      accessibilityHint={`Logs one session for ${squad.squadName}; each athlete adds their RPE`}
                      onPress={() => onLogTeamSession(squad)}
                    />
                  ) : null}
                  <Button
                    label="View members"
                    variant="secondary"
                    accessibilityHint={`Lists the members of ${squad.squadName}`}
                    onPress={() => onOpenMembers(squad)}
                  />
                  {onOpenInvite ? (
                    <Button
                      label="Invite athletes"
                      variant="secondary"
                      accessibilityHint={`Shows the invite code for ${squad.squadName} to copy or share`}
                      onPress={() => onOpenInvite(squad)}
                    />
                  ) : null}
                </>
              )}
            </Card>
          ))
        : null}
    </Card>
  );
}

interface SquadSharingProps {
  api: Pick<ApiClient, 'setSquadConsent'>;
  squad: AthleteSquad;
  onChanged: (squadId: string, consentGiven: boolean) => void;
}

/**
 * #3: one switch per squad. Turning sharing on saves straight away; turning it off asks first,
 * because staff lose access on their next request.
 */
function SquadSharing({ api, squad, onChanged }: SquadSharingProps) {
  const { colors } = useTheme();
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = whatEachRoleSees().map((line) => line.text);

  async function save(share: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.setSquadConsent(squad.squadId, share);
      onChanged(squad.squadId, result.consentGiven);
      setConfirmingStop(false);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  function onSwitch(value: boolean) {
    if (value) void save(true);
    else setConfirmingStop(true);
  }

  return (
    <>
      <View style={styles.switchRow}>
        <AppText variant="body" style={styles.flex}>
          Share my data with this squad
        </AppText>
        <Switch
          value={squad.consentGiven}
          onValueChange={onSwitch}
          disabled={busy || confirmingStop}
          accessibilityLabel={`Share my data with ${squad.squadName}`}
          accessibilityState={{ checked: squad.consentGiven, disabled: busy || confirmingStop }}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>
      <AppText variant="caption" color="textMuted">
        {squad.consentGiven
          ? 'Staff in this squad can see your data, limited to what their role needs. You can stop at any time.'
          : 'Staff in this squad see none of your data until you turn this on. Your logging is not affected.'}
      </AppText>
      <View style={styles.roles} accessible accessibilityLabel={`What each role in this squad can see. ${seen.join('. ')}`}>
        <AppText variant="caption" color="textMuted">
          What each role in this squad can see:
        </AppText>
        {seen.map((line) => (
          <AppText key={line} variant="caption" color="textMuted">
            {`• ${line}`}
          </AppText>
        ))}
      </View>

      {confirmingStop ? (
        <View style={styles.confirm} accessibilityLiveRegion="polite">
          <AppText variant="label">
            {`Stop sharing with ${squad.squadName}? Its staff lose access to your data straight away.`}
          </AppText>
          <Button label="Stop sharing" variant="danger" loading={busy} onPress={() => void save(false)} />
          <Button
            label="Keep sharing"
            variant="secondary"
            disabled={busy}
            onPress={() => setConfirmingStop(false)}
          />
        </View>
      ) : null}

      {error ? <InlineMessage kind="error" text={error} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  flex: { flex: 1 },
  confirm: { gap: 8 },
  roles: { gap: 2 },
});
