import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme/theme';

const points: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'activity',
    title: 'Track your load',
    text: 'Log sessions and wellness to see how your training is changing compared with your own usual.',
  },
  {
    icon: 'shield',
    title: 'Your data stays yours',
    text: 'Your health and training data is stored securely. Nobody on a team sees it unless you choose to share it.',
  },
  {
    icon: 'info-accent',
    title: 'Guidance, not medical advice',
    text: 'LoadWise does not diagnose or predict injury. For pain or injury, speak to a physio or GP.',
  },
];

/**
 * First-time setup from the Figma design. The consent checkbox must be ticked to continue, but
 * the API cannot store this consent yet: that is a separate change with its own migration (DL-008).
 */
export default function SetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [agreed, setAgreed] = useState(false);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Before you start
        </AppText>
        <AppText variant="body" color="textMuted">
          A quick look at what LoadWise does and how your data is used.
        </AppText>
      </View>

      {points.map((point) => (
        <Card key={point.title} style={styles.point}>
          <Icon name={point.icon} size={24} />
          <View style={styles.pointText}>
            <AppText variant="heading">{point.title}</AppText>
            <AppText variant="caption" color="textMuted">
              {point.text}
            </AppText>
          </View>
        </Card>
      ))}

      <Pressable
        onPress={() => setAgreed((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        style={styles.consent}
      >
        <View
          style={[
            styles.checkbox,
            agreed
              ? { backgroundColor: colors.accent }
              : { borderWidth: 1.5, borderColor: colors.textMuted, backgroundColor: colors.surface },
          ]}
        >
          {agreed ? <Icon name="check-on-accent" size={18} /> : null}
        </View>
        <AppText variant="caption" style={styles.consentText}>
          I agree to LoadWise processing my health and training data, as set out in the privacy notice.
        </AppText>
      </Pressable>

      <InlineMessage
        kind="info"
        text="Preview: this consent is not saved yet. Storing it is planned with DL-008."
      />

      <Button label="Continue" disabled={!agreed} onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pointText: { flex: 1, gap: 4 },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkbox: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  consentText: { flex: 1 },
});
