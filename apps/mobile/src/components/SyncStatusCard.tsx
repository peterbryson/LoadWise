import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { InlineMessage } from '@/components/InlineMessage';
import { useOfflineSync } from '@/lib/offline-sync';

/**
 * #6 on Today: how many entries are saved on this device and waiting to sync, and any entry the API
 * refused while syncing in the background. Refused entries are no longer stored, so this is the
 * athlete's only notice of them. Nothing is shown when everything has synced.
 */
export function SyncStatusCard() {
  const { pending, problems, dismissProblems } = useOfflineSync();
  if (pending.length === 0 && problems.length === 0) return null;

  return (
    <Card tone="raised" gap={6}>
      {pending.length > 0 ? (
        <>
          <View style={styles.titleRow}>
            <Icon name="cloud" size={20} />
            <AppText variant="heading">Saved on this device</AppText>
          </View>
          <AppText variant="caption" color="textMuted">
            {pending.length === 1
              ? '1 entry will sync automatically when you are back online.'
              : `${pending.length} entries will sync automatically when you are back online.`}
          </AppText>
        </>
      ) : null}
      {problems.map((problem, index) => (
        <InlineMessage key={index} kind="error" text={problem} />
      ))}
      {problems.length > 0 ? <Button label="Dismiss" variant="secondary" onPress={dismissProblems} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
