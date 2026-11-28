import { Redirect, Tabs, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TabBar, TabRoute } from '@/components/TabBar';
import { useAuth } from '@/lib/auth';
import { useConsent } from '@/lib/consent';
import { entryModeFor, tabRedirect, tabsFor } from '@/lib/entry';
import { useTheme } from '@/theme/theme';

/**
 * The signed-in tabs (#48). Anyone not signed in is sent to sign-in. Which tabs a user sees comes
 * from their entry mode (`lib/entry.ts`):
 * - no health-data consent and no staff squad: first-time setup (#1 AC4, I-7);
 * - staff only: Squad and Profile, landing on Squad; Today and Trends redirect there, so no
 *   health screen is reachable without consent (#48 AC2);
 * - athlete: Today, Trends and Profile; both: all four, landing on Today (#48 AC4).
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const consent = useConsent();
  const pathname = usePathname();
  if (!user) return <Redirect href="/sign-in" />;
  if (consent.status === 'loading') return <Checking />;
  if (consent.status === 'error') return <CheckFailed onRetry={consent.retry} />;

  const mode = entryModeFor({
    healthConsentGiven: consent.status === 'given',
    hasStaffSquad: consent.hasStaffSquad,
  });
  if (mode === 'setup') return <Redirect href="/setup" />;
  const redirect = tabRedirect(mode, pathname);
  if (redirect) return <Redirect href={redirect} />;
  const visible = tabsFor(mode);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigateToTab }) => (
        <TabBar
          active={state.routes[state.index].name as TabRoute}
          visible={visible}
          onSelect={(name) => {
            const route = state.routes.find((candidate) => candidate.name === name);
            if (route) navigateToTab(route.key);
          }}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="trends" options={{ title: 'Trends' }} />
      <Tabs.Screen name="squad" options={{ title: 'Squad' }} />
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
