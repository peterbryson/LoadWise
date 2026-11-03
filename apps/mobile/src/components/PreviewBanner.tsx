import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';

interface PreviewBannerProps<T extends string> {
  /** What is not real yet, e.g. "Sample data. Load metrics arrive with #7." */
  note: string;
  states?: readonly { value: T; label: string }[];
  state?: T;
  onStateChange?: (state: T) => void;
}

/**
 * Marks a screen built from the Figma sample figures, so a demo or screenshot can never be
 * mistaken for a working feature. The chips switch between the design's states for that screen.
 */
export function PreviewBanner<T extends string>({
  note,
  states,
  state,
  onStateChange,
}: PreviewBannerProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.banner, { borderColor: colors.warning, backgroundColor: colors.warningTint }]}
      accessibilityRole="summary"
    >
      <AppText variant="label" color="warning">
        Preview: {note}
      </AppText>
      {states && onStateChange ? (
        <View style={styles.chips}>
          {states.map((option) => {
            const selected = option.value === state;
            return (
              <Pressable
                key={option.value}
                onPress={() => onStateChange(option.value)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${option.label} state`}
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  { borderColor: colors.warning },
                  selected && { backgroundColor: colors.warning },
                ]}
              >
                <AppText variant="caption" color={selected ? 'warningTint' : 'warning'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 10, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, minHeight: 28, justifyContent: 'center' },
});
