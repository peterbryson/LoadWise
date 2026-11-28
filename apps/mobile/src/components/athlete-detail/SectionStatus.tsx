import { ActivityIndicator } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { InlineMessage } from '@/components/InlineMessage';
import { useTheme } from '@/theme/theme';
import type { SectionState } from './use-section-request';

interface SectionStatusProps {
  state: SectionState<unknown>;
  retry: () => void;
  /** What the section shows, for the loading label and the offline line, e.g. "monotony and strain". */
  what: string;
}

/** #51 AC4: shown with a 403, which most often means the athlete has withdrawn consent for this squad. */
export function NotSharingNote() {
  return (
    <AppText variant="caption" color="textMuted">
      This happens when an athlete stops sharing their data with this squad. It shows again if they share again.
    </AppText>
  );
}

/** #51 AC4: the loading, offline, refused and error states every athlete detail section shares. */
export function SectionStatus({ state, retry, what }: SectionStatusProps) {
  const { colors } = useTheme();

  switch (state.kind) {
    case 'loaded':
      return null;
    case 'loading':
      return <ActivityIndicator color={colors.accent} accessibilityLabel={`Loading ${what}`} />;
    case 'offline':
      return (
        <>
          <InlineMessage kind="info" text={`You are offline, so ${what} can't load. Try again when you have signal.`} />
          <Button label="Try again" variant="secondary" onPress={retry} accessibilityHint={`Loads ${what} again`} />
        </>
      );
    case 'refused':
      return (
        <>
          <InlineMessage kind="info" text={state.message} />
          <NotSharingNote />
          <Button label="Try again" variant="secondary" onPress={retry} accessibilityHint={`Loads ${what} again`} />
        </>
      );
    case 'error':
      return (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} accessibilityHint={`Loads ${what} again`} />
        </>
      );
  }
}
