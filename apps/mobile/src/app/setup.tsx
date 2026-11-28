import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { Screen } from '@/components/Screen';
import { CreateSquadForm } from '@/components/SquadForms';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConsent } from '@/lib/consent';
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

/** #48 AC1: how the user will use LoadWise. */
type Use = 'self' | 'staff' | 'both';

const uses: { value: Use; label: string; hint: string }[] = [
  { value: 'self', label: 'I log my own training', hint: 'Sessions, wellness and your own load.' },
  {
    value: 'staff',
    label: 'I support a squad as staff',
    hint: 'Coach, physio or S&C coach. You will not be asked for health data.',
  },
  { value: 'both', label: 'Both', hint: 'For example a player-coach.' },
];

type Step = 'choose' | 'consent' | 'squad';

/**
 * First-time setup (#1 AC4, #48).
 * 1. Choose: log my own training, support a squad as staff, or both (#48 AC1).
 * 2. Consent, only for those who log their own training: the box must be ticked, and Continue
 *    records it through the API (`POST /me/health-consent`, DL-008).
 * 3. Squad, only for staff: creating the first squad finishes setup without health-data consent
 *    (#48 AC2), because a staff membership is what marks someone as staff.
 *
 * `?start=consent` opens step 2 directly, for a staff-only user who later chooses to log their own
 * training (#48 AC5).
 */
export default function SetupScreen() {
  const router = useRouter();
  const { start } = useLocalSearchParams<{ start?: string }>();
  const { getIdToken } = useAuth();
  const { markGiven, markStaffSquad } = useConsent();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const addingLogging = start === 'consent';
  const [use, setUse] = useState<Use | null>(addingLogging ? 'self' : null);
  const [step, setStep] = useState<Step>(addingLogging ? 'consent' : 'choose');

  function chosen() {
    if (use) setStep(use === 'staff' ? 'squad' : 'consent');
  }

  function consentSaved() {
    markGiven();
    if (use === 'both') setStep('squad');
    else router.replace('/');
  }

  function squadCreated() {
    markStaffSquad();
    router.replace(use === 'staff' ? '/squad' : '/');
  }

  if (step === 'consent') {
    return (
      <ConsentStep
        api={api}
        title={addingLogging ? 'Log your own training' : 'Before you start'}
        onSaved={consentSaved}
        onBack={addingLogging ? () => router.back() : () => setStep('choose')}
      />
    );
  }

  if (step === 'squad') {
    return (
      <Screen>
        <View style={styles.header}>
          <AppText variant="display" accessibilityRole="header">
            Set up your squad
          </AppText>
          <AppText variant="body" color="textMuted">
            Create the squad you support. You can then share its invite code with your athletes.
          </AppText>
        </View>
        <CreateSquadForm api={api} heading="Your squad" onCreated={squadCreated} />
        {use === 'staff' ? (
          <Button label="Back" variant="secondary" onPress={() => setStep('choose')} />
        ) : (
          <Button label="Skip for now" variant="secondary" onPress={() => router.replace('/')} />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          How will you use LoadWise?
        </AppText>
        <AppText variant="body" color="textMuted">
          You can add the other later from Profile.
        </AppText>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="How you will use LoadWise" style={styles.uses}>
        {uses.map((option) => (
          <UseOption key={option.value} {...option} selected={use === option.value} onPress={() => setUse(option.value)} />
        ))}
      </View>
      <Button label="Continue" disabled={!use} onPress={chosen} />
    </Screen>
  );
}

function UseOption({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected, checked: selected }}
      style={[
        styles.use,
        // A thicker border as well as the colour, so the choice is not shown by colour alone.
        selected
          ? { borderWidth: 3, borderColor: colors.accent, backgroundColor: colors.surface }
          : { borderWidth: 1.5, borderColor: colors.textMuted, backgroundColor: colors.surface },
      ]}
    >
      <AppText variant="heading" color={selected ? 'accent' : 'text'}>
        {label}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {hint}
      </AppText>
    </Pressable>
  );
}

interface ConsentStepProps {
  api: ReturnType<typeof createApiClient>;
  title: string;
  onSaved: () => void;
  onBack: () => void;
}

/** The Figma first-time setup screen: what LoadWise does, and the health-data consent box. */
function ConsentStep({ api, title, onSaved, onBack }: ConsentStepProps) {
  const { colors } = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.giveHealthConsent();
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          {title}
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

      {error ? <InlineMessage kind="error" text={error} /> : null}

      <Button label="Continue" disabled={!agreed} loading={saving} onPress={save} />
      <Button label="Back" variant="secondary" disabled={saving} onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  uses: { gap: 10 },
  use: { borderRadius: 12, padding: 14, gap: 4, minHeight: 48 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pointText: { flex: 1, gap: 4 },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkbox: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  consentText: { flex: 1 },
});
