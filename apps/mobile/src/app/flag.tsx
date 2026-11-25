import type { Flag } from '@loadwise/analytics';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckLines, NoFlagsStatus } from '@/components/FlagChecks';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { NavHeader, Screen } from '@/components/Screen';
import type { ApiClient } from '@/lib/api';
import { flagMeaning, flagNumbers, flagTitle } from '@/lib/flag-format';
import { useApiRequest } from '@/lib/use-api-request';
import { useTheme } from '@/theme/theme';

const loadFlags = (api: ApiClient) => api.myFlags();

/**
 * "Why this was flagged": today's flags from the deterministic engine (#9), each with its reason,
 * value and threshold. The explanation behind a flag in the assistant is #12. The wording never
 * tells the athlete to change load, rest or return to play (DL-006).
 */
export default function FlagScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { state, retry } = useApiRequest(loadFlags);

  return (
    <Screen>
      <NavHeader title="Why this was flagged" icon="back" onPress={() => router.back()} />

      {state.kind === 'loading' ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading flags" /> : null}
      {state.kind === 'offline' ? (
        <InlineMessage kind="info" text="You are offline. Flags load when you are back online." />
      ) : null}
      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' && state.data.flags.length === 0 ? (
        <Card gap={6}>
          <NoFlagsStatus data={state.data} />
        </Card>
      ) : null}

      {state.kind === 'loaded' ? state.data.flags.map((flag) => <FlagDetail key={`${flag.rule}-${flag.metric}`} flag={flag} />) : null}

      {state.kind === 'loaded' && state.data.flags.length > 0 ? (
        <Card gap={6}>
          <AppText variant="caption" color="textMuted">
            What was checked today
          </AppText>
          <CheckLines data={state.data} />
        </Card>
      ) : null}

      {state.kind === 'loaded' && state.data.flags.length > 0 ? (
        <Card gap={6}>
          <AppText variant="heading">What you can do</AppText>
          <AppText variant="body" color="textMuted">
            Talk through your next few sessions with your coach.
          </AppText>
        </Card>
      ) : null}

      <InlineMessage
        kind="info"
        text="This is training guidance, not a medical assessment. For pain or injury, speak to a physio or GP."
      />
      <Button label="Got it" onPress={() => router.back()} />
    </Screen>
  );
}

function FlagDetail({ flag }: { flag: Flag }) {
  return (
    <>
      <Card tone="warning">
        <View style={styles.title}>
          <Icon name="alert-warning-24" size={24} />
          <AppText variant="heading" style={styles.flex}>
            {flagTitle(flag)}
          </AppText>
        </View>
        <AppText variant="caption">{flag.reason}</AppText>
      </Card>

      <Card gap={10}>
        <AppText variant="caption" color="textMuted">
          The numbers
        </AppText>
        {flagNumbers(flag).map((row) => (
          <View key={row.label} style={styles.row} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
            <AppText variant="body">{row.label}</AppText>
            <AppText variant="heading">{row.value}</AppText>
          </View>
        ))}
        <AppText variant="caption" color="textMuted">
          The guide is a starting point being tested, not a medical limit.
        </AppText>
      </Card>

      <Card gap={6}>
        <AppText variant="heading">What it means</AppText>
        <AppText variant="body" color="textMuted">
          {flagMeaning(flag)}
        </AppText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
});
