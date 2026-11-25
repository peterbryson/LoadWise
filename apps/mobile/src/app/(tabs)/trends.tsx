import { LoadTrends } from '@/components/LoadTrends';
import { Screen, ScreenHeader } from '@/components/Screen';
import { WellnessTrend } from '@/components/WellnessTrend';

/**
 * Trends: weekly load and load ratio from the API (#7), then wellness 7-day averages against the
 * athlete's usual (#9 AC3). Both sections are real data.
 */
export default function TrendsScreen() {
  return (
    <Screen withTabBar>
      <ScreenHeader caption="Last 6 weeks" title="Trends" />
      <LoadTrends />
      <WellnessTrend />
    </Screen>
  );
}
