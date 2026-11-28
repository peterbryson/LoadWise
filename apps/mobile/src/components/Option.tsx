import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius, TOUCH_TARGET } from '@/theme/tokens';
import { AppText } from './AppText';

interface OptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/**
 * One choice in a row, at least 48 px tall (#52 restyle). Unselected options have a 3:1 outline
 * (WCAG 1.4.11); the selected one is filled with the accent and its label turns bold, so the
 * state does not rely on colour alone.
 */
export function Option({ label, selected, onPress, accessibilityLabel }: OptionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, checked: selected }}
      style={({ pressed }) => [
        styles.option,
        selected
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.input },
        pressed && !selected && { backgroundColor: colors.surfaceRaised },
      ]}
    >
      <AppText variant={selected ? 'heading' : 'label'} color={selected ? 'onAccent' : 'text'}>
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
  /** Words under the two ends of a scale, e.g. "Poor" and "Great". */
  anchors?: [string, string];
}

/** A single-choice row of options, such as a wellness score or session type. */
export function OptionRow<T extends string | number>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
  anchors,
}: OptionRowProps<T>) {
  return (
    <View style={styles.wrap}>
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
      {anchors ? (
        <View style={styles.anchors}>
          <AppText variant="caption" color="textMuted">
            {anchors[0]}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {anchors[1]}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, alignSelf: 'stretch' },
  option: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  row: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  anchors: { flexDirection: 'row', justifyContent: 'space-between' },
});
