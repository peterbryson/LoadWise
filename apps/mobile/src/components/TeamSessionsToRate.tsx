import { RateTeamSessionSchema } from '@loadwise/shared';
import type { TeamSessionToRate } from '@loadwise/shared';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ApiClient, ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sessionTypeLabels, shortDay } from '@/lib/session-format';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { InlineMessage } from './InlineMessage';
import { OptionRow } from './Option';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; items: TeamSessionToRate[] };

const rpeRows = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
].map((row) => row.map((value) => ({ value, label: String(value) })));

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

function summary(item: TeamSessionToRate): string {
  return `${sessionTypeLabels[item.type]} · ${item.durationMinutes} min · ${shortDay(item.date)}`;
}

/**
 * #17 AC2: on Today, the team sessions from the athlete's squads that they have not yet added an
 * RPE to, each with an RPE picker and Save, so rating takes two taps without leaving Today.
 * Loads again whenever Today comes into view. While loading, and when there is nothing to rate,
 * it shows nothing: most days there is no team session, and an empty card would only add noise.
 * A failure stays inside the card, so the rest of Today still works.
 */
export function TeamSessionsToRate() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .teamSessionsToRate()
        .then((items) => {
          if (!cancelled) setState({ kind: 'loaded', items });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState({ kind: 'error', message: errorText(error) });
        });
      return () => {
        cancelled = true;
      };
    }, [api, attempt]),
  );

  function reload() {
    setAttempt((value) => value + 1);
  }

  /** A rating was saved, or the API says it already was: drop it from the list straight away. */
  function done(item: TeamSessionToRate, message: string, checkAgain: boolean) {
    setNotice(message);
    setState((current) =>
      current.kind === 'loaded' ? { kind: 'loaded', items: current.items.filter((i) => i.id !== item.id) } : current,
    );
    if (checkAgain) reload();
  }

  if (state.kind === 'error') {
    return (
      <Card gap={6}>
        <AppText variant="heading">Team sessions</AppText>
        <InlineMessage kind="error" text={state.message} />
        <Button
          label="Try again"
          variant="secondary"
          accessibilityHint="Loads your team sessions again"
          onPress={() => {
            setState({ kind: 'loading' });
            reload();
          }}
        />
      </Card>
    );
  }

  const items = state.kind === 'loaded' ? state.items : [];
  if (items.length === 0 && !notice) return null;

  return (
    <Card tone="accent" gap={12}>
      <AppText variant="title" accessibilityRole="header">
        {items.length === 1 ? 'Add your RPE' : items.length > 1 ? `Add your RPE (${items.length})` : 'Team sessions'}
      </AppText>
      {notice ? (
        <View accessibilityLiveRegion="polite">
          <InlineMessage kind="info" text={notice} />
        </View>
      ) : null}
      {items.map((item) => (
        <TeamSessionRating key={item.id} api={api} item={item} onDone={done} />
      ))}
    </Card>
  );
}

interface TeamSessionRatingProps {
  api: Pick<ApiClient, 'rateTeamSession'>;
  item: TeamSessionToRate;
  onDone: (item: TeamSessionToRate, message: string, checkAgain: boolean) => void;
}

/** One team session: pick an RPE, then Save. Choosing first, then saving, avoids a mis-tap being stored. */
function TeamSessionRating({ api, item, onDone }: TeamSessionRatingProps) {
  const [rpe, setRpe] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per rating, kept across Save retries, so a retry after a lost response is a replay (#6).
  const clientId = useRef<string | null>(null);
  const label = `${item.squadName} ${sessionTypeLabels[item.type].toLowerCase()} on ${shortDay(item.date)}`;

  async function save() {
    const parsed = RateTeamSessionSchema.safeParse({ rpe, clientId: (clientId.current ??= randomUUID()) });
    if (!parsed.success) return setError('Choose an RPE from 1 to 10.');
    setBusy(true);
    setError(null);
    try {
      const saved = await api.rateTeamSession(item.id, parsed.data);
      onDone(item, `Saved: ${item.squadName}, RPE ${saved.rpe}, ${saved.load} AU`, false);
    } catch (caught) {
      setBusy(false);
      // 409: already rated (for example on another phone), or the key was refused. Either way,
      // the list is loaded again, so it shows only what is still to rate.
      if (caught instanceof ApiError && caught.status === 409) return onDone(item, caught.message, true);
      setError(errorText(caught));
    }
  }

  return (
    <View style={styles.item}>
      <AppText variant="heading">{item.squadName}</AppText>
      <AppText variant="caption" color="textMuted">
        {summary(item)}
      </AppText>
      {rpeRows.map((row, index) => (
        <OptionRow
          key={index}
          options={row}
          selected={rpe}
          onSelect={(value) => {
            setRpe(value);
            setError(null);
          }}
          accessibilityLabel={`RPE ${index === 0 ? '1 to 5' : '6 to 10'} for ${label}`}
        />
      ))}
      <AppText variant="caption" color="textMuted">
        1 is very, very easy and 10 is maximal.
      </AppText>
      {error ? <InlineMessage kind="error" text={error} iconSize={16} /> : null}
      <Button
        label={rpe === undefined ? 'Save RPE' : `Save RPE ${rpe}`}
        accessibilityHint={`Saves your RPE for ${label}`}
        loading={busy}
        onPress={() => void save()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: 6 },
});
