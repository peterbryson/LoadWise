import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { InlineMessage } from '@/components/InlineMessage';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';

type Action = 'sign-in' | 'create' | 'reset';

/** #1: email and password sign-in through Firebase, as in the Figma "Sign in" screens. */
export default function SignInScreen() {
  const { user, configured, signIn, createAccount, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  // A new account goes to first-time setup instead; that redirect happens in submit().
  if (user && !created) return <Redirect href="/" />;

  async function submit(action: Action) {
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setError('Enter your email address.');
    if (action !== 'reset' && !password) return setError('Enter your password.');

    setPending(action);
    try {
      if (action === 'sign-in') {
        await signIn(trimmedEmail, password);
      } else if (action === 'create') {
        setCreated(true);
        await createAccount(trimmedEmail, password);
        router.replace('/setup');
      } else {
        await resetPassword(trimmedEmail);
        setNotice('If an account exists for this email, a reset link is on its way.');
      }
    } catch (caught) {
      setCreated(false);
      setError(authErrorMessage(caught));
    } finally {
      setPending(null);
    }
  }

  return (
    <Screen>
      <View style={styles.brand}>
        <AppText variant="display" color="accent" accessibilityRole="header">
          LoadWise
        </AppText>
        <AppText variant="body" color="textMuted">
          Know your load. Train with confidence.
        </AppText>
      </View>

      {!configured ? (
        <InlineMessage
          kind="error"
          text="Sign-in is not configured. Copy apps/mobile/.env.example to apps/mobile/.env and add the Firebase settings."
        />
      ) : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={() => submit('sign-in')}
      />

      {error ? <InlineMessage kind="error" text={error} /> : null}
      {notice ? <InlineMessage kind="info" text={notice} /> : null}

      <Button
        label="Sign in"
        onPress={() => submit('sign-in')}
        loading={pending === 'sign-in'}
        disabled={!configured || pending !== null}
      />
      <Button
        label="Create an account"
        variant="secondary"
        onPress={() => submit('create')}
        loading={pending === 'create'}
        disabled={!configured || pending !== null}
      />
      <Pressable
        onPress={() => submit('reset')}
        disabled={!configured || pending !== null}
        accessibilityRole="button"
        hitSlop={12}
      >
        <AppText variant="label" color="accent">
          Forgot password?
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { gap: 4, paddingTop: 48, paddingBottom: 24 },
});
