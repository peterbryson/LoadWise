import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** The Figma "List Row" component. These rows have no screens behind them yet. */
export function ListRow({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.row, { backgroundColor: colors.surface }]}
      accessible
      accessibilityLabel={`${label}, not available yet`}
    >
      <AppText variant="body">{label}</AppText>
      <Icon name="chevron-row" size={20} />
    </View>
  );
}

/** Rows grouped in one rounded block with 1 px dividers, as in Profile. */
export function ListGroup({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="caption" color="textMuted" accessibilityRole="header">
        {title}
      </AppText>
      <View style={[styles.rows, { backgroundColor: colors.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 56,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  group: { gap: 6, alignSelf: 'stretch' },
  rows: { borderRadius: 16, overflow: 'hidden', gap: 1 },
});
