import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  /** Why there is nothing here and what would change that. */
  description: string;
  action?: ReactNode;
}

/**
 * An empty or not-enough-data state (#52) that keeps the shape of a card, with a short reason,
 * e.g. "Usual week needs 4 completed weeks". Borrowed from Hevy and Withings (ui-design-direction).
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name={icon} size={20} color="textMuted" />
      </View>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="caption" color="textMuted" style={styles.center}>
        {description}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
});
