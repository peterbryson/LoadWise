import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FlagStatusCard } from '@/components/FlagStatusCard';
import { Icon } from '@/components/Icon';
import { LatestSessionCard } from '@/components/LatestSessionCard';
import { Metric, MetricRow } from '@/components/Metric';
import { PreviewBanner } from '@/components/PreviewBanner';
import { ProgressBar, Screen, ScreenHeader } from '@/components/Screen';
import { todayCaption } from '@/lib/dates';
import { sample } from '@/preview/sample-data';

type TodayState = 'new' | 'usual' | 'offline';

const states = [
  { value: 'new', label: 'New user' },
  { value: 'usual', label: 'Usual range' },
  { value: 'offline', label: 'Saved offline' },
] as const;

/**
 * Today: status first, then the numbers (DL-006). Every figure here is Figma sample data except the
 * flags (#9) and the Latest session card, which shows the athlete's newest saved session (#4 AC4).
 */
export default function TodayScreen() {
  const router = useRouter();
  const [state, setState] = useState<TodayState>('usual');

  return (
    <Screen withTabBar>
      <ScreenHeader caption={todayCaption(new Date())} title="Today" />
      <PreviewBanner
        note="sample data, except Latest session and flags. Load metrics arrive with #7."
        states={states}
        state={state}
        onStateChange={setState}
      />

      {state === 'new' ? (
        <>
          <Card tone="accent">
            <AppText variant="title">Morning check-in</AppText>
            <AppText variant="body" color="textMuted">
              Four quick taps. About 30 seconds.
            </AppText>
            <Button label="Start check-in" onPress={() => router.push('/wellness')} />
          </Card>
          <Card gap={10}>
            <AppText variant="heading">Building your baseline</AppText>
            <AppText variant="caption" color="textMuted">
              Keep logging so LoadWise can compare you with your own usual.
            </AppText>
            <ProgressBar
              fraction={sample.baseline.day / sample.baseline.of}
              label={`Baseline: day ${sample.baseline.day} of ${sample.baseline.of}`}
            />
            <AppText variant="caption" color="textMuted">
              Day {sample.baseline.day} of {sample.baseline.of}
            </AppText>
          </Card>
          <MetricRow>
            <Metric label="This week" value={sample.newUser.thisWeek} unit="AU" />
            <Metric label="Sessions" value={sample.newUser.sessions} unit="this week" />
          </MetricRow>
          <Button label="Log a session" variant="secondary" onPress={() => router.push('/log-session')} />
        </>
      ) : (
        <>
          {state === 'offline' ? (
            <Card tone="raised" gap={4}>
              <View style={styles.titleRow}>
                <Icon name="cloud" size={20} />
                <AppText variant="heading">Saved on this phone</AppText>
              </View>
              <AppText variant="caption" color="textMuted">
                No signal right now. Your session will sync automatically when you are back online.
              </AppText>
            </Card>
          ) : null}

          {/* #9: real flags from the engine, not part of the preview. */}
          <FlagStatusCard />

          <MetricRow>
            <Metric
              label="This week"
              value={sample.usual.thisWeek}
              unit="AU"
            />
            <Metric label="Usual week" value={sample.usual.usualWeek} unit="AU" />
          </MetricRow>

          {state !== 'offline' ? (
            <Card gap={4}>
              <View style={styles.doneRow}>
                <Icon name="check-done" size={18} />
                <AppText variant="label" color="accent">
                  Check-in done
                </AppText>
              </View>
              <AppText variant="body">{sample.wellnessInsight}</AppText>
            </Card>
          ) : null}

          {/* #4 AC4: real data from the API, not part of the preview. */}
          <LatestSessionCard />

          <Button label="Log a session" onPress={() => router.push('/log-session')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
