import type { CreateSquad, StaffRole } from '@loadwise/shared';

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
  // 404 and 409 messages come from the API and contain no personal data, e.g. "You are
  // already in this squad". Anything else gets a generic message.
  if ((response.status === 404 || response.status === 409) && typeof body.message === 'string') {
    return new ApiError(response.status, body.message);
  }
  return new ApiError(response.status, 'Something went wrong. Try again.');
}

export function createApiClient({ baseUrl, getIdToken, fetchFn = fetch }: ApiClientOptions) {
  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, signedIn = true): Promise<T> {
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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
