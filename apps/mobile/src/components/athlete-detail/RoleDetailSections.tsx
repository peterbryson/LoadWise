import { ActivityIndicator } from 'react-native';
import { Button } from '@/components/Button';
import { InlineMessage } from '@/components/InlineMessage';
import type { ApiClient } from '@/lib/api';
import { useViewerRole, viewerCanSee } from '@/lib/viewer-role';
import { useTheme } from '@/theme/theme';
import { LoadDetailSection } from './LoadDetailSection';
import { WellnessScoresSection } from './WellnessScoresSection';

interface RoleDetailSectionsProps {
  api: ApiClient;
  squadId: string;
  athleteId: string;
  athleteName: string;
}

/**
 * #51: the parts of the athlete screen that depend on the viewer's role in this squad (DL-022).
 * The role comes from `GET /squads`; a section is mounted, and so requested, only when the role
 * includes its data category, so a coach's screen never asks for monotony, strain or wellness
 * scores (AC3). If the role cannot be checked, nothing extra is requested (fail closed).
 */
export function RoleDetailSections({ api, squadId, athleteId, athleteName }: RoleDetailSectionsProps) {
  const { colors } = useTheme();
  const { state, retry } = useViewerRole(api, squadId);

  if (state.kind === 'loading') {
    return <ActivityIndicator color={colors.accent} accessibilityLabel="Checking your role in this squad" />;
  }
  if (state.kind === 'error') {
    return (
      <>
        <InlineMessage kind="error" text={`${state.message} Only the load above is shown.`} />
        <Button
          label="Try again"
          variant="secondary"
          onPress={retry}
          accessibilityHint="Checks your role in this squad again"
        />
      </>
    );
  }

  const { role } = state;
  return (
    <>
      {viewerCanSee(role, 'LOAD_DETAIL') ? (
        <LoadDetailSection api={api} squadId={squadId} athleteId={athleteId} />
      ) : null}
      {viewerCanSee(role, 'WELLNESS_SCORES') ? (
        <WellnessScoresSection api={api} squadId={squadId} athleteId={athleteId} athleteName={athleteName} />
      ) : null}
    </>
  );
}
