import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { LoadTrends } from '@/components/LoadTrends';
import { PreviewBanner } from '@/components/PreviewBanner';
import { Screen, ScreenHeader } from '@/components/Screen';
import { sample } from '@/preview/sample-data';

/**
 * Trends: weekly load and load ratio from the API (#7), then wellness against the athlete's usual.
 * Wellness is still sample data, so its preview banner sits with that section only.
 */
export default function TrendsScreen() {
  return (
    <Screen withTabBar>
      <ScreenHeader caption="Last 6 weeks" title="Trends" />
      <LoadTrends />
      <PreviewBanner note="sample wellness data. Wellness trends arrive with #9." />
      <WellnessPreview />
    </Screen>
  );
}

function WellnessPreview() {
  return (
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
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  values: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
});
