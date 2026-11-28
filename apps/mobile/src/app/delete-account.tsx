import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { NavHeader, Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { deleteAccountAndData } from '@/lib/account-deletion';
import { ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';

const deleted = [
  'Your sessions, check-ins, load figures and flags',
  'Injuries and restrictions recorded for you',
  'Your squad memberships and sharing choices, and their history',
  'Your consent record, your name and your email address',
  'Anything on this phone still waiting to sync',
];

/**
 * #14: delete the account and all its data (UK GDPR Art. 17). The password is asked for again,
 * both so this cannot happen by accident and because Firebase needs a recent sign-in to delete one.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, getIdToken, confirmPassword, deleteSignIn, signOut } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signInKept, setSignInKept] = useState(false);

  async function confirm() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteAccountAndData(user.uid, {
        confirmPassword: () => confirmPassword(password),
        deleteAccount: api.deleteAccount,
        removeItem: (key) => AsyncStorage.removeItem(key),
        deleteSignIn,
      });
      if (result === 'deleted') router.replace('/sign-in');
      else setSignInKept(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await signOut();
    router.replace('/sign-in');
  }

  if (signInKept) {
    return (
      <Screen>
        <AppText variant="display" accessibilityRole="header">
          Account deleted
        </AppText>
        <View accessibilityLiveRegion="polite">
          <InlineMessage
            kind="warning"
            boxed
            text="All your LoadWise data has been deleted. Your email sign-in could not be removed just now. Signing in with it again would start a new, empty account."
          />
        </View>
        <Button label="Sign out" onPress={() => void finish()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <NavHeader title="Delete account" icon="back" onPress={() => router.back()} />

      <Card tone="danger" gap={10}>
        <View style={styles.title}>
          <Icon name="alert-danger-18" size={20} />
          <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
            This deletes everything, for good
          </AppText>
        </View>
        {deleted.map((line) => (
          <AppText key={line} variant="body">
            {`• ${line}`}
          </AppText>
        ))}
        <AppText variant="caption" color="textMuted">
          Staff in your squads stop seeing your data straight away. It cannot be undone.
        </AppText>
      </Card>

      <TextField
        label="Password"
        hint="Enter your password to confirm"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        editable={!busy}
      />

      {error ? <InlineMessage kind="error" text={error} /> : null}

      <Button
        label="Delete account and data"
        variant="danger"
        disabled={password.length === 0}
        loading={busy}
        onPress={() => void confirm()}
      />
      <Button label="Keep my account" variant="secondary" disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
