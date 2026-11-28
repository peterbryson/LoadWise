import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListGroup, ListRow } from '@/components/ListRow';
import { MySquads } from '@/components/MySquads';
import { OptionRow } from '@/components/Option';
import { Screen } from '@/components/Screen';
import { CreateSquadForm, JoinSquadForm } from '@/components/SquadForms';
import { apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useConsent } from '@/lib/consent';
import { ThemePreference, useTheme } from '@/theme/theme';

const themes = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/**
 * Account and settings. Squads the user plays in (with their sharing switches) and joining a squad
 * stay here; squads they support as staff are on the Squad tab (#48 AC3). A staff-only user is
 * offered to log their own training instead, which asks for health-data consent first (#48 AC5).
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, getIdToken } = useAuth();
  const { status, hasStaffSquad, markStaffSquad } = useConsent();
  const logsOwnTraining = status === 'given';
  const { colors, preference, setPreference } = useTheme();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [squadsVersion, setSquadsVersion] = useState(0);

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
        <ListRow label="Connected devices" />
        <ListRow label="Reminders" />
      </ListGroup>

      {logsOwnTraining ? (
        <>
          <MySquads
            api={api}
            only="athlete"
            refreshKey={squadsVersion}
            onOpenMembers={(squad) =>
              router.push({
                pathname: '/squad-members',
                params: { squadId: squad.squadId, squadName: squad.squadName },
              })
            }
            onOpenOverview={(squad) =>
              router.push({
                pathname: '/squad-overview',
                params: { squadId: squad.squadId, squadName: squad.squadName },
              })
            }
          />
          <JoinSquadForm api={api} onJoined={() => setSquadsVersion((n) => n + 1)} />
          {hasStaffSquad ? null : (
            <CreateSquadForm api={api} heading="Support a squad as staff" onCreated={markStaffSquad} />
          )}
        </>
      ) : (
        <Card gap={10}>
          <AppText variant="heading" accessibilityRole="header">
            Log your own training
          </AppText>
          <AppText variant="caption" color="textMuted">
            You use LoadWise as staff only, so LoadWise holds no health data about you. To log your
            own sessions and wellness, or join a squad as an athlete, agree to health-data processing
            first.
          </AppText>
          <Button
            label="Start logging my training"
            variant="secondary"
            onPress={() => router.push({ pathname: '/setup', params: { start: 'consent' } })}
          />
        </Card>
      )}

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

const styles = StyleSheet.create({
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
});
