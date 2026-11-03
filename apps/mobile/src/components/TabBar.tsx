import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export type TabRoute = 'index' | 'trends' | 'profile';

const tabs: { route: TabRoute; label: string; icon: 'today' | 'trends' | 'profile' }[] = [
  { route: 'index', label: 'Today', icon: 'today' },
  { route: 'trends', label: 'Trends', icon: 'trends' },
  { route: 'profile', label: 'Profile', icon: 'profile' },
];

interface TabBarProps {
  active: TabRoute;
  onSelect: (route: TabRoute) => void;
}

/**
 * The Figma "Tab Bar": three tabs in a pill, with the AI assistant button beside it. The
 * assistant is a later story (#12, #13, #15), so the button is shown but disabled.
 */
export function TabBar({ active, onSelect }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceRaised }]} accessibilityRole="tablist">
          {tabs.map((tab) => {
            const selected = tab.route === active;
            const icon = `${tab.icon}-${selected ? 'active' : 'inactive'}` as IconName;
            return (
              <Pressable
                key={tab.route}
                onPress={() => onSelect(tab.route)}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                style={styles.tab}
              >
                <Icon name={icon} size={24} />
                <AppText variant="caption" color={selected ? 'accent' : 'textMuted'}>
                  {tab.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityLabel="AI assistant"
          accessibilityHint="Coming in a later version"
          accessibilityState={{ disabled: true }}
          style={[styles.ai, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}
        >
          <Icon name="ai" size={26} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: { flexDirection: 'row', gap: 10, height: 68, width: '100%', maxWidth: 398 },
  tabs: { flex: 1, flexDirection: 'row', borderRadius: 34, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  ai: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
