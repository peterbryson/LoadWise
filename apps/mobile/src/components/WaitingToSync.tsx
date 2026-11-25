import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** #6 AC4: marks a session that is saved on this device but not yet synced. */
export function WaitingToSync() {
  return (
    <View style={styles.row}>
      <Icon name="cloud" size={16} />
      <AppText variant="caption" color="textMuted">
        Waiting to sync
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
