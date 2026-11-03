import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { themedArtwork } from '@/components/Icon';
import { PreviewBanner } from '@/components/PreviewBanner';
import { ProgressBar, Screen, ScreenHeader } from '@/components/Screen';
import { sample } from '@/preview/sample-data';
import { useTheme } from '@/theme/theme';

type TrendsState = 'full' | 'building';

const states = [
  { value: 'full', label: 'Six weeks' },
  { value: 'building', label: 'Not enough data' },
] as const;

/** Trends: weekly load, load ratio and wellness against the athlete's usual. Sample data only. */
export default function TrendsScreen() {
  const [state, setState] = useState<TrendsState>('full');
  return (
    <Screen withTabBar>
      <ScreenHeader caption={state === 'full' ? 'Last 6 weeks' : 'Your first weeks'} title="Trends" />
      <PreviewBanner
        note="sample data. Trends arrive with #7 and #9."
        states={states}
        state={state}
        onStateChange={setState}
      />
      {state === 'full' ? <SixWeeks /> : <FirstWeeks />}
    </Screen>
  );
}

function SixWeeks() {
  const { colors, name } = useTheme();
  return (
    <>
      <Card>
        <View style={styles.titleRow}>
          <AppText variant="heading">Weekly load</AppText>
          <AppText variant="caption" color="textMuted">
            Usual {sample.usual.usualWeek} AU
          </AppText>
        </View>
        <View style={styles.bars} accessible accessibilityLabel={`Weekly load. This week ${sample.nowBar.value} AU.`}>
          {sample.weeklyLoad.map((week) => (
            <Bar key={week.label} label={week.label} height={week.height} color={colors.border} />
          ))}
          <Bar
            label={sample.nowBar.label}
            value={sample.nowBar.value}
            height={sample.nowBar.height}
            color={colors.warning}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.titleRow}>
          <AppText variant="heading">Load ratio (ACWR)</AppText>
          <AppText variant="heading" color="warning">
            {sample.flagged.ratio}
          </AppText>
        </View>
        {/* Positions match the Figma "Ratio chart" frame (318 × 64), scaled to the card width. */}
        <View style={styles.chart} accessible={false}>
          <Image source={themedArtwork('chart-guide', name)} contentFit="fill" style={styles.guide} />
          <Image source={themedArtwork('chart-line', name)} contentFit="fill" style={styles.line} />
        </View>
        <AppText variant="caption" color="textMuted">
          Dashed line: {sample.flagged.guide} guide. This week is above it.
        </AppText>
      </Card>

      <Card>
        <View style={styles.titleRow}>
          <AppText variant="heading">Wellness</AppText>
          <AppText variant="caption" color="textMuted">
            7-day average vs usual
          </AppText>
        </View>
        {sample.wellnessTrend.map((item) => (
          <View key={item.label} style={styles.titleRow}>
            <AppText variant="body">{item.label}</AppText>
            <View style={styles.values}>
              <AppText variant="heading" color={item.belowUsual ? 'warning' : 'text'}>
                {item.value}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {item.usual}
              </AppText>
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function FirstWeeks() {
  const { colors } = useTheme();
  return (
    <>
      <Card tone="accent">
        <AppText variant="title">Your trends are building</AppText>
        <AppText variant="body" color="textMuted">
          Load ratio and wellness baselines appear once LoadWise has {sample.baseline.of} days of your data.
        </AppText>
        <ProgressBar
          fraction={sample.baseline.day / sample.baseline.of}
          label={`Baseline: day ${sample.baseline.day} of ${sample.baseline.of}`}
        />
        <AppText variant="caption" color="textMuted">
          Day {sample.baseline.day} of {sample.baseline.of}
        </AppText>
      </Card>
      <Card>
        <AppText variant="heading">Weekly load</AppText>
        <View style={styles.bars}>
          {sample.firstWeeks.map((week, index) => (
            <Bar
              key={week.label}
              label={week.label}
              value={week.value}
              height={week.height}
              color={index === sample.firstWeeks.length - 1 ? colors.accent : colors.border}
            />
          ))}
        </View>
      </Card>
      <Card gap={4}>
        <AppText variant="heading">Logged so far</AppText>
        <AppText variant="body" color="textMuted">
          {sample.loggedSoFar}
        </AppText>
      </Card>
    </>
  );
}

interface BarProps {
  label: string;
  value?: string;
  height: number;
  color: string;
}

function Bar({ label, value, height, color }: BarProps) {
  return (
    <View style={styles.week}>
      {value ? <AppText variant="caption">{value}</AppText> : null}
      <View style={[styles.bar, { height, backgroundColor: color }]} />
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  values: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  week: { flex: 1, height: 120, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: 32, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  chart: { height: 64, alignSelf: 'stretch', overflow: 'hidden' },
  guide: { position: 'absolute', left: 0, right: 0, top: 18.25, height: 1.5 },
  line: { position: 'absolute', left: '1.17%', right: '1.17%', top: 9.75, height: 47.5 },
});
