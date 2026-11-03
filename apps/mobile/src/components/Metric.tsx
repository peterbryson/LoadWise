import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';

interface MetricProps {
  label: string;
  value: string;
  unit: string;
}

/** A small card with a caption and a large number, e.g. "This week 1,240 AU". */
export function Metric({ label, value, unit }: MetricProps) {
  return (
    <Card gap={4} style={styles.card}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <View style={styles.value} accessible accessibilityLabel={`${label}: ${value} ${unit}`}>
        <AppText variant="metric">{value}</AppText>
        <AppText variant="caption" color="textMuted">
          {unit}
        </AppText>
      </View>
    </Card>
  );
}

export function MetricRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 14 },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
});
