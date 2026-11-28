import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabRoute } from '@/lib/entry';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

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
 * The floating tab bar (#52 restyle). The selected tab is shown three ways (accent colour, a
 * tinted pill behind the icon and a heavier stroke) so it never depends on colour alone. The AI
 * assistant is a later story (#12, #13, #15), so its button is shown but disabled.
 */
export function TabBar({ active, visible, onSelect }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <View
          style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="tablist"
        >
          {tabs.filter((tab) => visible.includes(tab.route)).map((tab) => {
            const selected = tab.route === active;
            return (
              <Pressable
                key={tab.route}
                onPress={() => onSelect(tab.route)}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                style={styles.tab}
              >
                <View style={[styles.pill, selected && { backgroundColor: colors.accentTint }]}>
                  <Icon
                    name={tab.icon}
                    size={22}
                    color={selected ? 'accent' : 'textMuted'}
                    strokeWidth={selected ? 2.4 : 1.9}
                  />
                </View>
                <AppText variant="overline" color={selected ? 'accent' : 'textMuted'} style={styles.label}>
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
          style={[styles.ai, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon name="ai" size={22} color="textMuted" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: { flexDirection: 'row', gap: 10, height: 64, width: '100%', maxWidth: 398 },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pill: { width: 48, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  label: { textTransform: 'none', letterSpacing: 0.2 },
  ai: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
