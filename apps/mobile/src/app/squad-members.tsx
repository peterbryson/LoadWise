import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { NavHeader, Screen } from '@/components/Screen';
import { ApiError, apiBaseUrl, createApiClient, SquadMember } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { roleLabels } from '@/lib/roles';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; members: SquadMember[] };

/**
 * #2 AC3: the members of one squad, for its staff. Opened from My squads on Profile. Not in the
 * Figma V1 screens; it reuses the design's cards and header. Shows who has joined and whether each
 * athlete shares their data with the squad (#3), never any health data.
 */
export default function SquadMembersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const { squadId, squadName } = useLocalSearchParams<{ squadId: string; squadName?: string }>();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .squadMembers(squadId)
      .then((members) => {
        if (!cancelled) setState({ kind: 'loaded', members });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [api, squadId, attempt]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  const athletes = state.kind === 'loaded' ? state.members.filter((m) => m.role === 'ATHLETE') : [];
  const staff = state.kind === 'loaded' ? state.members.filter((m) => m.role !== 'ATHLETE') : [];

  return (
    <Screen>
      <NavHeader title={squadName ?? 'Squad members'} icon="back" onPress={() => router.back()} />

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading members" />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' ? (
        <>
          <AppText variant="heading" accessibilityRole="header">
            {`Athletes (${athletes.length})`}
          </AppText>
          {athletes.length === 0 ? (
            <Card gap={4}>
              <AppText variant="caption" color="textMuted">
                No athletes yet. Share the squad's invite code so they can join.
              </AppText>
            </Card>
          ) : null}
          {athletes.map((member) => (
            <MemberRow key={member.userId} member={member} />
          ))}

          <AppText variant="heading" accessibilityRole="header">
            {`Staff (${staff.length})`}
          </AppText>
          {staff.map((member) => (
            <MemberRow key={member.userId} member={member} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function MemberRow({ member }: { member: SquadMember }) {
  const detail =
    member.role === 'ATHLETE'
      ? member.consentGiven
        ? 'Sharing data with this squad'
        : 'Not sharing data with this squad'
      : roleLabels[member.role];
  return (
    <Card gap={2}>
      <View style={styles.row} accessible accessibilityLabel={`${member.displayName}, ${detail}`}>
        <AppText variant="body">{member.displayName}</AppText>
        <AppText variant="caption" color="textMuted">
          {detail}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2 },
});
