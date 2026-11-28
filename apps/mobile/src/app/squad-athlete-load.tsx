import type { LoadTotals } from '@loadwise/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { RoleDetailSections } from '@/components/athlete-detail/RoleDetailSections';
import { NotSharingNote } from '@/components/athlete-detail/SectionStatus';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { AcwrCard, WeeklyLoadCard } from '@/components/LoadTrends';
import { NavHeader, Screen } from '@/components/Screen';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; refused: boolean }
  | { kind: 'loaded'; load: LoadTotals };

/**
 * #8 AC2: one athlete's combined load for staff of a squad they share data with, opened from the
 * squad's member list. The totals include sessions logged for any of the athlete's squads, each
 * counted once (AC1). Only totals are shown, never the sessions behind them (DL-022). Whether the
 * viewer may see this is decided by the API on every request (#11), not by this screen.
 *
 * #51: below the load, each role sees the sections its data categories allow (DL-022), each in
 * its own component so later stories can add sections without reworking this screen.
 */
export default function SquadAthleteLoadScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const { squadId, athleteId, name } = useLocalSearchParams<{ squadId: string; athleteId: string; name?: string }>();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .athleteLoad(squadId, athleteId)
      .then((load) => {
        if (!cancelled) setState({ kind: 'loaded', load });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', message: errorMessage(error), refused: error instanceof ApiError && error.status === 403 });
      });
    return () => {
      cancelled = true;
    };
  }, [api, squadId, athleteId, attempt]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  const athleteName = name ?? 'Athlete';

  return (
    <Screen>
      <NavHeader title={athleteName} icon="back" onPress={() => router.back()} />
      <AppText variant="caption" color="textMuted">
        Combined load from every squad this athlete trains with, each session counted once.
      </AppText>

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel={`Loading ${athleteName}'s load`} />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          {state.refused ? <NotSharingNote /> : null}
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' && state.load.acwr.availableFrom === null ? (
        <Card gap={4}>
          <AppText variant="heading">No sessions yet</AppText>
          <AppText variant="body" color="textMuted">
            {`${athleteName} has not logged any sessions yet.`}
          </AppText>
        </Card>
      ) : null}

      {state.kind === 'loaded' && state.load.acwr.availableFrom !== null ? (
        <>
          <WeeklyLoadCard load={state.load} />
          <AcwrCard
            acwr={state.load.acwr}
            today={state.load.today}
            availableFrom={state.load.acwr.availableFrom}
            whose="their"
          />
        </>
      ) : null}

      {state.kind === 'loaded' ? (
        <RoleDetailSections api={api} squadId={squadId} athleteId={athleteId} athleteName={athleteName} />
      ) : null}
    </Screen>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return "Can't reach LoadWise, so this athlete's load can't load. Check your connection, then try again.";
  }
  // The API's refusal messages name no one, so they are safe to show (for example after the
  // athlete stops sharing with the squad).
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}
