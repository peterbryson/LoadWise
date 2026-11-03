import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** Room for the floating tab bar (68 px plus its gap) so the last card is never hidden. */
export const TAB_BAR_SPACE = 96;

interface ScreenProps {
  children: ReactNode;
  withTabBar?: boolean;
}

/** Scrolling page with the design's 20 px sides, 14 px gaps and a phone-width column on web. */
export function Screen({ children, withTabBar = false }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 20) + 36, paddingBottom: insets.bottom + 20 + (withTabBar ? TAB_BAR_SPACE : 0) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Caption above a Display title, as on Today and Trends. */
export function ScreenHeader({ caption, title }: { caption: string; title: string }) {
  return (
    <View style={styles.header}>
      <AppText variant="caption" color="textMuted">
        {caption}
      </AppText>
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  );
}

interface NavHeaderProps {
  title: string;
  icon: 'close' | 'back';
  onPress: () => void;
}

/** Close or back button beside a Title, as on the logging and flag screens. */
export function NavHeader({ title, icon, onPress }: NavHeaderProps) {
  return (
    <View style={styles.nav}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={icon === 'close' ? 'Close' : 'Back'}
        hitSlop={12}
      >
        <Icon name={icon} size={24} />
      </Pressable>
      <AppText variant="title" accessibilityRole="header">
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
  header: { gap: 2 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', alignSelf: 'stretch' },
  progress: { height: 8, borderRadius: 4 },
});
