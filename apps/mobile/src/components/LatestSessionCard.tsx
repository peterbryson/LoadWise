import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { ApiError, apiBaseUrl, createApiClient, SavedSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sessionTypeLabels, shortDay } from '@/lib/session-format';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; latest: SavedSession | null };

/**
 * #4 AC4: the "Latest session" card on Today, from `GET /sessions?limit=1`. It loads again each
 * time Today comes back into view, so a session that was just logged shows straight away. A failure
 * stays inside the card, so the rest of Today still works. Sessions saved offline and waiting to
 * sync are added with the offline queue (#6).
 */
export function LatestSessionCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .recentSessions(1)
        .then((sessions) => {
          if (!cancelled) setState({ kind: 'loaded', latest: sessions.length > 0 ? sessions[0] : null });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const message = error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
          setState({ kind: 'error', message });
        });
      return () => {
        cancelled = true;
      };
      // attempt is a dependency so that Try again loads once more.
    }, [api, attempt]),
  );

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  if (state.kind === 'loaded' && state.latest) {
    const session = state.latest;
    return (
      <Pressable
        onPress={() => router.push('/sessions')}
        accessibilityRole="link"
        accessibilityLabel="Latest session. Show recent sessions"
      >
        <Card gap={2}>
          <AppText variant="caption" color="textMuted">
            Latest session
          </AppText>
          <AppText variant="heading">{`${sessionTypeLabels[session.type]} · ${session.durationMinutes} min`}</AppText>
          <AppText variant="caption" color="textMuted">
            {`${shortDay(session.date)} · RPE ${session.rpe} · ${session.load} AU`}
          </AppText>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card gap={state.kind === 'loading' ? 8 : 4}>
      <AppText variant="caption" color="textMuted">
        Latest session
      </AppText>

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading latest session" />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' ? (
        <>
          <AppText variant="heading">No sessions yet</AppText>
          <AppText variant="caption" color="textMuted">
            Log your first training session or match and it appears here.
          </AppText>
          <Button label="Log your first session" variant="secondary" onPress={() => router.push('/log-session')} />
        </>
      ) : null}
    </Card>
  );
}
