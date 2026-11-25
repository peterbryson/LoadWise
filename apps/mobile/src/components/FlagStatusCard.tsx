import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import type { ApiClient } from '@/lib/api';
import { flagTitle } from '@/lib/flag-format';
import { useApiRequest } from '@/lib/use-api-request';
import { useTheme } from '@/theme/theme';

const loadFlags = (api: ApiClient) => api.myFlags();

/**
 * #9: the status line at the top of Today. Shows each flag from `GET /me/flags` with its reason,
 * or says nothing has been flagged. A failure stays inside the card.
 */
export function FlagStatusCard() {
  const { colors } = useTheme();
  const { state, retry } = useApiRequest(loadFlags);

  if (state.kind === 'loaded' && state.data.flags.length > 0) {
    return (
      <>
        {state.data.flags.map((flag) => (
          <Card key={`${flag.rule}-${flag.metric}`} tone="warning">
            <View style={styles.flagTitle}>
              <Icon name="alert-warning-24" size={24} />
              <AppText variant="heading" style={styles.flex}>
                {flagTitle(flag)}
              </AppText>
            </View>
            <AppText variant="caption">{flag.reason}</AppText>
            <Link href="/flag" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={`See why: ${flagTitle(flag)}`} style={styles.seeWhy}>
                <AppText variant="label" color="warning">
                  See why
                </AppText>
                <Icon name="chevron-warning" size={20} />
              </Pressable>
            </Link>
          </Card>
        ))}
      </>
    );
  }

  return (
    <Card gap={6}>
      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading flags" />
      ) : null}

      {state.kind === 'offline' ? (
        <InlineMessage kind="info" text="You are offline. Flags update when you are back online." />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' ? (
        <>
          <View style={styles.titleRow}>
            <Icon name="check-status" size={24} />
            <AppText variant="heading" style={styles.flex}>
              Nothing has been flagged today
            </AppText>
          </View>
          <AppText variant="caption" color="textMuted">
            Flags appear when your load ratio or a wellness score moves outside your usual range.
          </AppText>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flagTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  seeWhy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  flex: { flex: 1 },
});
