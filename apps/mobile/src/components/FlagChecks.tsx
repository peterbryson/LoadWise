import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import type { CurrentFlags } from '@/lib/api';
import { allChecksRan, checkLines } from '@/lib/flag-format';

/**
 * #9: the status shown when nothing is flagged. "Nothing has been flagged today" is only shown
 * when both rules actually ran; otherwise it says which checks could not run and why, so a new
 * athlete or a missed check-in is never presented as an all-clear.
 */
export function NoFlagsStatus({ data }: { data: CurrentFlags }) {
  const complete = allChecksRan(data);
  return (
    <>
      <View style={styles.titleRow}>
        <Icon name={complete ? 'check-status' : 'info-muted'} size={24} />
        <AppText variant="heading" style={styles.flex}>
          {complete ? 'Nothing has been flagged today' : 'Not everything could be checked today'}
        </AppText>
      </View>
      <CheckLines data={data} />
    </>
  );
}

/** One caption line per rule: checked, or why it could not be checked yet. */
export function CheckLines({ data }: { data: CurrentFlags }) {
  return (
    <View style={styles.lines}>
      {checkLines(data).map((line) => (
        <AppText key={line} variant="caption" color="textMuted">
          {line}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lines: { gap: 4 },
  flex: { flex: 1 },
});
