import { CreateSquadSchema, JoinSquadSchema, StaffRole } from '@loadwise/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { ListGroup, ListRow } from '@/components/ListRow';
import { OptionRow } from '@/components/Option';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ThemePreference, useTheme } from '@/theme/theme';

const roles = [
  { value: 'COACH', label: 'Coach' },
  { value: 'PHYSIO', label: 'Physio' },
  { value: 'SC_COACH', label: 'S&C', accessibilityLabel: 'S and C coach' },
] as const;

const themes = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

type Result = { kind: 'error' | 'info'; text: string } | null;

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

export default function ProfileScreen() {
  const { user, signOut, getIdToken } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const router = useRouter();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);

  const email = user?.email ?? '';
  const name = user?.displayName || email.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <Screen withTabBar>
      <View style={styles.person}>
        <View style={[styles.avatar, { backgroundColor: colors.accentTint }]}>
          <AppText variant="heading" color="accent">
            {initials}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header">
            {name}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {email}
          </AppText>
        </View>
      </View>

      <ListGroup title="Account">
        <ListRow label="Account details" />
        <ListRow label="Privacy and data" />
        <ListRow label="About LoadWise" />
      </ListGroup>

      <ListGroup title="Coming later">
        <ListRow label="My squads" />
        <ListRow label="Connected devices" />
        <ListRow label="Reminders" />
      </ListGroup>

      <SquadTools api={api} />

      <Card gap={10}>
        <AppText variant="heading">Preview tools</AppText>
        <AppText variant="caption" color="textMuted">
          For viewing the design on localhost. Not part of the Figma V1 screens.
        </AppText>
        <OptionRow
          options={themes}
          selected={preference}
          onSelect={(value) => setPreference(value as ThemePreference)}
          accessibilityLabel="Theme"
        />
        <Button label="Show first-time setup" variant="secondary" onPress={() => router.push('/setup')} />
      </Card>

      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Button
        label="Delete account and data"
        variant="danger"
        disabled
        accessibilityHint="Arrives with story 14"
      />
    </Screen>
  );
}

/**
 * Not in the Figma V1 design: a plain section that calls the real squad endpoints (#2), so the
 * API can be seen working from the app. Inputs are checked with the same Zod schemas as the API.
 */
function SquadTools({ api }: { api: ReturnType<typeof createApiClient> }) {
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  const [squadName, setSquadName] = useState('');
  const [role, setRole] = useState<StaffRole>('COACH');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    api
      .health()
      .then(() => setApiUp(true))
      .catch(() => setApiUp(false));
  }, [api]);

  async function create() {
    const parsed = CreateSquadSchema.safeParse({ name: squadName, role });
    if (!parsed.success) {
      return setResult({ kind: 'error', text: 'Squad names are 2 to 60 characters.' });
    }
    setBusy('create');
    try {
      const squad = await api.createSquad(parsed.data);
      setResult({ kind: 'info', text: `Created "${squad.name}". Invite code: ${squad.inviteCode}` });
      setSquadName('');
    } catch (error) {
      setResult({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    const parsed = JoinSquadSchema.safeParse({ inviteCode: code });
    if (!parsed.success) {
      return setResult({ kind: 'error', text: 'Invite codes are 8 letters and numbers.' });
    }
    setBusy('join');
    try {
      const joined = await api.joinSquad(parsed.data.inviteCode);
      setResult({ kind: 'info', text: `Joined "${joined.squadName}" as an athlete.` });
      setCode('');
    } catch (error) {
      setResult({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card gap={10}>
      <AppText variant="heading">Squads</AppText>
      <AppText variant="caption" color="textMuted">
        {apiUp === null
          ? 'Checking the LoadWise API…'
          : apiUp
            ? 'Connected to the LoadWise API. These actions are real.'
            : `Can't reach the LoadWise API at ${apiBaseUrl}. Start it with pnpm dev.`}
      </AppText>

      <TextField label="New squad name" value={squadName} onChangeText={setSquadName} placeholder="e.g. Belfast Harriers U20" />
      <OptionRow
        options={roles}
        selected={role}
        onSelect={(value) => setRole(value as StaffRole)}
        accessibilityLabel="Your role in the squad"
      />
      <Button label="Create squad" onPress={create} loading={busy === 'create'} disabled={busy !== null} />

      <TextField
        label="Invite code"
        value={code}
        onChangeText={setCode}
        placeholder="ABCD2345"
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Button label="Join squad" variant="secondary" onPress={join} loading={busy === 'join'} disabled={busy !== null} />

      {result ? <InlineMessage kind={result.kind} text={result.text} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
});
