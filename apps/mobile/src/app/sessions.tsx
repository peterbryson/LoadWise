import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { NavHeader, Screen } from '@/components/Screen';
import { ApiError, apiBaseUrl, createApiClient, SavedSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sessionTypeLabels, shortDay } from '@/lib/session-format';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; sessions: SavedSession[] };

/**
 * #4 AC3 and AC4: the athlete's recent sessions, newest first, opened from the "Latest session"
 * card on Today. Not in the Figma V1 screens; it reuses the design's cards and header. Sessions
 * saved offline and waiting to sync are added here with the offline queue (#6).
 */
export default function SessionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
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
  }, [api, attempt]);

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

      {state.kind === 'loaded' && state.sessions.length === 0 ? (
        <Card gap={4}>
          <AppText variant="heading">No sessions yet</AppText>
          <AppText variant="caption" color="textMuted">
            Sessions you log from Today appear here, newest first.
          </AppText>
        </Card>
      ) : null}

      {state.kind === 'loaded'
        ? state.sessions.map((session) => (
            <Card key={session.id} gap={2}>
              <View style={styles.row}>
                <AppText variant="heading">{`${sessionTypeLabels[session.type]} · ${session.durationMinutes} min`}</AppText>
                <AppText variant="label">{session.load} AU</AppText>
              </View>
              <AppText variant="caption" color="textMuted">
                {shortDay(session.date)} · RPE {session.rpe}
              </AppText>
            </Card>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
