import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { PreviewBanner } from '@/components/PreviewBanner';
import { NavHeader, Screen } from '@/components/Screen';
import { sample } from '@/preview/sample-data';

const numbers = [
  { label: 'Load ratio (ACWR)', value: sample.flagged.ratio },
  { label: 'Guide', value: sample.flagged.guide },
  { label: 'This week', value: `${sample.flagged.thisWeek} AU` },
  { label: 'Usual week', value: `${sample.flagged.usualWeek} AU` },
];

/**
 * #12 "why was I flagged", from the Figma design. A real flag will come from the deterministic
 * engine (#9) with its reason, value and threshold; the wording never tells the athlete to change
 * load, rest or return to play (DL-006).
 */
export default function FlagScreen() {
  const router = useRouter();
  return (
    <Screen>
      <NavHeader title="Why this was flagged" icon="back" onPress={() => router.back()} />
      <PreviewBanner note="sample flag. Real flags arrive with #9." />

      <Card tone="warning">
        <View style={styles.title}>
          <Icon name="alert-warning-24" size={24} />
          <AppText variant="heading" style={styles.flex}>
            {sample.flagged.title}
          </AppText>
        </View>
      </Card>

      <Card gap={10}>
        <AppText variant="caption" color="textMuted">
          The numbers
        </AppText>
        {numbers.map((row) => (
          <View key={row.label} style={styles.row}>
            <AppText variant="body">{row.label}</AppText>
            <AppText variant="heading">{row.value}</AppText>
          </View>
        ))}
      </Card>

      <Card gap={6}>
        <AppText variant="heading">What it means</AppText>
        <AppText variant="body" color="textMuted">
          This week is well above your recent average. A sudden rise is worth reviewing, even if you feel fine.
        </AppText>
      </Card>

      <Card gap={6}>
        <AppText variant="heading">What you can do</AppText>
        <AppText variant="body" color="textMuted">
          Talk through your next few sessions with your coach.
        </AppText>
      </Card>

      <InlineMessage
        kind="info"
        text="This is training guidance, not a medical assessment. For pain or injury, speak to a physio or GP."
      />
      <Button label="Got it" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
});
