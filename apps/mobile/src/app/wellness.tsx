import { WellnessCheckSchema } from '@loadwise/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { InlineMessage } from '@/components/InlineMessage';
import { OptionRow } from '@/components/Option';
import { NavHeader, Screen } from '@/components/Screen';
import { ApiError } from '@/lib/api';
import { localIsoDate } from '@/lib/dates';
import { OFFLINE_SAVED_MESSAGE } from '@/lib/offline-queue';
import { useOfflineSync } from '@/lib/offline-sync';

type Item = 'sleep' | 'soreness' | 'fatigue' | 'stress';

// 1 is worst and 5 best for every item, with each end labelled in plain language (#5, 3 Nov).
const items: { key: Item; label: string; low: string; high: string }[] = [
  { key: 'sleep', label: 'Sleep', low: 'Poor', high: 'Great' },
  { key: 'soreness', label: 'Soreness', low: 'Very sore', high: 'No soreness' },
  { key: 'fatigue', label: 'Fatigue', low: 'Exhausted', high: 'Fresh' },
  { key: 'stress', label: 'Stress', low: 'Very stressed', high: 'Relaxed' },
];

const scores = [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }));

/**
 * #5 wellness check. The form validates with the shared schema, then saves through the API, which
 * allows one check-in per day (AC2). Saving returns to Today. With no signal the check-in is kept
 * on the device and synced later (#6 AC1); a second check-in for the same day is still refused
 * when it syncs, because the API keeps the one-per-day rule.
 */
export default function WellnessScreen() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Record<Item, number>>>({});
  const { saveWellness } = useOfflineSync();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queued, setQueued] = useState(false);

  async function save() {
    const result = WellnessCheckSchema.safeParse({ date: localIsoDate(new Date()), ...answers });
    if (!result.success) {
      setError('Choose a score from 1 to 5 for each question.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const outcome = await saveWellness(result.data);
      if (outcome.status === 'queued') {
        setQueued(true);
        setSaving(false);
        return;
      }
      router.back();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  return (
    <Screen>
      <NavHeader title="Morning check-in" icon="close" onPress={() => router.back()} />

      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <AppText variant="heading">{item.label}</AppText>
          <OptionRow
            options={scores}
            selected={answers[item.key]}
            onSelect={(value) => {
              setAnswers((current) => ({ ...current, [item.key]: value }));
            }}
            accessibilityLabel={`${item.label}, 1 is ${item.low}, 5 is ${item.high}`}
          />
          <View style={styles.labels}>
            <AppText variant="caption" color="textMuted">
              {item.low}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {item.high}
            </AppText>
          </View>
        </View>
      ))}

      <InlineMessage kind="info" text="In pain or injured? Speak to a physio or GP." />
      {error ? <InlineMessage kind="error" text={error} /> : null}

      {queued ? (
        <>
          <InlineMessage kind="info" text={OFFLINE_SAVED_MESSAGE} />
          <Button label="Back to Today" onPress={() => router.back()} />
        </>
      ) : (
        <Button label="Save check-in" onPress={save} loading={saving} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: 6 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
