import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { FlagStatusCard } from '@/components/FlagStatusCard';
import { LatestSessionCard } from '@/components/LatestSessionCard';
import { Screen, ScreenHeader } from '@/components/Screen';
import { SyncStatusCard } from '@/components/SyncStatusCard';
import { TeamSessionsToRate } from '@/components/TeamSessionsToRate';
import { CheckInCard } from '@/components/today/CheckInCard';
import { WeekLoadCard } from '@/components/today/WeekLoadCard';
import { todayCaption } from '@/lib/dates';

/**
 * Today: status first, then the numbers (DL-006). Since #45 every card shows real data: the
 * engine's flags (#9), today's check-in, this week's load from `GET /me/load` (#7), team sessions
 * waiting for an RPE (#17), the latest session (#4 AC4) and anything waiting to sync (#6). Each
 * card loads and fails on its own, so one failure never blanks the screen.
 */
export default function TodayScreen() {
  const router = useRouter();

  return (
    <Screen withTabBar>
      <ScreenHeader caption={todayCaption(new Date())} title="Today" />
      <SyncStatusCard />
      <FlagStatusCard />
      <CheckInCard />
      <WeekLoadCard />
      <TeamSessionsToRate />
      <LatestSessionCard />
      <Button label="Log a session" icon="plus" onPress={() => router.push('/log-session')} />
    </Screen>
  );
}
