import type { LoadDetail } from '@loadwise/shared';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import type { ApiClient } from '@/lib/api';
import { SectionStatus } from './SectionStatus';
import { useSectionRequest } from './use-section-request';

interface LoadDetailSectionProps {
  api: ApiClient;
  squadId: string;
  athleteId: string;
}

/**
 * #51 AC1 (I-28): monotony and strain for staff whose role has LOAD_DETAIL (S&C coaches and
 * physios), from the athlete's combined sessions. The screen only mounts this section for those
 * roles, so a coach's screen never makes this request (AC3); the API checks again regardless.
 */
export function LoadDetailSection({ api, squadId, athleteId }: LoadDetailSectionProps) {
  const load = useCallback(() => api.athleteLoadDetail(squadId, athleteId), [api, squadId, athleteId]);
  const { state, retry } = useSectionRequest(load);

  return (
    <Card>
      <AppText variant="heading">Monotony and strain</AppText>
      <SectionStatus state={state} retry={retry} what="monotony and strain" />
      {state.kind === 'loaded' ? <Loaded detail={state.data} /> : null}
    </Card>
  );
}

function Loaded({ detail }: { detail: LoadDetail }) {
  // Strain is null exactly when monotony is, so one check covers both.
  if (detail.monotony === null || detail.strain === null) {
    return (
      <AppText variant="body" color="textMuted">
        Not available for the last 7 days. Monotony needs daily loads that differ, so it is not shown when every
        day had the same load, including a week with no sessions.
      </AppText>
    );
  }

  return (
    <>
      <View style={styles.row}>
        <Figure label="Monotony" value={detail.monotony.toFixed(2)} />
        <Figure label="Strain" value={Math.round(detail.strain).toLocaleString('en-GB')} unit="AU" />
      </View>
      <AppText variant="caption" color="textMuted">
        Both cover the last 7 days. Monotony is the average daily load divided by how much it varied from day to
        day: higher means the days were more alike. Strain is the week’s total load multiplied by monotony.
      </AppText>
      <AppText variant="caption" color="textMuted">
        Counted from their first logged session, with earlier days as zero, so early values can look unusual.
      </AppText>
    </>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={unit ? `${label}: ${value} ${unit}` : `${label}: ${value}`}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <View style={styles.value}>
        <AppText variant="metric">{value}</AppText>
        {unit ? (
          <AppText variant="caption" color="textMuted">
            {unit}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16 },
  figure: { flex: 1, gap: 2 },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
});
