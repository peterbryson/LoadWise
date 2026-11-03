import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { typography } from '@/theme/tokens';
import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
}

/** A labelled 52 px input, as in the Figma sign-in fields. */
export function TextField({ label, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          typography.body,
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, alignSelf: 'stretch' },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
});
