import type { OverviewAthlete, OverviewChecks, SharingAthlete, SquadOverview } from '@loadwise/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Badge, BadgeTone } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { OptionRow } from '@/components/Option';
import { NavHeader, Screen } from '@/components/Screen';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { filterOverview, lastSessionText, OverviewFilter } from '@/lib/overview-filter';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; overview: SquadOverview; refreshError?: string };

const STATUS_LABEL: Record<SharingAthlete['status'], string> = {
  flagged: 'Flagged',
  incomplete: 'Not fully checked',
  clear: 'No flags today',
};

/** Pill tone per status; the pill always shows the words above, with an icon for flagged. */
const STATUS_TONE: Record<SharingAthlete['status'], BadgeTone> = {
  flagged: 'warning',
  incomplete: 'neutral',
  clear: 'accent',
};

/**
 * #10: every athlete in the squad with today's status and flags, problems first, for its staff.
 * #50: who has checked in today and when they last trained, filters, and pull to refresh.
 * The order, statuses and flag reasons all come from the API and the deterministic engine; this
 * screen only displays and filters them. Status is always written as text, never shown by colour
 * alone. Reloads when it comes back into view, so it reflects new logs and consent changes.
 */
export default function SquadOverviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const { squadId, squadName } = useLocalSearchParams<{ squadId: string; squadName?: string }>();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<OverviewFilter>('all');

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

  /** #50 AC3: keeps the current list on screen while it reloads. */
  async function refresh() {
    setRefreshing(true);
    try {
      const overview = await api.squadOverview(squadId);
      setState({ kind: 'loaded', overview });
    } catch (error: unknown) {
      setState((current) =>
        // With no signal or a server fault, the last overview stays, marked with its time. Any other
        // refusal (for example the viewer was removed from the squad) drops it, so no data the
        // viewer may no longer see stays on screen.
        current.kind === 'loaded' && keepsLastOverview(error)
          ? { ...current, refreshError: `Couldn't refresh, so this is still the overview from ${clockTime(current.overview.generatedAt)}.` }
          : { kind: 'error', message: errorMessage(error) },
      );
    } finally {
      setRefreshing(false);
    }
  }

  function openAthlete(athlete: SharingAthlete) {
    router.push({
      pathname: '/squad-athlete-load',
      params: { squadId, athleteId: athlete.athleteId, name: athlete.displayName },
    });
  }

  const title = state.kind === 'loaded' ? state.overview.squadName : (squadName ?? 'Squad overview');

  return (
    <Screen
      testID="squad-overview"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          enabled={state.kind === 'loaded'}
          tintColor={colors.accent}
        />
      }
    >
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

      {state.kind === 'loaded' ? (
        <Overview
          overview={state.overview}
          filter={filter}
          onFilter={setFilter}
          refreshing={refreshing}
          refreshError={state.refreshError}
          onRefresh={refresh}
          onOpen={openAthlete}
        />
      ) : null}
    </Screen>
  );
}

interface OverviewProps {
  overview: SquadOverview;
  filter: OverviewFilter;
  onFilter: (filter: OverviewFilter) => void;
  refreshing: boolean;
  refreshError?: string;
  onRefresh: () => void;
  onOpen: (athlete: SharingAthlete) => void;
}

function Overview({ overview, filter, onFilter, refreshing, refreshError, onRefresh, onOpen }: OverviewProps) {
  const updated = (
    <>
      <View style={styles.updatedRow}>
        <AppText variant="caption" color="textMuted" style={styles.flex}>
          {`Last updated ${clockTime(overview.generatedAt)}`}
        </AppText>
        {/* Pull to refresh is a gesture, so a button gives the same action to everyone (WCAG 2.5.1). */}
        <View style={styles.refresh}>
          <Button label="Refresh" variant="outline" size="sm" icon="refresh" loading={refreshing} onPress={onRefresh} />
        </View>
      </View>
      {refreshError ? <InlineMessage kind="error" text={refreshError} /> : null}
    </>
  );

  if (overview.athletes.length === 0) {
    return (
      <>
        <Card gap={4}>
          <AppText variant="heading">No athletes yet</AppText>
          <AppText variant="body" color="textMuted">
            Share the squad&apos;s invite code so athletes can join.
          </AppText>
        </Card>
        {updated}
      </>
    );
  }

  const shown = filterOverview(overview.athletes, filter);
  const count = (value: OverviewFilter) => filterOverview(overview.athletes, value).length;
  const filters = [
    { value: 'all' as const, label: `All (${count('all')})`, accessibilityLabel: `All athletes, ${count('all')}` },
    { value: 'flagged' as const, label: `Flagged (${count('flagged')})`, accessibilityLabel: `Flagged, ${count('flagged')}` },
    {
      value: 'not-logged' as const,
      label: `Not logged (${count('not-logged')})`,
      accessibilityLabel: `Not logged today, ${count('not-logged')}`,
    },
  ];

  return (
    <>
      <View style={styles.tiles} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <CountTile label="Flagged" value={count('flagged')} tone="warning" />
        <CountTile label="Not logged" value={count('not-logged')} tone="text" />
        <CountTile label="Athletes" value={count('all')} tone="text" />
      </View>
      <AppText variant="caption" color="textMuted" accessibilityRole="header">
        {summary(overview.athletes)}
      </AppText>
      {updated}
      <OptionRow options={filters} selected={filter} onSelect={onFilter} accessibilityLabel="Show athletes" />
      {shown.length === 0 ? (
        <Card gap={4}>
          <AppText variant="body">{EMPTY_FILTER[filter]}</AppText>
        </Card>
      ) : null}
      {shown.map((athlete) =>
        athlete.sharing ? (
          <SharingRow key={athlete.athleteId} athlete={athlete} today={overview.date} onOpen={() => onOpen(athlete)} />
        ) : (
          <Card key={athlete.athleteId} gap={2}>
            <View
              style={styles.person}
              accessible
              accessibilityLabel={`${athlete.displayName}, not sharing data with this squad`}
            >
              <Avatar name={athlete.displayName} size={36} />
              <View style={styles.text}>
                <AppText variant="body">{athlete.displayName}</AppText>
                <AppText variant="caption" color="textMuted">
                  Not sharing data with this squad
                </AppText>
              </View>
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

const EMPTY_FILTER: Record<OverviewFilter, string> = {
  all: 'No athletes to show.',
  flagged: 'No athletes are flagged today.',
  'not-logged': 'Every athlete sharing data has checked in today.',
};

function SharingRow({ athlete, today, onOpen }: { athlete: SharingAthlete; today: string; onOpen: () => void }) {
  const status = STATUS_LABEL[athlete.status];
  const load = loadLine(athlete);
  const logged = loggingLine(athlete, today);
  const notes = athlete.status === 'flagged' ? athlete.flags.map((flag) => flag.reason) : uncheckedNotes(athlete.checks);
  const label = [`${athlete.displayName}, ${status}.`, ...notes, `${logged}.`, load].join(' ');

  return (
    <Card tone={athlete.status === 'flagged' ? 'warning' : 'surface'} gap={2}>
      <Pressable
        onPress={onOpen}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens their combined load"
      >
        <Avatar name={athlete.displayName} size={36} />
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <AppText variant="heading" style={styles.flex}>
              {athlete.displayName}
            </AppText>
            <Badge label={status} tone={STATUS_TONE[athlete.status]} icon={athlete.status === 'clear' ? null : undefined} />
          </View>
          {notes.map((note) => (
            <AppText key={note} variant="body">
              {note}
            </AppText>
          ))}
          <AppText variant="caption" color={athlete.logging.checkedInToday ? 'textMuted' : 'text'}>
            {logged}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {load}
          </AppText>
        </View>
        <Icon name="chevron-row" size={18} />
      </Pressable>
    </Card>
  );
}

/** A count above the list; decorative, as the summary line under it says the same in words. */
function CountTile({ label, value, tone }: { label: string; value: number; tone: 'warning' | 'text' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="metric" color={tone === 'warning' && value > 0 ? 'warning' : 'text'}>
        {value}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

/**
 * Why an athlete with no flags is not shown as clear (DL-020). A missing check-in today is not
 * repeated here: the logging line already says "Not checked in today" (#50).
 */
function uncheckedNotes(checks: OverviewChecks): string[] {
  const notes: string[] = [];
  if (checks.acwr === 'unavailable') notes.push('Load ratio not available yet.');
  if (checks.wellness === 'no-baseline') notes.push('Wellness baseline still building.');
  return notes;
}

/** #50 AC1: "Checked in today · Last session yesterday". */
function loggingLine({ logging }: SharingAthlete, today: string): string {
  const checkIn = logging.checkedInToday ? 'Checked in today' : 'Not checked in today';
  return `${checkIn} · ${lastSessionText(logging.lastSessionDate, today)}`;
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

/** "14:05", in the phone's own time zone. */
function clockTime(instant: string): string {
  return new Date(instant).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** A refresh that fails for lack of signal or a server fault keeps the last overview on screen. */
function keepsLastOverview(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return "Can't reach LoadWise, so the squad overview can't load. Check your connection, then try again.";
  }
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

const styles = StyleSheet.create({
  // 44 px minimum height keeps each row a comfortable touch target (WCAG 2.2 target size).
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { gap: 3, flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderWidth: 1, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 12, gap: 2 },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refresh: { width: 124 },
});
