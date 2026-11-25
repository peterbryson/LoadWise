import { HEALTH_DATA_NOTICE_VERSION } from '@loadwise/shared';
import type { CreateSquad, SessionLog, StaffRole, WellnessCheck } from '@loadwise/shared';

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
export interface SavedWellness extends WellnessCheck {
  id: string;
}

/** A saved session, from `POST /sessions` and `GET /sessions`. `load` is RPE × minutes (AU). */
export interface SavedSession extends SessionLog {
  id: string;
  load: number;
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
    /** #3: start or stop sharing the athlete's data with one squad. Repeating a request changes nothing. */
    setSquadConsent: (squadId: string, share: boolean) =>
      request<SquadConsentState>('PUT', `/squads/${encodeURIComponent(squadId)}/consent`, { share }),
    me: () => request<Me>('GET', '/me'),
    /** #1 AC4: records consent to the notice version this app shows at setup. */
    giveHealthConsent: () =>
      request<Me>('POST', '/me/health-consent', { noticeVersion: HEALTH_DATA_NOTICE_VERSION }),
    /** #5: the daily wellness check. 409 if today's check-in is already saved. */
    saveWellness: (input: WellnessCheck) => request<SavedWellness>('POST', '/wellness', input),
    /** #4: log a training session or match. */
    logSession: (input: SessionLog) => request<SavedSession>('POST', '/sessions', input),
    /** #4 AC3, AC4: the athlete's recent sessions, newest first. The API returns 20 unless `limit` (1 to 50) is given. */
    recentSessions: (limit?: number) =>
      request<SavedSession[]>('GET', limit === undefined ? '/sessions' : `/sessions?limit=${limit}`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
