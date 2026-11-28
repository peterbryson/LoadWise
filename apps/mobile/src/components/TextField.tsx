import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius, typography } from '@/theme/tokens';
import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Muted help under the field, e.g. the expected format. */
  hint?: string;
}

/**
 * A labelled 48 px input (#52 restyle). The border meets 3:1 non-text contrast, and focus is
 * shown with a 2 px accent ring, as in shadcn/ui's `ring`.
 */
export function TextField({ label, hint, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          typography.body,
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.accent : colors.input,
            borderWidth: focused ? 2 : 1,
            paddingHorizontal: focused ? 13 : 14,
            color: colors.text,
          },
        ]}
        {...inputProps}
      />
      {hint ? (
        <AppText variant="caption" color="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, alignSelf: 'stretch' },
  input: { minHeight: 48, borderRadius: radius.md },
});
