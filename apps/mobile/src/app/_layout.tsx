import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ConsentProvider } from '@/lib/consent';
import { OfflineSyncProvider } from '@/lib/offline-sync';
import { ThemeProvider, useTheme } from '@/theme/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ConsentProvider>
            <OfflineSyncProvider>{fontsLoaded ? <Navigator /> : <Loading />}</OfflineSyncProvider>
          </ConsentProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const { name, colors } = useTheme();
  const { loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="wellness" options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-session" options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-team-session" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sessions" />
        <Stack.Screen name="squad-members" />
        <Stack.Screen name="squad-athlete-load" />
        <Stack.Screen name="squad-overview" />
        <Stack.Screen name="flag" />
      </Stack>
    </>
  );
}

function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
    </View>
  );
}
