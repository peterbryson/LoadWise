import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { NavHeader, Screen } from '@/components/Screen';
import { ApiError, apiBaseUrl, createApiClient, SquadInvite } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme/theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; invite: SquadInvite };

type Feedback = { kind: 'info' | 'error'; text: string } | null;

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * #49: a squad's invite code for its staff, to copy, share or (coach only) replace. Opened from
 * My squads. Not in the Figma V1 screens; it reuses the design's cards, buttons and header.
 */
export default function SquadInviteScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const { squadId, squadName } = useLocalSearchParams<{ squadId: string; squadName?: string }>();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .squadInvite(squadId)
      .then((invite) => {
        if (!cancelled) setState({ kind: 'loaded', invite });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: errorText(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, squadId, attempt]);

  function retry() {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  async function copy(code: string) {
    // setStringAsync resolves false, rather than throwing, when the browser refuses clipboard access.
    const copied = await Clipboard.setStringAsync(code).catch(() => false);
    setFeedback(
      copied
        ? { kind: 'info', text: 'Invite code copied.' }
        : { kind: 'error', text: "Couldn't copy the code. Read it out or write it down instead." },
    );
  }

  async function share(invite: SquadInvite) {
    setFeedback(null);
    try {
      await Share.share({
        message: `Join ${invite.squadName} on LoadWise with the invite code ${invite.inviteCode}`,
      });
    } catch {
      // react-native-web rejects when the browser has no Web Share API (most desktop browsers).
      setFeedback({ kind: 'error', text: "Sharing isn't available here. Copy the code instead." });
    }
  }

  async function replace() {
    setReplacing(true);
    setFeedback(null);
    try {
      const invite = await api.replaceInviteCode(squadId);
      setState({ kind: 'loaded', invite });
      setFeedback({ kind: 'info', text: 'New invite code ready. The old code no longer works.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: errorText(error) });
    } finally {
      setReplacing(false);
      setConfirmingReplace(false);
    }
  }

  return (
    <Screen>
      <NavHeader title={squadName ?? 'Invite athletes'} icon="back" onPress={() => router.back()} />

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading the invite code" />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' ? (
        <>
          <Card gap={10}>
            <AppText variant="heading" accessibilityRole="header">
              Invite athletes
            </AppText>
            {/* Spelled out so a screen reader reads each character, not a made-up word. */}
            <View
              accessible
              accessibilityLabel={`Invite code ${state.invite.inviteCode.split('').join(' ')}`}
              style={[styles.codeBox, { backgroundColor: colors.surfaceRaised, borderColor: colors.input }]}
            >
              <AppText variant="display" style={styles.code} selectable>
                {state.invite.inviteCode}
              </AppText>
            </View>
            <AppText variant="caption" color="textMuted">
              Athletes enter this code in LoadWise to join the squad. People who join with it only ever
              join as athletes, never as staff. Each athlete then chooses whether to share their data.
            </AppText>
            <View style={styles.pair}>
              <View style={styles.flex}>
                <Button label="Copy code" icon="copy" onPress={() => void copy(state.invite.inviteCode)} />
              </View>
              <View style={styles.flex}>
                <Button label="Share code" variant="outline" icon="share" onPress={() => void share(state.invite)} />
              </View>
            </View>
            {feedback ? (
              <View accessibilityLiveRegion="polite">
                <InlineMessage kind={feedback.kind} text={feedback.text} />
              </View>
            ) : null}
          </Card>

          <Card gap={8}>
            <AppText variant="heading" accessibilityRole="header">
              Replace the code
            </AppText>
            {state.invite.canReplace ? (
              <>
                <AppText variant="caption" color="textMuted">
                  If the code has been shared too widely, replace it with a new one.
                </AppText>
                {confirmingReplace ? (
                  <View style={styles.confirm} accessibilityLiveRegion="polite">
                    <AppText variant="label">
                      Replace the invite code? The old code stops working straight away. Members
                      already in the squad stay in it.
                    </AppText>
                    <Button
                      label="Replace with a new code"
                      variant="danger"
                      loading={replacing}
                      onPress={() => void replace()}
                    />
                    <Button
                      label="Keep current code"
                      variant="secondary"
                      disabled={replacing}
                      onPress={() => setConfirmingReplace(false)}
                    />
                  </View>
                ) : (
                  <Button
                    label="Replace code"
                    variant="secondary"
                    accessibilityHint="Asks you to confirm before the old code stops working"
                    onPress={() => setConfirmingReplace(true)}
                  />
                )}
              </>
            ) : (
              <AppText variant="caption" color="textMuted">
                Only a coach in this squad can replace the code.
              </AppText>
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { letterSpacing: 6, textAlign: 'center', fontVariant: ['tabular-nums'] },
  codeBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 18 },
  pair: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  confirm: { gap: 8 },
});
