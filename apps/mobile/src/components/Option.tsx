import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';

interface OptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** The Figma "Option" component: a 48 px tap target that fills its share of a row. */
export function Option({ label, selected, onPress, accessibilityLabel }: OptionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, checked: selected }}
      style={[styles.option, { backgroundColor: selected ? colors.accent : colors.surfaceRaised }]}
    >
      <AppText variant="label" color={selected ? 'onAccent' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}

interface OptionRowProps<T extends string | number> {
  options: readonly { value: T; label: string; accessibilityLabel?: string }[];
  selected: T | undefined;
  onSelect: (value: T) => void;
  accessibilityLabel: string;
}

/** A single-choice row of options, such as a wellness score or session type. */
export function OptionRow<T extends string | number>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: OptionRowProps<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <Option
          key={String(option.value)}
          label={option.label}
          accessibilityLabel={option.accessibilityLabel}
          selected={option.value === selected}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
});
