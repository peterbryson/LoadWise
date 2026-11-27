import { CreateSquadSchema, JoinSquadSchema, StaffRole } from '@loadwise/shared';
import { useState } from 'react';
import { ApiClient, ApiError, CreatedSquad, JoinedSquad } from '@/lib/api';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { InlineMessage } from './InlineMessage';
import { OptionRow } from './Option';
import { TextField } from './TextField';

const roles = [
  { value: 'COACH', label: 'Coach' },
  { value: 'PHYSIO', label: 'Physio' },
  { value: 'SC_COACH', label: 'S&C', accessibilityLabel: 'S and C coach' },
] as const;

type Result = { kind: 'error' | 'info'; text: string } | null;

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

interface CreateSquadFormProps {
  api: Pick<ApiClient, 'createSquad'>;
  onCreated: (squad: CreatedSquad) => void;
  heading?: string;
}

/**
 * #2: create a squad as staff, with the creator's role in it. Used on the Squad tab, at setup and
 * on Profile (#48). Input is checked with the same Zod schema as the API.
 */
export function CreateSquadForm({ api, onCreated, heading = 'Create a squad' }: CreateSquadFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('COACH');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function create() {
    const parsed = CreateSquadSchema.safeParse({ name, role });
    if (!parsed.success) {
      setResult({ kind: 'error', text: 'Squad names are 2 to 60 characters.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const squad = await api.createSquad(parsed.data);
      setResult({ kind: 'info', text: `Created "${squad.name}". Invite code: ${squad.inviteCode}` });
      setName('');
      onCreated(squad);
    } catch (error) {
      setResult({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card gap={10}>
      <AppText variant="heading" accessibilityRole="header">
        {heading}
      </AppText>
      <TextField label="Squad name" value={name} onChangeText={setName} placeholder="e.g. Belfast Harriers U20" />
      <AppText variant="caption" color="textMuted">
        Your role in the squad
      </AppText>
      <OptionRow
        options={roles}
        selected={role}
        onSelect={(value) => setRole(value as StaffRole)}
        accessibilityLabel="Your role in the squad"
      />
      <Button label="Create squad" onPress={create} loading={busy} disabled={busy} />
      {result ? <InlineMessage kind={result.kind} text={result.text} /> : null}
    </Card>
  );
}

interface JoinSquadFormProps {
  api: Pick<ApiClient, 'joinSquad'>;
  onJoined: (squad: JoinedSquad) => void;
}

/** #2: join a squad as an athlete with its invite code. Invite codes only ever grant ATHLETE. */
export function JoinSquadForm({ api, onJoined }: JoinSquadFormProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function join() {
    const parsed = JoinSquadSchema.safeParse({ inviteCode: code });
    if (!parsed.success) {
      setResult({ kind: 'error', text: 'Invite codes are 8 letters and numbers.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const joined = await api.joinSquad(parsed.data.inviteCode);
      setResult({ kind: 'info', text: `Joined "${joined.squadName}" as an athlete.` });
      setCode('');
      onJoined(joined);
    } catch (error) {
      setResult({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card gap={10}>
      <AppText variant="heading" accessibilityRole="header">
        Join a squad as an athlete
      </AppText>
      <TextField
        label="Invite code"
        value={code}
        onChangeText={setCode}
        placeholder="ABCD2345"
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Button label="Join squad" variant="secondary" onPress={join} loading={busy} disabled={busy} />
      {result ? <InlineMessage kind={result.kind} text={result.text} /> : null}
    </Card>
  );
}
