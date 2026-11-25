import type { WellnessItem, WellnessTrendPoint } from '@loadwise/analytics';
import { WELLNESS_ITEMS } from '@loadwise/analytics';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { ProgressBar } from '@/components/Screen';
import type { ApiClient, WellnessTrend as WellnessTrendData } from '@/lib/api';
import { oneDecimal, wellnessItemLabels } from '@/lib/flag-format';
import { useApiRequest } from '@/lib/use-api-request';
import { useTheme } from '@/theme/theme';

const loadTrend = (api: ApiClient) => api.myWellnessTrend();

/**
 * #9 AC3: each wellness item's 7-day average against the athlete's own baseline, this week and
 * for each earlier week, from `GET /me/wellness-trend`. Below-usual values are not coloured as
 * warnings: only the flag rules decide what counts as unusual.
 */
export function WellnessTrend() {
  const { colors } = useTheme();
  const { state, retry } = useApiRequest(loadTrend);

  return (
    <Card>
      <View style={styles.titleRow}>
        <AppText variant="heading">Wellness</AppText>
        <AppText variant="caption" color="textMuted">
          7-day average vs usual
        </AppText>
      </View>

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading wellness trend" />
      ) : null}
      {state.kind === 'offline' ? (
        <InlineMessage kind="info" text="You are offline. Your wellness trend loads when you are back online." />
      ) : null}
      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}
      {state.kind === 'loaded' ? <Loaded data={state.data} /> : null}
    </Card>
  );
}

function Loaded({ data }: { data: WellnessTrendData }) {
  const thisWeek: WellnessTrendPoint | undefined = data.weeks[data.weeks.length - 1];
  const average = thisWeek?.average ?? null;
  const baseline = thisWeek?.baseline ?? null;
  const anyWeekHasCheckIns = data.weeks.some((week) => week.average !== null);

  return (
    <>
      {baseline === null ? (
        <>
          <AppText variant="body" color="textMuted">
            {`Your usual needs ${data.minCheckIns} check-ins in 28 days (${data.baselineCheckIns} so far).`}
          </AppText>
          <ProgressBar
            fraction={data.baselineCheckIns / data.minCheckIns}
            label={`Wellness baseline: ${data.baselineCheckIns} of ${data.minCheckIns} check-ins`}
          />
        </>
      ) : null}

      {average === null ? (
        <AppText variant="body" color="textMuted">
          No check-ins in the last 7 days.
        </AppText>
      ) : (
        WELLNESS_ITEMS.map((item) => {
          const label = wellnessItemLabels[item];
          const value = oneDecimal(average.items[item]);
          const usual = baseline ? oneDecimal(baseline.items[item].mean) : null;
          return (
            <View
              key={item}
              style={styles.titleRow}
              accessible
              accessibilityLabel={
                usual ? `${label}: 7-day average ${value}, usual ${usual}` : `${label}: 7-day average ${value}`
              }
            >
              <AppText variant="body">{label}</AppText>
              <View style={styles.values}>
                <AppText variant="heading">{value}</AppText>
                {usual ? (
                  <AppText variant="caption" color="textMuted">
                    {`usual ${usual}`}
                  </AppText>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      {anyWeekHasCheckIns ? (
        <>
          <AppText variant="caption" color="textMuted">
            {`Last ${data.weeks.length} weeks, oldest on the left`}
          </AppText>
          {WELLNESS_ITEMS.map((item) => (
            <WeeklyBars key={item} item={item} weeks={data.weeks} />
          ))}
        </>
      ) : null}
    </>
  );
}

const BAR_HEIGHT = 32;
const MAX_SCORE = 5;

function weekSummary(item: WellnessItem, week: WellnessTrendPoint): string {
  if (week.average === null) return 'no check-ins';
  const usual = week.baseline ? `usual ${oneDecimal(week.baseline.items[item].mean)}` : 'no usual yet';
  return `${oneDecimal(week.average.items[item])} (${usual})`;
}

/**
 * One small bar per week: its height is the 7-day average out of 5 and the tick marks that week's
 * usual. Screen readers get the same numbers as one summary label.
 */
function WeeklyBars({ item, weeks }: { item: WellnessItem; weeks: WellnessTrendPoint[] }) {
  const { colors } = useTheme();
  const label = wellnessItemLabels[item];
  const summary =
    `${label}, 7-day averages over the last ${weeks.length} weeks, oldest first: ` +
    weeks.map((week) => weekSummary(item, week)).join('; ');

  return (
    <View style={styles.history} accessible accessibilityLabel={summary}>
      <AppText variant="caption" style={styles.historyLabel}>
        {label}
      </AppText>
      <View style={styles.bars}>
        {weeks.map((week) => (
          <View key={week.endDate} style={[styles.slot, { backgroundColor: colors.surfaceRaised }]}>
            {week.average ? (
              <View
                style={[
                  styles.bar,
                  { height: (week.average.items[item] / MAX_SCORE) * BAR_HEIGHT, backgroundColor: colors.accent },
                ]}
              />
            ) : null}
            {week.baseline ? (
              <View
                style={[
                  styles.usual,
                  { bottom: (week.baseline.items[item].mean / MAX_SCORE) * BAR_HEIGHT, backgroundColor: colors.text },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  values: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  history: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  historyLabel: { width: 64 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  slot: { flex: 1, height: BAR_HEIGHT, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  usual: { position: 'absolute', left: 0, right: 0, height: 2 },
});
