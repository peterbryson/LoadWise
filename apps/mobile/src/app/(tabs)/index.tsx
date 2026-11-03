import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Metric, MetricRow } from '@/components/Metric';
import { PreviewBanner } from '@/components/PreviewBanner';
import { ProgressBar, Screen, ScreenHeader } from '@/components/Screen';
import { todayCaption } from '@/lib/dates';
import { sample } from '@/preview/sample-data';

type TodayState = 'new' | 'usual' | 'flagged' | 'offline';

const states = [
  { value: 'new', label: 'New user' },
  { value: 'usual', label: 'Usual range' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'offline', label: 'Saved offline' },
] as const;

/** Today: status first, then the numbers (DL-006). Every figure here is Figma sample data. */
export default function TodayScreen() {
  const router = useRouter();
  const [state, setState] = useState<TodayState>('usual');

  return (
    <Screen withTabBar>
      <ScreenHeader caption={todayCaption(new Date())} title="Today" />
      <PreviewBanner
        note="sample data. Load metrics arrive with #7 and flags with #9."
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

          {state === 'flagged' ? (
            <Card tone="warning">
              <View style={styles.flagTitle}>
                <Icon name="alert-warning-24" size={24} />
                <AppText variant="heading" style={styles.flex}>
                  {sample.flagged.title}
                </AppText>
              </View>
              <AppText variant="caption">
                Your load ratio is {sample.flagged.ratio}, above the {sample.flagged.guide} guide.
              </AppText>
              <Link href="/flag" asChild>
                <Pressable accessibilityRole="link" style={styles.seeWhy}>
                  <AppText variant="label" color="warning">
                    See why
                  </AppText>
                  <Icon name="chevron-warning" size={20} />
                </Pressable>
              </Link>
            </Card>
          ) : (
            <Card gap={6}>
              <View style={styles.titleRow}>
                <Icon name="check-status" size={24} />
                <AppText variant="heading" style={styles.flex}>
                  Your load is in your usual range
                </AppText>
              </View>
              <AppText variant="caption" color="textMuted">
                {state === 'offline'
                  ? 'Updates after your session syncs.'
                  : 'Nothing unusual has been flagged today.'}
              </AppText>
            </Card>
          )}

          <MetricRow>
            <Metric
              label="This week"
              value={state === 'flagged' ? sample.flagged.thisWeek : sample.usual.thisWeek}
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

          <Card gap={2}>
            <AppText variant="caption" color="textMuted">
              {state === 'offline' ? 'Latest session · waiting to sync' : 'Latest session'}
            </AppText>
            <AppText variant="heading">{sample.latestSession.title}</AppText>
            <AppText variant="caption" color="textMuted">
              {sample.latestSession.detail}
            </AppText>
          </Card>

          <Button label="Log a session" onPress={() => router.push('/log-session')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flagTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seeWhy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  flex: { flex: 1 },
});
