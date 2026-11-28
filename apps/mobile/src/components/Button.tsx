import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { ColorToken, radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'default' | 'sm';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  /** Optional leading icon; the label still carries the meaning. */
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}

/**
 * Buttons in shadcn/ui's variants (#52, DL-033): primary (solid accent), secondary (muted fill),
 * outline, ghost and danger. Default height 48 and small 40, both at least the 24 px target of
 * WCAG 2.5.8 and close to the 44 to 48 px platform guidance.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  icon,
  disabled = false,
  loading = false,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const background = {
    primary: colors.accent,
    secondary: colors.surfaceRaised,
    outline: colors.surface,
    ghost: 'transparent',
    danger: colors.dangerTint,
  }[variant];
  const textColor = (
    { primary: 'onAccent', secondary: 'text', outline: 'text', ghost: 'accent', danger: 'danger' } as const
  )[variant] satisfies ColorToken;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.small,
        { backgroundColor: background, opacity: inactive ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.input },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[textColor]} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={textColor} /> : null}
          <AppText variant={size === 'sm' ? 'label' : 'heading'} color={textColor}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  small: { height: 40, paddingHorizontal: 14, borderRadius: radius.sm + 2 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
