import { sessionLoad } from '@loadwise/analytics';
import { SessionLogSchema, SessionType } from '@loadwise/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { OptionRow } from '@/components/Option';
import { PreviewBanner } from '@/components/PreviewBanner';
import { NavHeader, Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/theme';

const types = [
  { value: 'training', label: 'Training' },
  { value: 'match', label: 'Match' },
  { value: 'gym', label: 'Gym' },
  { value: 'other', label: 'Other' },
] as const;

const durations = [
  { value: '30', label: '30' },
  { value: '45', label: '45' },
  { value: '60', label: '60' },
  { value: '75', label: '75' },
  { value: '90', label: '90' },
  { value: 'other', label: 'Other', accessibilityLabel: 'Other duration' },
] as const;

const rpeRows = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
].map((row) => row.map((value) => ({ value, label: String(value) })));

// Verbal anchors of the CR-10 session-RPE scale (Foster et al., 2001). Points without an
// anchor on that scale show the number only.
const rpeAnchors: Partial<Record<number, string>> = {
  1: 'Very, very easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Somewhat hard',
  5: 'Hard',
  7: 'Very hard',
  10: 'Maximal',
};

/** #4 log a session. Validates with the shared schema; saving arrives with #4. */
export default function LogSessionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [type, setType] = useState<SessionType>('training');
  const [duration, setDuration] = useState<string | undefined>();
  const [otherMinutes, setOtherMinutes] = useState('');
  const [rpe, setRpe] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const minutes = duration === 'other' ? Number(otherMinutes) : Number(duration);
  const parsed = SessionLogSchema.safeParse({
    type,
    date: new Date().toISOString().slice(0, 10),
    durationMinutes: minutes,
    rpe,
  });
  const load = parsed.success ? sessionLoad(parsed.data.rpe, parsed.data.durationMinutes) : null;

  function save() {
    setChecked(parsed.success);
    if (parsed.success) return setError(null);
    if (rpe === undefined) return setError('Choose an RPE from 1 to 10.');
    setError('Choose a duration from 1 to 600 minutes.');
  }

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setChecked(false);
      setError(null);
    };
  }

  return (
    <Screen>
      <NavHeader title="Log a session" icon="close" onPress={() => router.back()} />
      <PreviewBanner note="sessions are not saved yet. Saving arrives with #4." />

      <View style={styles.group}>
        <AppText variant="heading">Type</AppText>
        <OptionRow options={types} selected={type} onSelect={change(setType)} accessibilityLabel="Session type" />
      </View>

      {/* The date picker comes with #4; sessions are dated today until then. */}
      <View
        style={[styles.date, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.cardBorderWidth }]}
        accessible
        accessibilityLabel="Date: today"
      >
        <AppText variant="label" color="textMuted">
          Date
        </AppText>
        <View style={styles.dateValue}>
          <AppText variant="label">Today</AppText>
          <Icon name="chevron-date" size={18} />
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="heading">Duration (minutes)</AppText>
        <OptionRow
          options={durations}
          selected={duration}
          onSelect={change(setDuration)}
          accessibilityLabel="Duration in minutes"
        />
        {duration === 'other' ? (
          <TextField
            label="Minutes"
            value={otherMinutes}
            onChangeText={change(setOtherMinutes)}
            keyboardType="number-pad"
            placeholder="e.g. 50"
          />
        ) : null}
      </View>

      <View style={styles.group}>
        <AppText variant="heading">How hard was it? (RPE)</AppText>
        {rpeRows.map((row, index) => (
          <OptionRow
            key={index}
            options={row}
            selected={rpe}
            onSelect={change(setRpe)}
            accessibilityLabel={index === 0 ? 'RPE 1 to 5' : 'RPE 6 to 10'}
          />
        ))}
        {error ? (
          <InlineMessage kind="error" text={error} iconSize={16} />
        ) : rpe !== undefined ? (
          <AppText variant="caption" color="textMuted">
            {rpeAnchors[rpe] ? `${rpe}: ${rpeAnchors[rpe]}` : String(rpe)}
          </AppText>
        ) : null}
      </View>

      {load !== null && parsed.success ? (
        <Card gap={2} style={styles.loadCard}>
          <View style={styles.loadRow}>
            <AppText variant="label" color="textMuted">
              Session load
            </AppText>
            <AppText variant="heading">{load} AU</AppText>
          </View>
          <AppText variant="caption" color="textMuted">
            RPE {parsed.data.rpe} × {parsed.data.durationMinutes} min
          </AppText>
        </Card>
      ) : null}

      {checked ? <InlineMessage kind="info" text="Preview: this session is valid but was not saved." /> : null}
      <Button label="Save session" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  date: {
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  loadCard: { paddingVertical: 12 },
  loadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
