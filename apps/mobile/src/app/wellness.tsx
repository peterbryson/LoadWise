import { WellnessCheckSchema } from '@loadwise/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { InlineMessage } from '@/components/InlineMessage';
import { OptionRow } from '@/components/Option';
import { PreviewBanner } from '@/components/PreviewBanner';
import { NavHeader, Screen } from '@/components/Screen';

type Item = 'sleep' | 'soreness' | 'fatigue' | 'stress';

// 1 is worst and 5 best for every item, with each end labelled in plain language (#5, 3 Nov).
const items: { key: Item; label: string; low: string; high: string }[] = [
  { key: 'sleep', label: 'Sleep', low: 'Poor', high: 'Great' },
  { key: 'soreness', label: 'Soreness', low: 'Very sore', high: 'No soreness' },
  { key: 'fatigue', label: 'Fatigue', low: 'Exhausted', high: 'Fresh' },
  { key: 'stress', label: 'Stress', low: 'Very stressed', high: 'Relaxed' },
];

const scores = [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }));

/** #5 wellness check. The form validates with the shared schema; saving arrives with #5. */
export default function WellnessScreen() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Partial<Record<Item, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  function save() {
    const today = new Date().toISOString().slice(0, 10);
    const result = WellnessCheckSchema.safeParse({ date: today, ...answers });
    setChecked(result.success);
    setError(result.success ? null : 'Choose a score from 1 to 5 for each question.');
  }

  return (
    <Screen>
      <NavHeader title="Morning check-in" icon="close" onPress={() => router.back()} />
      <PreviewBanner note="check-ins are not saved yet. Saving arrives with #5." />

      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <AppText variant="heading">{item.label}</AppText>
          <OptionRow
            options={scores}
            selected={answers[item.key]}
            onSelect={(value) => {
              setAnswers((current) => ({ ...current, [item.key]: value }));
              setChecked(false);
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
      {checked ? <InlineMessage kind="info" text="Preview: this check-in is valid but was not saved." /> : null}

      <Button label="Save check-in" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: 6 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
