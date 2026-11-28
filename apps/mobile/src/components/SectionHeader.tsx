import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  /** Shown after the title, e.g. the number of athletes in the group. */
  count?: number;
  trailing?: ReactNode;
}

/** A small uppercase heading for a group of cards or rows, with an optional count (#52). */
export function SectionHeader({ title, count, trailing }: SectionHeaderProps) {
  const label = count === undefined ? title : `${title} · ${count}`;
  return (
    <View style={styles.row}>
      <AppText variant="overline" color="textMuted" accessibilityRole="header">
        {label}
      </AppText>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
});
