import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';

type Tone = 'surface' | 'raised' | 'accent' | 'warning' | 'danger';

interface CardProps {
  children: ReactNode;
  tone?: Tone;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A panel in shadcn/ui's card style (#52): surface fill with a hairline border and no shadow.
 * Tinted tones (accent, warning, danger) carry status, and always sit beside words saying it.
 */
export function Card({ children, tone = 'surface', gap = 10, style }: CardProps) {
  const { colors } = useTheme();
  const backgroundColor = {
    surface: colors.surface,
    raised: colors.surfaceRaised,
    accent: colors.accentTint,
    warning: colors.warningTint,
    danger: colors.dangerTint,
  }[tone];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor, gap },
        tone === 'surface' && { borderWidth: colors.cardBorderWidth, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface CardHeaderProps {
  title: string;
  /** Short muted line under the title. */
  description?: string;
  /** Right-hand slot: a badge, value or small button. */
  trailing?: ReactNode;
}

/** Title, optional description and a trailing slot, as in shadcn/ui's CardHeader. */
export function CardHeader({ title, description, trailing }: CardHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {description ? (
          <AppText variant="caption" color="textMuted">
            {description}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 16, alignSelf: 'stretch', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, gap: 2 },
});
