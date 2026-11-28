import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import type { MyLoad } from '@loadwise/shared';
import type { ApiClient, SavedSession } from '@/lib/api';
import { useApiRequest } from '@/lib/use-api-request';
import { barFractions, formatLoad, sessionsInWeek } from '@/lib/week-summary';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

interface WeekData {
  load: MyLoad;
  sessions: SavedSession[];
}

async function loadWeek(api: ApiClient): Promise<WeekData> {
  const [load, sessions] = await Promise.all([api.myLoad(), api.recentSessions(50)]);
  return { load, sessions };
}

/**
 * #45: "This week" on Today, from `GET /me/load` (weekly loads and usual week, calculated by the
 * API) and the athlete's recent sessions (the count). Replaces the Figma sample figures. Usual
 * week appears only after 4 completed weeks (DL-007), the same rule as Trends.
 */
export function WeekLoadCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const { state, retry } = useApiRequest(loadWeek);

  if (state.kind === 'loading') {
    return (
      <Card>
        <AppText variant="overline" color="textMuted">
          This week
        </AppText>
        <AppText variant="hero" color="textMuted" accessibilityLabel="Loading this week's load">
          --
        </AppText>
      </Card>
    );
  }

  if (state.kind === 'offline' || state.kind === 'error') {
    return (
      <Card>
        <AppText variant="overline" color="textMuted">
          This week
        </AppText>
        <InlineMessage
          kind={state.kind === 'offline' ? 'info' : 'error'}
          text={state.kind === 'offline' ? 'You are offline. Load updates when you are back online.' : state.message}
        />
        {state.kind === 'error' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={retry} hitSlop={8}>
            <AppText variant="label" color="accent">
              Try again
            </AppText>
          </Pressable>
        ) : null}
      </Card>
    );
  }

  const { load, sessions } = state.data;
  const thisWeek = load.weeks[load.weeks.length - 1];
  const count = thisWeek ? sessionsInWeek(sessions, thisWeek.weekStart) : 0;
  const fractions = barFractions(load.weeks.map((week) => week.load));
  const usual = load.usualWeek === null ? null : formatLoad(load.usualWeek);

  return (
    <Pressable
      onPress={() => router.push('/trends')}
      accessibilityRole="link"
      accessibilityLabel={`This week: ${formatLoad(thisWeek?.load ?? 0)} AU from ${count} ${count === 1 ? 'session' : 'sessions'}. ${
        usual ? `Usual week ${usual} AU.` : 'Usual week needs 4 completed weeks.'
      } Show trends`}
    >
      <Card>
        <View style={styles.top}>
          <View style={styles.flex}>
            <AppText variant="overline" color="textMuted">
              This week
            </AppText>
            <View style={styles.value}>
              <AppText variant="hero">{formatLoad(thisWeek?.load ?? 0)}</AppText>
              <AppText variant="label" color="textMuted">
                AU
              </AppText>
            </View>
            <AppText variant="caption" color="textMuted">
              {`${count} ${count === 1 ? 'session' : 'sessions'} · ${
                usual ? `usual week ${usual} AU` : 'usual week after 4 completed weeks'
              }`}
            </AppText>
          </View>
          <Icon name="chevron-row" size={18} />
        </View>
        <View style={styles.bars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {fractions.map((fraction, index) => {
            const current = index === fractions.length - 1;
            return (
              <View key={load.weeks[index].weekStart} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, fraction * 44),
                      backgroundColor: current ? colors.accent : colors.surfaceRaised,
                      borderColor: current ? colors.accent : colors.border,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1, gap: 2 },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 44, marginTop: 4 },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: radius.sm - 4, borderWidth: 1 },
});
