import { Redirect, Tabs } from 'expo-router';
import { TabBar, TabRoute } from '@/components/TabBar';
import { useAuth } from '@/lib/auth';

/** The three signed-in tabs. Anyone not signed in is sent to the sign-in screen. */
export default function TabsLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/sign-in" />;

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
