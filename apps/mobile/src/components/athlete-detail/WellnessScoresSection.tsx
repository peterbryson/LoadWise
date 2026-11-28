import { WELLNESS_ITEMS } from '@loadwise/analytics';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import type { ApiClient, StaffWellnessEntry } from '@/lib/api';
import { wellnessItemLabels } from '@/lib/flag-format';
import { useTheme } from '@/theme/theme';
import { SectionStatus } from './SectionStatus';
import { useSectionRequest } from './use-section-request';

/** The API returns up to 28 check-ins (the baseline window); a week is enough for a quick look pitch-side. */
export const WELLNESS_CHECK_INS_SHOWN = 7;

interface WellnessScoresSectionProps {
  api: ApiClient;
  squadId: string;
  athleteId: string;
  athleteName: string;
}

/**
 * #51 AC2: the athlete's recent wellness scores, for staff whose role has WELLNESS_SCORES. The
 * screen only mounts this section for those roles (DL-022: S&C coaches and physios), so a coach
 * sees no heading or link and never makes the request; the API checks again regardless. Scores
 * are shown as answered, with no colour or judgement: only the flag rules decide what is unusual.
 */
export function WellnessScoresSection({ api, squadId, athleteId, athleteName }: WellnessScoresSectionProps) {
  const load = useCallback(() => api.athleteWellness(squadId, athleteId), [api, squadId, athleteId]);
  const { state, retry } = useSectionRequest(load);

  return (
    <Card>
      <AppText variant="heading">Recent wellness</AppText>
      <SectionStatus state={state} retry={retry} what="wellness scores" />
      {state.kind === 'loaded' && state.data.length === 0 ? (
        <AppText variant="body" color="textMuted">
          {`${athleteName} has not done a wellness check-in yet.`}
        </AppText>
      ) : null}
      {state.kind === 'loaded' && state.data.length > 0 ? (
        <Entries entries={state.data.slice(0, WELLNESS_CHECK_INS_SHOWN)} />
      ) : null}
    </Card>
  );
}

function Entries({ entries }: { entries: StaffWellnessEntry[] }) {
  const { colors } = useTheme();
  return (
    <>
      <AppText variant="caption" color="textMuted">
        {`Last ${entries.length} check-in${entries.length === 1 ? '' : 's'}, newest first. Each score is 1 (worst) to 5 (best).`}
      </AppText>
      {entries.map((entry) => (
        <View
          key={entry.date}
          style={[styles.entry, { borderTopColor: colors.border }]}
          accessible
          accessibilityLabel={`${longDate(entry.date)}: ${WELLNESS_ITEMS.map(
            (item) => `${wellnessItemLabels[item]} ${entry[item]} of 5`,
          ).join(', ')}`}
        >
          <AppText variant="label">{shortDate(entry.date)}</AppText>
          <View style={styles.scores}>
            {WELLNESS_ITEMS.map((item) => (
              <AppText key={item} variant="caption" color="textMuted">
                {`${wellnessItemLabels[item]} ${entry[item]}`}
              </AppText>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function calendarDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "Wed 25 Nov" */
function shortDate(date: string): string {
  return calendarDay(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Wednesday 25 November" */
function longDate(date: string): string {
  return calendarDay(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

const styles = StyleSheet.create({
  entry: { gap: 2, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  scores: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
});
