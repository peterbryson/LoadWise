import { ReactElement, ReactNode } from 'react';
import { Pressable, RefreshControlProps, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** Room for the floating tab bar (64 px plus its gap) so the last card is never hidden. */
export const TAB_BAR_SPACE = 92;

interface ScreenProps {
  children: ReactNode;
  withTabBar?: boolean;
  /** Optional pull to refresh (#50 AC3). */
  refreshControl?: ReactElement<RefreshControlProps>;
  testID?: string;
}

/** Scrolling page with 20 px sides, 14 px gaps and a phone-width column on web. */
export function Screen({ children, withTabBar = false, refreshControl, testID }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top, 20) + 20,
          paddingBottom: insets.bottom + 24 + (withTabBar ? TAB_BAR_SPACE : 0),
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

interface ScreenHeaderProps {
  caption: string;
  title: string;
  /** Right-hand slot, e.g. an avatar or a small action. */
  trailing?: ReactNode;
}

/** A small uppercase caption above a large title, as on Today and Trends. */
export function ScreenHeader({ caption, title, trailing }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="overline" color="textMuted">
          {caption}
        </AppText>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {trailing}
    </View>
  );
}

interface NavHeaderProps {
  title: string;
  icon: 'close' | 'back';
  onPress: () => void;
}

/** A round close or back button beside a title, as on the logging and flag screens. */
export function NavHeader({ title, icon, onPress }: NavHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.nav}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={icon === 'close' ? 'Close' : 'Back'}
        hitSlop={8}
        style={({ pressed }) => [
          styles.navButton,
          { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : colors.surface },
        ]}
      >
        <Icon name={icon} size={20} />
      </Pressable>
      <AppText variant="title" accessibilityRole="header" style={styles.navTitle}>
        {title}
      </AppText>
    </View>
  );
}

export function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return (
    <View
      style={[styles.track, { backgroundColor: colors.surfaceRaised }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.progress, { width: `${clamped * 100}%`, backgroundColor: colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14, width: '100%', maxWidth: 430, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 4 },
  headerText: { flex: 1, gap: 4 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { flex: 1 },
  track: { height: 6, borderRadius: radius.full, overflow: 'hidden', alignSelf: 'stretch' },
  progress: { height: 6, borderRadius: radius.full },
});
