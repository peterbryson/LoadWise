import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import type { ApiClient, SavedWellness } from '@/lib/api';
import { localIsoDate } from '@/lib/dates';
import { useOfflineSync } from '@/lib/offline-sync';
import { useApiRequest } from '@/lib/use-api-request';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

const loadToday = (api: ApiClient) => api.wellnessToday();

const scoreItems: { key: keyof Pick<SavedWellness, 'sleep' | 'soreness' | 'fatigue' | 'stress'>; label: string }[] = [
  { key: 'sleep', label: 'Sleep' },
  { key: 'soreness', label: 'Soreness' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'stress', label: 'Stress' },
];

/**
 * #45: the morning check-in card on Today, from `GET /wellness/today`. Before the check-in it
 * invites one; afterwards it shows the four scores (1 worst, 5 best). A check-in saved offline
 * (#6) counts as done, marked as waiting to sync. If the API cannot be reached the invitation is
 * shown, since a check-in can still be saved on the phone.
 */
export function CheckInCard() {
  const router = useRouter();
  const { state } = useApiRequest(loadToday);
  const { pending } = useOfflineSync();

  const today = state.kind === 'loaded' ? state.data.date : localIsoDate(new Date());
  const waiting = pending.find((entry) => entry.kind === 'wellness' && entry.payload.date === today);
  const saved = state.kind === 'loaded' ? state.data.entry : null;
  const scores = saved ?? (waiting?.kind === 'wellness' ? waiting.payload : null);

  if (state.kind === 'loading' && !waiting) {
    return (
      <Card>
        <CardHeader title="Morning check-in" description="Checking today's check-in…" />
      </Card>
    );
  }

  if (scores) {
    return (
      <Card>
        <CardHeader
          title="Morning check-in"
          description={saved ? 'Thanks. Your scores for today:' : 'Saved on this phone. It syncs when you are back online.'}
          trailing={<Badge label={saved ? 'Done' : 'Waiting to sync'} tone={saved ? 'accent' : 'neutral'} />}
        />
        <View style={styles.scores}>
          {scoreItems.map((item) => (
            <ScoreChip key={item.key} label={item.label} value={scores[item.key]} />
          ))}
        </View>
      </Card>
    );
  }

  return (
    <Card tone="accent">
      <CardHeader title="Morning check-in" description="Four quick taps, about 30 seconds." />
      <Button label="Start check-in" onPress={() => router.push('/wellness')} />
    </Card>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.chip, { backgroundColor: colors.surfaceRaised }]}
      accessible
      accessibilityLabel={`${label} ${value} of 5`}
    >
      <AppText variant="metric">{value}</AppText>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scores: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, gap: 2 },
});
