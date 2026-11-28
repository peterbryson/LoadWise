import { CreateTeamSessionSchema, SessionType } from '@loadwise/shared';
import type { CreatedTeamSession } from '@loadwise/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { OptionRow } from '@/components/Option';
import { NavHeader, Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { localIsoDate } from '@/lib/dates';

const types = [
  { value: 'TRAINING', label: 'Training' },
  { value: 'MATCH', label: 'Match' },
  { value: 'GYM', label: 'Gym' },
  { value: 'OTHER', label: 'Other' },
] as const;

const durations = [
  { value: '30', label: '30' },
  { value: '45', label: '45' },
  { value: '60', label: '60' },
  { value: '75', label: '75' },
  { value: '90', label: '90' },
  { value: 'other', label: 'Other', accessibilityLabel: 'Other duration' },
] as const;

// Today or yesterday covers logging after training or the next morning. The API accepts up to
// 6 days back (TEAM_SESSION_RATING_DAYS), so this can grow without an API change.
const days = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
] as const;

type Day = (typeof days)[number]['value'];

function dateFor(day: Day, now: Date): string {
  const date = new Date(now);
  if (day === 'yesterday') date.setDate(date.getDate() - 1);
  return localIsoDate(date);
}

/**
 * #17 AC1: a coach or S&C coach logs a team session once for the whole squad. Opened from the
 * squad's card in My squads. Every athlete in the squad is then asked for their RPE on Today (AC2).
 * Not in the Figma V1 screens; it reuses the session form's layout. Online only: if it cannot be
 * saved, the coach is told and can try again, and nothing is half-saved.
 */
export default function LogTeamSessionScreen() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const { squadId, squadName } = useLocalSearchParams<{ squadId: string; squadName?: string }>();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [type, setType] = useState<SessionType>('TRAINING');
  const [day, setDay] = useState<Day>('today');
  const [duration, setDuration] = useState<string | undefined>();
  const [otherMinutes, setOtherMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedTeamSession | null>(null);

  const minutes = duration === 'other' ? Number(otherMinutes) : Number(duration);

  async function save() {
    const parsed = CreateTeamSessionSchema.safeParse({ type, date: dateFor(day, new Date()), durationMinutes: minutes });
    if (!parsed.success) return setError('Choose a duration from 1 to 600 minutes.');
    setError(null);
    setSaving(true);
    try {
      setCreated(await api.createTeamSession(squadId, parsed.data));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setError(null);
    };
  }

  const name = squadName ?? 'your squad';

  if (created) {
    return (
      <Screen>
        <NavHeader title="Team session logged" icon="close" onPress={() => router.back()} />
        <Card tone="accent" gap={6}>
          <View accessibilityLiveRegion="polite">
            <AppText variant="heading">{`Logged for ${name}`}</AppText>
          </View>
          <AppText variant="body">
            {created.athletesAsked === 1
              ? '1 athlete is asked to add their RPE on their Today screen.'
              : `${created.athletesAsked} athletes are asked to add their RPE on their Today screen.`}
          </AppText>
          <AppText variant="caption" color="textMuted">
            Their load is calculated from their own RPE and appears only where they share data with the squad.
          </AppText>
        </Card>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <NavHeader title="Log team session" icon="close" onPress={() => router.back()} />
      <AppText variant="caption" color="textMuted">
        {`Log it once for ${name}. Each athlete then adds their own RPE.`}
      </AppText>

      <View style={styles.group}>
        <AppText variant="heading">Type</AppText>
        <OptionRow options={types} selected={type} onSelect={change(setType)} accessibilityLabel="Session type" />
      </View>

      <View style={styles.group}>
        <AppText variant="heading">Date</AppText>
        <OptionRow options={days} selected={day} onSelect={change(setDay)} accessibilityLabel="Date" />
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

      {error ? <InlineMessage kind="error" text={error} /> : null}

      <Button label="Log for the squad" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
});
