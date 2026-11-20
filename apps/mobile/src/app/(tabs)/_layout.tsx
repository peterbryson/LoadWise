import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TabBar, TabRoute } from '@/components/TabBar';
import { useAuth } from '@/lib/auth';
import { useConsent } from '@/lib/consent';
import { useTheme } from '@/theme/theme';

/**
 * The three signed-in tabs. Anyone not signed in is sent to sign-in, and anyone without recorded
 * health-data consent is sent to first-time setup (#1 AC4, I-7), so no health screen is reachable
 * before consent.
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const consent = useConsent();
  if (!user) return <Redirect href="/sign-in" />;
  if (consent.status === 'needed') return <Redirect href="/setup" />;
  if (consent.status === 'loading') return <Checking />;
  if (consent.status === 'error') return <CheckFailed onRetry={consent.retry} />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigateToTab }) => (
        <TabBar
          active={state.routes[state.index].name as TabRoute}
          onSelect={(name) => {
            const route = state.routes.find((candidate) => candidate.name === name);
            if (route) navigateToTab(route.key);
          }}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="trends" options={{ title: 'Trends' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

function Checking() {
  const { colors } = useTheme();
  return (
    <View style={[styles.centre, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
    </View>
  );
}

function CheckFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Could not load your account
      </AppText>
      <AppText variant="body" color="textMuted">
        LoadWise could not check your account details. Check your connection and try again.
      </AppText>
      <Button label="Try again" onPress={onRetry} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
