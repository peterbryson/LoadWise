import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';

/** Up to two initials from a display name: "Aoife Byrne" gives "AB", "aoife" gives "A". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * A round initials avatar (#52). Decorative: the name is always shown or read next to it, so
 * screen readers skip it. No photos, which keeps personal data out of the app.
 */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <AppText variant="label" color="textMuted" style={{ fontSize: size * 0.36, lineHeight: size * 0.46 }}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
