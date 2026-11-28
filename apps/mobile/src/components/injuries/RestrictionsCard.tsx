import { RecordRestrictionSchema } from '@loadwise/shared';
import type { TrainingRestriction } from '@loadwise/shared';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { InlineMessage } from '@/components/InlineMessage';
import { TextField } from '@/components/TextField';
import { ApiClient, ApiError } from '@/lib/api';
import { shortDay } from '@/lib/session-format';
import { useTheme } from '@/theme/theme';
import { useSectionData } from './use-section-data';

interface RestrictionsCardProps {
  api: ApiClient;
  squadId: string;
  athleteId: string;
  /** True for the squad's physio, who may set and end restrictions. Display only: the API decides. */
  canManage: boolean;
}

/**
 * #21 AC2: the athlete's active training restrictions in this squad, for every staff role. A physio
 * also sees the form to set one (AC1) and can end one. Wording stays neutral: a restriction is the
 * physio's decision, and LoadWise never sets, suggests or ends one, or decides return to play.
 */
export function RestrictionsCard({ api, squadId, athleteId, canManage }: RestrictionsCardProps) {
  const { colors } = useTheme();
  const load = useCallback(
    () => api.athleteRestrictions(squadId, athleteId),
    [api, squadId, athleteId],
  );
  const { state, retry, update } = useSectionData(load, 'training restrictions');
  const [ending, setEnding] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);

  async function end(restriction: TrainingRestriction) {
    setEnding(restriction.id);
    setEndError(null);
    try {
      await api.endRestriction(squadId, athleteId, restriction.id);
      update((list) => list.filter((item) => item.id !== restriction.id));
    } catch (error) {
      setEndError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    } finally {
      setEnding(null);
    }
  }

  return (
    <Card gap={10}>
      <AppText variant="heading" accessibilityRole="header">
        Training restrictions
      </AppText>
      <AppText variant="caption" color="textMuted">
        Set and ended by the squad’s physio. LoadWise does not set restrictions or decide return to
        play.
      </AppText>

      {state.kind === 'loading' ? (
        <ActivityIndicator
          color={colors.accent}
          accessibilityLabel="Loading training restrictions"
        />
      ) : null}

      {state.kind === 'error' ? (
        <>
          <InlineMessage kind="error" text={state.message} />
          <Button label="Try again" variant="secondary" onPress={retry} />
        </>
      ) : null}

      {state.kind === 'loaded' && state.data.length === 0 ? (
        <AppText variant="body" color="textMuted">
          No active restrictions.
        </AppText>
      ) : null}

      {state.kind === 'loaded'
        ? state.data.map((restriction) => (
            <View key={restriction.id} style={[styles.item, { borderColor: colors.border }]}>
              <AppText variant="body">{restriction.description}</AppText>
              {restriction.reviewOn ? (
                <AppText variant="caption" color="textMuted">
                  {`Physio review on ${shortDay(restriction.reviewOn)}`}
                </AppText>
              ) : null}
              {canManage ? (
                <Button
                  label="End restriction"
                  variant="secondary"
                  loading={ending === restriction.id}
                  accessibilityHint={`Ends “${restriction.description}” for staff in this squad`}
                  onPress={() => void end(restriction)}
                />
              ) : null}
            </View>
          ))
        : null}

      {endError ? <InlineMessage kind="error" text={endError} /> : null}

      {canManage && state.kind === 'loaded' ? (
        <AddRestrictionForm
          api={api}
          squadId={squadId}
          athleteId={athleteId}
          onAdded={(restriction) => update((list) => [restriction, ...list])}
        />
      ) : null}
    </Card>
  );
}

interface AddRestrictionFormProps {
  api: ApiClient;
  squadId: string;
  athleteId: string;
  onAdded: (restriction: TrainingRestriction) => void;
}

/** #21 AC1: a physio sets a restriction. Validated with the same shared schema the API uses. */
function AddRestrictionForm({ api, squadId, athleteId, onAdded }: AddRestrictionFormProps) {
  const [description, setDescription] = useState('');
  const [reviewOn, setReviewOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = RecordRestrictionSchema.safeParse({
      description,
      reviewOn: reviewOn.trim() || undefined,
    });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setSaving(true);
    try {
      onAdded(await api.addRestriction(squadId, athleteId, parsed.data));
      setDescription('');
      setReviewOn('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <AppText variant="label">Add a restriction</AppText>
      <InlineMessage
        kind="info"
        iconSize={16}
        text="Coaches and S&C coaches in this squad will see this. Write only what they need to plan training, such as “No contact training”. Keep diagnosis and notes in the injury record."
      />
      <TextField
        label="Restriction"
        value={description}
        onChangeText={setDescription}
        maxLength={120}
      />
      <TextField
        label="Physio review date (optional, YYYY-MM-DD)"
        value={reviewOn}
        onChangeText={setReviewOn}
        placeholder="2026-12-04"
        autoCapitalize="none"
      />
      {error ? <InlineMessage kind="error" text={error} /> : null}
      <Button label="Save restriction" onPress={() => void save()} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: 6, paddingTop: 10, borderTopWidth: 1 },
  form: { gap: 10, paddingTop: 10 },
});
