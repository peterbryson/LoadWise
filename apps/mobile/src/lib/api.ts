import { HEALTH_DATA_NOTICE_VERSION } from '@loadwise/shared';
import type {
  CreatedTeamSession,
  CreateSquad,
  CreateTeamSession,
  LoadDetail,
  InjuryRecord,
  LoadTotals,
  MyLoad,
  RecordInjury,
  RecordRestriction,
  SessionLog,
  SquadOverview,
  StaffRole,
  RateTeamSession,
  TeamSessionToRate,
  TrainingRestriction,
  WellnessCheck,
} from '@loadwise/shared';
import type { Flag, FlagChecks, WellnessTrendPoint } from '@loadwise/analytics';

/** An API failure with a message that is safe to show on screen. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CreatedSquad {
  id: string;
  name: string;
  inviteCode: string;
  role: StaffRole;
}

export interface JoinedSquad {
  squadId: string;
  squadName: string;
  role: 'ATHLETE';
}

/** One of the caller's squads, from `GET /squads`. Only staff get the invite code. */
export type MySquad =
  | { squadId: string; squadName: string; role: 'ATHLETE'; consentGiven: boolean }
  | { squadId: string; squadName: string; role: StaffRole; inviteCode: string };

/** A squad member, from `GET /squads/:squadId/members` (staff only). No health data. */
export type SquadMember =
  | { userId: string; displayName: string; role: 'ATHLETE'; consentGiven: boolean }
  | { userId: string; displayName: string; role: StaffRole };

/** #49: a squad's invite code, for its staff. Only a COACH may replace it (`canReplace`). */
export interface SquadInvite {
  squadId: string;
  squadName: string;
  inviteCode: string;
  canReplace: boolean;
}

/** The athlete's sharing state for one squad, from `PUT /squads/:squadId/consent`. */
export interface SquadConsentState {
  squadId: string;
  consentGiven: boolean;
}

/** The signed-in user, from `GET /me`. */
export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  healthConsentGiven: boolean;
  healthConsentAt: string | null;
}

/** A saved wellness check, from `POST /wellness`. */
export interface SavedWellness extends Omit<WellnessCheck, 'clientId'> {
  id: string;
  /** #6: the key the app sent, or null if it was saved without one. */
  clientId: string | null;
}

/** Today's check-in, from `GET /wellness/today` (#45). `entry` is null until the athlete checks in. */
export interface TodayWellness {
  /** The Europe/London day the API counts as today. */
  date: string;
  entry: SavedWellness | null;
}

/** A saved session, from `POST /sessions` and `GET /sessions`. `load` is RPE × minutes (AU). */
export interface SavedSession extends Omit<SessionLog, 'clientId'> {
  id: string;
  load: number;
  /** #6: the key the app sent, so a synced session can be matched to its queued copy. */
  clientId: string | null;
}

/** Today's flags from the deterministic engine, from `GET /me/flags` (#9). */
export interface CurrentFlags {
  date: string;
  flags: Flag[];
  /** Which rules ran. No flags is only an all-clear when both are 'checked'. */
  checks: FlagChecks;
  baselineCheckIns: number;
  minCheckIns: number;
}

/** 7-day wellness averages against the athlete's baseline, from `GET /me/wellness-trend` (#9 AC3). */
export interface WellnessTrend {
  date: string;
  baselineCheckIns: number;
  minCheckIns: number;
  /** Oldest first; the last week ends today. */
  weeks: WellnessTrendPoint[];
}

/** #51: one wellness check-in as staff with WELLNESS_SCORES see it. Scores are 1 (worst) to 5 (best). */
export interface StaffWellnessEntry {
  /** YYYY-MM-DD. */
  date: string;
  sleep: number;
  soreness: number;
  fatigue: number;
  stress: number;
}

interface ApiClientOptions {
  baseUrl: string;
  getIdToken: () => Promise<string>;
  fetchFn?: typeof fetch;
}

/** The API's error body: Nest's standard shape, plus `issues` from the Zod validation pipe. */
interface ErrorBody {
  message?: unknown;
  issues?: { path: string; message: string }[];
}

async function readError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as ErrorBody;
  if (response.status === 401) {
    return new ApiError(401, 'Your sign-in has expired. Sign in again.');
  }
  if (response.status === 400 && body.issues?.length) {
    return new ApiError(400, body.issues[0].message);
  }
  // 403, 404 and 409 messages come from the API and contain no personal data, e.g. "You are
  // already in this squad". Anything else gets a generic message.
  if ([403, 404, 409].includes(response.status) && typeof body.message === 'string') {
    return new ApiError(response.status, body.message);
  }
  return new ApiError(response.status, 'Something went wrong. Try again.');
}

export function createApiClient({ baseUrl, getIdToken, fetchFn = fetch }: ApiClientOptions) {
  async function request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, signedIn = true): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signedIn) headers.Authorization = `Bearer ${await getIdToken()}`;

    let response: Response;
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "Can't reach the LoadWise API. Check it is running and try again.");
    }
    if (!response.ok) throw await readError(response);
    return (await response.json()) as T;
  }

  return {
    health: () => request<{ status: string }>('GET', '/health', undefined, false),
    createSquad: (input: CreateSquad) => request<CreatedSquad>('POST', '/squads', input),
    joinSquad: (inviteCode: string) => request<JoinedSquad>('POST', '/squads/join', { inviteCode }),
    /** #2 AC3: every squad the signed-in user belongs to. */
    mySquads: () => request<MySquad[]>('GET', '/squads'),
    /** #2 AC3: a squad's members. 403 for athletes, 404 if the caller is not in the squad. */
    squadMembers: (squadId: string) =>
      request<SquadMember[]>('GET', `/squads/${encodeURIComponent(squadId)}/members`),
    /** #49 AC1: the squad's current invite code. 403 for athletes, 404 if the caller is not in the squad. */
    squadInvite: (squadId: string) =>
      request<SquadInvite>('GET', `/squads/${encodeURIComponent(squadId)}/invite-code`),
    /** #49 AC3: a coach replaces the squad's invite code; the old code stops joining the squad. */
    replaceInviteCode: (squadId: string) =>
      request<SquadInvite>('POST', `/squads/${encodeURIComponent(squadId)}/invite-code`),
    /** #3: start or stop sharing the athlete's data with one squad. Repeating a request changes nothing. */
    setSquadConsent: (squadId: string, share: boolean) =>
      request<SquadConsentState>('PUT', `/squads/${encodeURIComponent(squadId)}/consent`, { share }),
    me: () => request<Me>('GET', '/me'),
    /** #1 AC4: records consent to the notice version this app shows at setup. */
    giveHealthConsent: () =>
      request<Me>('POST', '/me/health-consent', { noticeVersion: HEALTH_DATA_NOTICE_VERSION }),
    /** #5: the daily wellness check. 409 if today's check-in is already saved; 200 for a replayed clientId (#6). */
    saveWellness: (input: WellnessCheck) => request<SavedWellness>('POST', '/wellness', input),
    /** #45: whether the athlete has checked in today, for the check-in card on Today. */
    wellnessToday: () => request<TodayWellness>('GET', '/wellness/today'),
    /** #4: log a training session or match. 200 instead of 201 for a replayed clientId (#6). */
    logSession: (input: SessionLog) => request<SavedSession>('POST', '/sessions', input),
    /** #4 AC3, AC4: the athlete's recent sessions, newest first. The API returns 20 unless `limit` (1 to 50) is given. */
    recentSessions: (limit?: number) =>
      request<SavedSession[]>('GET', limit === undefined ? '/sessions' : `/sessions?limit=${limit}`),
    /** #7 AC3: weekly load for the last 6 weeks and ACWR, calculated by the API from the athlete's sessions. */
    myLoad: () => request<MyLoad>('GET', '/me/load'),
    /** #10: every athlete in a squad with today's status, flags and combined load, for its staff. */
    squadOverview: (squadId: string) =>
      request<SquadOverview>('GET', `/squads/${encodeURIComponent(squadId)}/overview`),
    /** #8 AC2: a consenting athlete's combined weekly load and ACWR, for staff of the squad. */
    athleteLoad: (squadId: string, athleteId: string) =>
      request<LoadTotals>(
        'GET',
        `/squads/${encodeURIComponent(squadId)}/athletes/${encodeURIComponent(athleteId)}/load`,
      ),
    /** #51 (I-28): monotony and strain from the athlete's combined sessions. S&C coaches and physios only. */
    athleteLoadDetail: (squadId: string, athleteId: string) =>
      request<LoadDetail>(
        'GET',
        `/squads/${encodeURIComponent(squadId)}/athletes/${encodeURIComponent(athleteId)}/load-detail`,
      ),
    /** #51: the athlete's last 28 wellness check-ins, newest first. Roles with WELLNESS_SCORES only. */
    athleteWellness: (squadId: string, athleteId: string) =>
      request<StaffWellnessEntry[]>(
        'GET',
        `/squads/${encodeURIComponent(squadId)}/athletes/${encodeURIComponent(athleteId)}/wellness`,
      ),
    /** #9: today's flags, each with its reason, value and threshold. */
    myFlags: () => request<CurrentFlags>('GET', '/me/flags'),
    /** #9 AC3: wellness 7-day averages against baseline for the Trends tab. */
    myWellnessTrend: () => request<WellnessTrend>('GET', '/me/wellness-trend'),
    /** #17 AC1: a coach or S&C coach logs a team session once for the squad. */
    createTeamSession: (squadId: string, input: CreateTeamSession) =>
      request<CreatedTeamSession>('POST', `/squads/${encodeURIComponent(squadId)}/team-sessions`, input),
    /** #17 AC2: team sessions from the athlete's squads that they have not yet added an RPE to. */
    teamSessionsToRate: () => request<TeamSessionToRate[]>('GET', '/team-sessions/to-rate'),
    /** #17 AC2: the athlete's RPE for a team session, saved as their own session. 409 if already rated. */
    rateTeamSession: (teamSessionId: string, input: RateTeamSession) =>
      request<SavedSession>('POST', `/team-sessions/${encodeURIComponent(teamSessionId)}/rating`, input),
    /** #21: injuries recorded in this squad. Physio only. */
    athleteInjuries: (squadId: string, athleteId: string) =>
      request<InjuryRecord[]>('GET', `${athletePath(squadId, athleteId)}/injuries`),
    /** #21 AC1: a physio records an injury for this athlete in this squad. */
    recordInjury: (squadId: string, athleteId: string, input: RecordInjury) =>
      request<InjuryRecord>('POST', `${athletePath(squadId, athleteId)}/injuries`, input),
    /** #21 AC2: active training restrictions, for every staff role in the squad. */
    athleteRestrictions: (squadId: string, athleteId: string) =>
      request<TrainingRestriction[]>('GET', `${athletePath(squadId, athleteId)}/restrictions`),
    /** #21 AC1: a physio sets a restriction that the squad's coaches will see. */
    addRestriction: (squadId: string, athleteId: string, input: RecordRestriction) =>
      request<TrainingRestriction>('POST', `${athletePath(squadId, athleteId)}/restrictions`, input),
    /** #21: a physio ends a restriction. Repeating it changes nothing. */
    endRestriction: (squadId: string, athleteId: string, restrictionId: string) =>
      request<TrainingRestriction>(
        'POST',
        `${athletePath(squadId, athleteId)}/restrictions/${encodeURIComponent(restrictionId)}/end`,
      ),
  };
}

function athletePath(squadId: string, athleteId: string): string {
  return `/squads/${encodeURIComponent(squadId)}/athletes/${encodeURIComponent(athleteId)}`;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
