import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabRoute } from '@/lib/entry';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export type { TabRoute };

const tabs: { route: TabRoute; label: string; icon: 'today' | 'trends' | 'squad' | 'profile' }[] = [
  { route: 'index', label: 'Today', icon: 'today' },
  { route: 'trends', label: 'Trends', icon: 'trends' },
  { route: 'squad', label: 'Squad', icon: 'squad' },
  { route: 'profile', label: 'Profile', icon: 'profile' },
];

interface TabBarProps {
  active: TabRoute;
  /** #48: the tabs this user may open (`tabsFor` in `lib/entry.ts`), in tab-bar order. */
  visible: TabRoute[];
  onSelect: (route: TabRoute) => void;
}

/**
 * The Figma "Tab Bar": the tabs in a pill, with the AI assistant button beside it. The Figma
 * design has three tabs; #48 adds a Squad tab for staff, which is not in Figma V1. The assistant
 * is a later story (#12, #13, #15), so the button is shown but disabled.
 */
export function TabBar({ active, visible, onSelect }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={[styles.tabs, { backgroundColor: colors.surfaceRaised }]} accessibilityRole="tablist">
          {tabs.filter((tab) => visible.includes(tab.route)).map((tab) => {
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
