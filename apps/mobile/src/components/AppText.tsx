import { Text, TextProps } from 'react-native';
import { useTheme } from '@/theme/theme';
import { ColorToken, typography, TypographyVariant } from '@/theme/tokens';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
}

/** Text in one of the design's type styles and colour tokens. */
export function AppText({ variant = 'body', color = 'text', style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  return <Text style={[typography[variant], { color: colors[color] }, style]} {...props} />;
}
