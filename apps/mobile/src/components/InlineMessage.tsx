import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

type Kind = 'error' | 'info';

interface InlineMessageProps {
  kind: Kind;
  text: string;
  iconSize?: 16 | 18;
}

const iconFor: Record<Kind, Record<16 | 18, IconName>> = {
  error: { 16: 'alert-danger-16', 18: 'alert-danger-18' },
  info: { 16: 'info-muted', 18: 'info-muted' },
};

/** An icon and a short line of text: form errors and safety notes. Errors are announced. */
export function InlineMessage({ kind, text, iconSize = 18 }: InlineMessageProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={kind === 'error' ? 'polite' : undefined}
    >
      <Icon name={iconFor[kind][iconSize]} size={iconSize} />
      <AppText variant="caption" color={kind === 'error' ? 'danger' : 'textMuted'} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', alignSelf: 'stretch' },
  text: { flex: 1 },
});
