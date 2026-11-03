import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/theme';

type Tone = 'surface' | 'raised' | 'accent' | 'warning';

interface CardProps {
  children: ReactNode;
  tone?: Tone;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/** A rounded panel. Plain surface cards get the theme's outline; tinted cards never do. */
export function Card({ children, tone = 'surface', gap = 8, style }: CardProps) {
  const { colors } = useTheme();
  const backgroundColor = {
    surface: colors.surface,
    raised: colors.surfaceRaised,
    accent: colors.accentTint,
    warning: colors.warningTint,
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

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, alignSelf: 'stretch', overflow: 'hidden' },
});
