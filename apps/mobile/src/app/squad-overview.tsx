import type { OverviewAthlete, OverviewChecks, SharingAthlete, SquadOverview } from '@loadwise/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { NavHeader, Screen } from '@/components/Screen';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; overview: SquadOverview };

const STATUS_LABEL: Record<SharingAthlete['status'], string> = {
  flagged: 'Flagged',
  incomplete: 'Not fully checked',
  clear: 'No flags today',
};

/**
 * #10: every athlete in the squad with today's status and flags, problems first, for its staff.
 * The order, statuses and flag reasons all come from the API and the deterministic engine; this
 * screen only displays them. Status is always written as text, never shown by colour alone.
 * Reloads when it comes back into view, so it reflects new logs and consent changes.
 */
export default function SquadOverviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const { squadId, squadName } = useLocalSearchParams<{ squadId: string; squadName?: string }>();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .squadOverview(squadId)
        .then((overview) => {
          if (!cancelled) setState({ kind: 'loaded', overview });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState({ kind: 'error', message: errorMessage(error) });
        });
      return () => {
        cancelled = true;
      };
      // attempt is a dependency so that Try again loads once more.
    }, [api, squadId, attempt]),
  );

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  function openAthlete(athlete: SharingAthlete) {
    router.push({
      pathname: '/squad-athlete-load',
      params: { squadId, athleteId: athlete.athleteId, name: athlete.displayName },
    });
  }

  const title = state.kind === 'loaded' ? state.overview.squadName : (squadName ?? 'Squad overview');

  return (
    <Screen>
      <NavHeader title={title} icon="back" onPress={() => router.back()} />

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading the squad overview" />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' ? <Overview overview={state.overview} onOpen={openAthlete} /> : null}
    </Screen>
  );
}

function Overview({ overview, onOpen }: { overview: SquadOverview; onOpen: (athlete: SharingAthlete) => void }) {
  if (overview.athletes.length === 0) {
    return (
      <Card gap={4}>
        <AppText variant="heading">No athletes yet</AppText>
        <AppText variant="body" color="textMuted">
          Share the squad&apos;s invite code so athletes can join.
        </AppText>
      </Card>
    );
  }

  return (
    <>
      <AppText variant="body" accessibilityRole="header">
        {summary(overview.athletes)}
      </AppText>
      {overview.athletes.map((athlete) =>
        athlete.sharing ? (
          <SharingRow key={athlete.athleteId} athlete={athlete} onOpen={() => onOpen(athlete)} />
        ) : (
          <Card key={athlete.athleteId} gap={2}>
            <View accessible accessibilityLabel={`${athlete.displayName}, not sharing data with this squad`}>
              <AppText variant="body">{athlete.displayName}</AppText>
              <AppText variant="caption" color="textMuted">
                Not sharing data with this squad
              </AppText>
            </View>
          </Card>
        ),
      )}
      <AppText variant="caption" color="textMuted">
        {`Flags compare each athlete with their own usual and with guides that are starting points being tested, not medical limits. Today is ${longDay(overview.date)}.`}
      </AppText>
    </>
  );
}

function SharingRow({ athlete, onOpen }: { athlete: SharingAthlete; onOpen: () => void }) {
  const status = STATUS_LABEL[athlete.status];
  const load = loadLine(athlete);
  const notes = athlete.status === 'flagged' ? athlete.flags.map((flag) => flag.reason) : uncheckedNotes(athlete.checks);
  const label = [`${athlete.displayName}, ${status}.`, ...notes, load].join(' ');

  return (
    <Card tone={athlete.status === 'flagged' ? 'warning' : 'surface'} gap={2}>
      <Pressable
        onPress={onOpen}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens their combined load"
      >
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <AppText variant="heading">{athlete.displayName}</AppText>
            <AppText variant="caption" color={athlete.status === 'flagged' ? 'text' : 'textMuted'}>
              {status}
            </AppText>
          </View>
          {notes.map((note) => (
            <AppText key={note} variant="body">
              {note}
            </AppText>
          ))}
          <AppText variant="caption" color="textMuted">
            {load}
          </AppText>
        </View>
        <Icon name="chevron-row" size={20} />
      </Pressable>
    </Card>
  );
}

/** Why an athlete with no flags is not shown as clear (DL-020). */
function uncheckedNotes(checks: OverviewChecks): string[] {
  const notes: string[] = [];
  if (checks.acwr === 'unavailable') notes.push('Load ratio not available yet.');
  if (checks.wellness === 'no-baseline') notes.push('Wellness baseline still building.');
  if (checks.wellness === 'no-check-in') notes.push('No wellness check-in today.');
  return notes;
}

function loadLine({ load }: SharingAthlete): string {
  const ratio = load.acwr === null ? 'not available yet' : load.acwr.toFixed(2);
  return `This week ${Math.round(load.thisWeek).toLocaleString('en-GB')} AU · Load ratio ${ratio}`;
}

function summary(athletes: OverviewAthlete[]): string {
  const count = (test: (athlete: OverviewAthlete) => boolean) => athletes.filter(test).length;
  const parts = [
    `${count((a) => a.sharing && a.status === 'flagged')} flagged`,
    `${count((a) => a.sharing && a.status === 'incomplete')} not fully checked`,
    `${count((a) => a.sharing && a.status === 'clear')} with no flags`,
    `${count((a) => !a.sharing)} not sharing`,
  ];
  return `${athletes.length} athletes: ${parts.join(', ')}.`;
}

/** "25 November" */
function longDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return "Can't reach LoadWise, so the squad overview can't load. Check your connection, then try again.";
  }
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

const styles = StyleSheet.create({
  // 44 px minimum height keeps each row a comfortable touch target (WCAG 2.2 target size).
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  text: { gap: 4, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
