import { Children, Fragment, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** A settings-style row with no screen behind it yet, announced as not available. */
export function ListRow({ label }: { label: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, not available yet`}>
      <AppText variant="body">{label}</AppText>
      <Icon name="chevron-row" size={18} />
    </View>
  );
}

/**
 * Rows grouped in one bordered card with inset hairline dividers (#52 restyle), under a small
 * uppercase section title, as in iOS grouped lists and shadcn/ui's settings pages.
 */
export function ListGroup({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <View style={[styles.rows, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  group: { gap: 8, alignSelf: 'stretch' },
  title: { paddingHorizontal: 4 },
  rows: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
