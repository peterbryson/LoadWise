import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger';

const look = {
  neutral: { fill: 'surfaceRaised', text: 'textMuted', icon: undefined },
  accent: { fill: 'accentTint', text: 'accent', icon: 'check-done' },
  warning: { fill: 'warningTint', text: 'warning', icon: 'alert-warning-24' },
  danger: { fill: 'dangerTint', text: 'danger', icon: 'alert-danger-16' },
} as const;

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Overrides the tone's icon; pass `null` for no icon. */
  icon?: IconName | null;
}

/**
 * A status pill (#52), as in shadcn/ui's Badge. Status tones carry an icon as well as colour, and
 * the label is always words, so the status never depends on colour alone (WCAG 1.4.1).
 */
export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const { colors } = useTheme();
  const { fill, text, icon: toneIcon } = look[tone];
  const glyph = icon === null ? undefined : (icon ?? toneIcon);
  return (
    <View style={[styles.badge, { backgroundColor: colors[fill] }]}>
      {glyph ? <Icon name={glyph} size={13} color={text} strokeWidth={2.4} /> : null}
      <AppText variant="label" color={text} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  text: { fontSize: 12, lineHeight: 16 },
});
