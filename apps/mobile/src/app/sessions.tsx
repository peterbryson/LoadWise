import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { NavHeader, Screen } from '@/components/Screen';
import { WaitingToSync } from '@/components/WaitingToSync';
import { ApiError, apiBaseUrl, createApiClient, SavedSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOfflineSync } from '@/lib/offline-sync';
import { sessionAccessibilityLabel, sessionTypeLabels, shortDay } from '@/lib/session-format';
import { mergeSessions } from '@/lib/session-list';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; sessions: SavedSession[] };

/**
 * #4 AC3 and AC4: the athlete's recent sessions, newest first, opened from the "Latest session"
 * card on Today. Not in the Figma V1 screens; it reuses the design's cards and header.
 * #6 AC4: sessions saved on this device and waiting to sync are listed too, marked as waiting, even
 * when the API cannot be reached. The list loads again whenever a queued entry syncs.
 */
export default function SessionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const { pending, syncCount } = useOfflineSync();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .recentSessions()
      .then((sessions) => {
        if (!cancelled) setState({ kind: 'loaded', sessions });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [api, attempt, syncCount]);

  const items = state.kind === 'loading' ? [] : mergeSessions(state.kind === 'loaded' ? state.sessions : [], pending);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  return (
    <Screen>
      <NavHeader title="Recent sessions" icon="back" onPress={() => router.back()} />

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading sessions" />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' && items.length === 0 ? (
        <Card gap={4}>
          <AppText variant="heading">No sessions yet</AppText>
          <AppText variant="caption" color="textMuted">
            Sessions you log from Today appear here, newest first.
          </AppText>
        </Card>
      ) : null}

      {items.map((session) => (
        <View key={session.key} accessible accessibilityLabel={sessionAccessibilityLabel(session)}>
          <Card gap={2}>
            <View style={styles.row}>
              <AppText variant="heading">{`${sessionTypeLabels[session.type]} · ${session.durationMinutes} min`}</AppText>
              <AppText variant="label">{session.load} AU</AppText>
            </View>
            <AppText variant="caption" color="textMuted">
              {shortDay(session.date)} · RPE {session.rpe}
            </AppText>
            {session.waiting ? <WaitingToSync /> : null}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
