import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Kind = 'error' | 'info' | 'warning' | 'success';

interface InlineMessageProps {
  kind: Kind;
  text: string;
  iconSize?: 16 | 18;
  /** A tinted box (shadcn/ui's Alert) instead of a plain icon and line. */
  boxed?: boolean;
}

const look = {
  error: { icon: 'alert-danger-18', color: 'danger', tint: 'dangerTint' },
  warning: { icon: 'alert-warning-24', color: 'warning', tint: 'warningTint' },
  success: { icon: 'check-done', color: 'accent', tint: 'accentTint' },
  info: { icon: 'info-muted', color: 'textMuted', tint: 'surfaceRaised' },
} as const;

/** An icon and a short line of text: form errors, notices and safety notes. Errors are announced. */
export function InlineMessage({ kind, text, iconSize = 18, boxed = false }: InlineMessageProps) {
  const { colors } = useTheme();
  const { icon, color, tint } = look[kind];
  return (
    <View
      style={[styles.row, boxed && [styles.box, { backgroundColor: colors[tint] }]]}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={kind === 'error' ? 'polite' : undefined}
    >
      <Icon name={icon} size={iconSize} color={color} />
      <AppText variant="caption" color={kind === 'info' ? 'textMuted' : color} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', alignSelf: 'stretch' },
  box: { padding: 12, borderRadius: radius.md },
  text: { flex: 1 },
});
