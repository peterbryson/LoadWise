import type { LoadTotals, MyLoad } from '@loadwise/shared';
import { ACWR_MIN_DAYS, daysBetween } from '@loadwise/analytics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { ProgressBar } from '@/components/Screen';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; load: MyLoad };

/** Tallest bar, in px, as in the Figma weekly load chart. */
const MAX_BAR_HEIGHT = 76;

/**
 * #7 AC3: weekly load for the last 6 weeks and the load ratio (ACWR), from `GET /me/load`. Loads
 * again whenever Trends comes back into view, so a session that was just logged is included.
 * Describes load only: it never says what a number means for injury.
 */
export function LoadTrends() {
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
        .myLoad()
        .then((load) => {
          if (!cancelled) setState({ kind: 'loaded', load });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState({ kind: 'error', message: errorMessage(error) });
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

  if (state.kind === 'loading') {
    return (
      <Card>
        <AppText variant="heading">Weekly load</AppText>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading your weekly load" />
      </Card>
    );
  }

  if (state.kind === 'error') {
    return (
      <Card gap={8}>
        <AppText variant="heading">Weekly load</AppText>
        <InlineMessage kind="error" text={state.message} />
        <Button label="Try again" variant="secondary" onPress={retry} />
      </Card>
    );
  }

  const { load } = state;
  // availableFrom is set from the first session, so null means nothing has been logged yet.
  if (load.acwr.availableFrom === null) {
    return (
      <Card gap={4}>
        <AppText variant="heading">No sessions yet</AppText>
        <AppText variant="body" color="textMuted">
          Log your first training session or match to see your weekly load here.
        </AppText>
        <Button label="Log your first session" variant="secondary" onPress={() => router.push('/log-session')} />
      </Card>
    );
  }

  return (
    <>
      <WeeklyLoadCard load={load} />
      <AcwrCard acwr={load.acwr} today={load.today} availableFrom={load.acwr.availableFrom} />
    </>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) {
    return "Can't reach LoadWise, so your trends can't load. Check your connection, then try again.";
  }
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/** Whose load a card describes: the athlete's own (Trends) or an athlete's, seen by staff (#8). */
export type Whose = 'your' | 'their';

/** Weekly load bars. Shared by Trends (#7) and the staff view of an athlete's combined load (#8). */
export function WeeklyLoadCard({ load }: { load: LoadTotals }) {
  const { colors } = useTheme();
  const highest = Math.max(...load.weeks.map((week) => week.load));
  const summary = [
    `Weekly load for the last ${load.weeks.length} weeks.`,
    ...load.weeks.map((week) => `${weekName(week.weekStart, week.partial)}: ${au(week.load)}.`),
    load.usualWeek === null ? '' : `Usual week ${au(load.usualWeek)}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Card>
      <View style={styles.titleRow}>
        <AppText variant="heading">Weekly load</AppText>
        {load.usualWeek === null ? null : (
          <AppText variant="caption" color="textMuted">
            Usual {au(load.usualWeek)}
          </AppText>
        )}
      </View>
      <View style={styles.bars} accessible accessibilityLabel={summary}>
        {load.weeks.map((week) => (
          <Bar
            key={week.weekStart}
            label={week.partial ? 'This wk' : weekLabel(week.weekStart)}
            value={number(week.load)}
            height={barHeight(week.load, highest)}
            color={week.partial ? colors.accent : colors.border}
          />
        ))}
      </View>
      <AppText variant="caption" color="textMuted">
        Load is RPE × minutes, in arbitrary units (AU). Weeks run Monday to Sunday.
      </AppText>
    </Card>
  );
}

interface AcwrCardProps {
  acwr: LoadTotals['acwr'];
  today: string;
  /** Known, because the athlete has logged at least one session. */
  availableFrom: string;
  whose?: Whose;
}

export function AcwrCard({ acwr, today, availableFrom, whose = 'your' }: AcwrCardProps) {
  const daysToGo = daysBetween(today, availableFrom);

  if (acwr.value === null && daysToGo > 0) {
    const daysSoFar = ACWR_MIN_DAYS - daysToGo;
    return (
      <Card tone="accent">
        <AppText variant="heading">Load ratio (ACWR)</AppText>
        <AppText variant="body" color="textMuted">
          {`Available from ${longDay(availableFrom)}, once LoadWise has ${ACWR_MIN_DAYS} days of ${whose} data.`}
        </AppText>
        <ProgressBar
          fraction={daysSoFar / ACWR_MIN_DAYS}
          label={`Load ratio: ${daysSoFar} of ${ACWR_MIN_DAYS} days`}
        />
        <AppText variant="caption" color="textMuted">
          {`${daysSoFar} of ${ACWR_MIN_DAYS} days`}
        </AppText>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.titleRow}>
        <AppText variant="heading">Load ratio (ACWR)</AppText>
        {acwr.value === null ? null : <AppText variant="heading">{acwr.value.toFixed(2)}</AppText>}
      </View>
      <AppText variant="body">{acwrSentence(acwr.value, whose)}</AppText>
      <AppText variant="caption" color="textMuted">
        {`Compares ${whose} last 7 days of load with ${whose} last 28 days, weighting recent days more. 1.00 means about the same.`}
      </AppText>
    </Card>
  );
}

/** Plain-language reading of the ratio against 1 only; flag thresholds belong to the engine (#9). */
function acwrSentence(value: number | null, whose: Whose): string {
  if (value === null) return 'No load in the last 28 days to compare with.';
  const subject = whose === 'your' ? 'Your' : 'Their';
  const rounded = value.toFixed(2);
  if (rounded === '1.00') return `${subject} recent load is about the same as ${whose} longer-term load.`;
  return Number(rounded) > 1
    ? `${subject} recent load is higher than ${whose} longer-term load.`
    : `${subject} recent load is lower than ${whose} longer-term load.`;
}

function barHeight(load: number, highest: number): number {
  // A thin bar keeps an empty week visible, so a gap reads as "no load" rather than missing data.
  if (load === 0 || highest === 0) return 2;
  return Math.max(4, Math.round((load / highest) * MAX_BAR_HEIGHT));
}

function calendarDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "19 Oct" */
function weekLabel(weekStart: string): string {
  return calendarDay(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "25 November" */
function longDay(date: string): string {
  return calendarDay(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function weekName(weekStart: string, partial: boolean): string {
  return partial ? 'This week so far' : `Week of ${weekLabel(weekStart)}`;
}

function number(value: number): string {
  return Math.round(value).toLocaleString('en-GB');
}

function au(value: number): string {
  return `${number(value)} AU`;
}

interface BarProps {
  label: string;
  value: string;
  height: number;
  color: string;
}

function Bar({ label, value, height, color }: BarProps) {
  return (
    <View style={styles.week}>
      <AppText variant="caption">{value}</AppText>
      <View style={[styles.bar, { height, backgroundColor: color }]} />
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  week: { flex: 1, height: 120, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { alignSelf: 'stretch', marginHorizontal: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
});
