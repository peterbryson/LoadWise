import { RecordInjurySchema } from '@loadwise/shared';
import type { InjuryRecord } from '@loadwise/shared';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { TextField } from '@/components/TextField';
import { ApiClient, ApiError } from '@/lib/api';
import { localIsoDate } from '@/lib/dates';
import { shortDay } from '@/lib/session-format';
import { useTheme } from '@/theme/theme';
import { useSectionData } from './use-section-data';

interface InjuriesCardProps {
  api: ApiClient;
  squadId: string;
  athleteId: string;
}

/**
 * #21 AC1: injuries recorded in this squad, and the form to record one. Shown only to the squad's
 * physio; the API refuses every other role (#11 AC1), so hiding it here is a convenience, not the
 * protection. LoadWise records what the physio enters and never diagnoses or advises treatment.
 */
export function InjuriesCard({ api, squadId, athleteId }: InjuriesCardProps) {
  const { colors } = useTheme();
  const load = useCallback(
    () => api.athleteInjuries(squadId, athleteId),
    [api, squadId, athleteId],
  );
  const { state, retry, update } = useSectionData(load, 'injury records');
  const [formOpen, setFormOpen] = useState(false);

  return (
    <Card gap={10}>
      <AppText variant="heading" accessibilityRole="header">
        Injuries
      </AppText>
      <AppText variant="caption" color="textMuted">
        Only physios in this squad can see these. Coaches see only the restrictions above.
      </AppText>

      {state.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading injury records" />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' && state.data.length === 0 ? (
        <AppText variant="body" color="textMuted">
          No injuries recorded in this squad.
        </AppText>
      ) : null}

      {state.kind === 'loaded'
        ? state.data.map((injury) => (
            <View key={injury.id} style={[styles.item, { borderColor: colors.border }]}>
              <AppText variant="body">{injury.bodyArea}</AppText>
              <AppText variant="caption" color="textMuted">
                {injury.returnDate
                  ? `From ${shortDay(injury.onsetDate)}, returned ${shortDay(injury.returnDate)}`
                  : `From ${shortDay(injury.onsetDate)}, not yet returned`}
              </AppText>
              {injury.notes ? <AppText variant="caption">{injury.notes}</AppText> : null}
            </View>
          ))
        : null}

      {state.kind === 'loaded' && !formOpen ? (
        <Button label="Record injury" variant="secondary" onPress={() => setFormOpen(true)} />
      ) : null}

      {state.kind === 'loaded' && formOpen ? (
        <RecordInjuryForm
          api={api}
          squadId={squadId}
          athleteId={athleteId}
          onCancel={() => setFormOpen(false)}
          onRecorded={(injury) => {
            update((list) =>
              [injury, ...list].sort((a, b) => b.onsetDate.localeCompare(a.onsetDate)),
            );
            setFormOpen(false);
          }}
        />
      ) : null}
    </Card>
  );
}

interface RecordInjuryFormProps {
  api: ApiClient;
  squadId: string;
  athleteId: string;
  onCancel: () => void;
  onRecorded: (injury: InjuryRecord) => void;
}

/** Validated with the same shared schema the API uses, so both reject exactly the same input. */
function RecordInjuryForm({
  api,
  squadId,
  athleteId,
  onCancel,
  onRecorded,
}: RecordInjuryFormProps) {
  const [bodyArea, setBodyArea] = useState('');
  const [onsetDate, setOnsetDate] = useState(() => localIsoDate(new Date()));
  const [returnDate, setReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = RecordInjurySchema.safeParse({
      bodyArea,
      onsetDate: onsetDate.trim(),
      returnDate: returnDate.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setSaving(true);
    try {
      onRecorded(await api.recordInjury(squadId, athleteId, parsed.data));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <AppText variant="label">Record an injury</AppText>
      <TextField label="Body area" value={bodyArea} onChangeText={setBodyArea} maxLength={60} />
      <TextField
        label="Onset date (YYYY-MM-DD)"
        value={onsetDate}
        onChangeText={setOnsetDate}
        autoCapitalize="none"
      />
      <TextField
        label="Return date (optional, YYYY-MM-DD)"
        value={returnDate}
        onChangeText={setReturnDate}
        autoCapitalize="none"
      />
      <TextField
        label="Notes (optional, physio only)"
        value={notes}
        onChangeText={setNotes}
        maxLength={500}
      />
      {error ? <InlineMessage kind="error" text={error} /> : null}
      <Button label="Save injury" onPress={() => void save()} loading={saving} />
      <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: 4, paddingTop: 10, borderTopWidth: 1 },
  form: { gap: 10, paddingTop: 10 },
});
