import { HEALTH_DATA_NOTICE_VERSION } from '@loadwise/shared';
import { ApiError, createApiClient } from './api';

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function clientReturning(response: Response | Error) {
  const fetchFn = jest.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const client = createApiClient({
    baseUrl: 'http://api.test',
    getIdToken: async () => 'id-token',
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  return { client, fetchFn };
}

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
  }
  throw new Error('expected an ApiError');
}

describe('FR4: app API client (#2)', () => {
  it('sends the Firebase ID token as a Bearer token', async () => {
    const squad = { id: 's1', name: 'Harriers', inviteCode: 'ABCD2345', role: 'COACH' };
    const { client, fetchFn } = clientReturning(jsonResponse(201, squad));

    await expect(client.createSquad({ name: 'Harriers', role: 'COACH' })).resolves.toEqual(squad);
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/squads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer id-token' },
      body: JSON.stringify({ name: 'Harriers', role: 'COACH' }),
    });
  });

  it('calls /health without a token', async () => {
    const { client, fetchFn } = clientReturning(jsonResponse(200, { status: 'ok' }));

    await client.health();
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/health',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it("shows the API's own message for not-found and conflict errors", async () => {
    const { client } = clientReturning(jsonResponse(409, { message: 'You are already in this squad' }));

    const error = await caught(client.joinSquad('ABCD2345'));
    expect(error.status).toBe(409);
    expect(error.message).toBe('You are already in this squad');
  });

  it('shows the first validation issue for a 400', async () => {
    const { client } = clientReturning(
      jsonResponse(400, { message: 'Validation failed', issues: [{ path: 'inviteCode', message: 'Invalid invite code' }] }),
    );

    expect((await caught(client.joinSquad('nope'))).message).toBe('Invalid invite code');
  });

  it('asks the user to sign in again on 401', async () => {
    const { client } = clientReturning(jsonResponse(401, { message: 'Invalid or expired sign-in token' }));

    expect((await caught(client.joinSquad('ABCD2345'))).message).toBe('Your sign-in has expired. Sign in again.');
  });

  it('never shows server error text for other failures', async () => {
    const { client } = clientReturning(jsonResponse(500, { message: 'stack trace or database detail' }));

    expect((await caught(client.joinSquad('ABCD2345'))).message).toBe('Something went wrong. Try again.');
  });

  it('reports an unreachable API with status 0', async () => {
    const { client } = clientReturning(new TypeError('Failed to fetch'));

    const error = await caught(client.health());
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Can't reach the LoadWise API/);
  });
});

describe('NFR2: health-data consent calls (#1 AC4)', () => {
  const me = {
    id: 'u1',
    email: 'athlete@example.com',
    displayName: null,
    healthConsentGiven: false,
    healthConsentAt: null,
  };

  it('reads the signed-in user from GET /me with the token', async () => {
    const { client, fetchFn } = clientReturning(jsonResponse(200, me));

    await expect(client.me()).resolves.toEqual(me);
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/me', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer id-token' },
      body: undefined,
    });
  });

  it('records consent with the notice version the app shows', async () => {
    const given = { ...me, healthConsentGiven: true, healthConsentAt: '2026-11-20T09:00:00.000Z' };
    const { client, fetchFn } = clientReturning(jsonResponse(200, given));

    await expect(client.giveHealthConsent()).resolves.toEqual(given);
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/me/health-consent',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ noticeVersion: HEALTH_DATA_NOTICE_VERSION }) }),
    );
  });

  it("shows the API's message when consent is missing (403)", async () => {
    const { client } = clientReturning(
      jsonResponse(403, { statusCode: 403, error: 'Forbidden', message: 'Give consent first.' }),
    );

    const error = await caught(client.me());
    expect(error.status).toBe(403);
    expect(error.message).toBe('Give consent first.');
  });
});

describe('FR1: wellness check call (#5)', () => {
  const check = { date: '2026-11-20', sleep: 4, soreness: 2, fatigue: 3, stress: 5 };

  it('posts the check-in with the token', async () => {
    const { client, fetchFn } = clientReturning(jsonResponse(201, { id: 'w1', ...check }));

    await expect(client.saveWellness(check)).resolves.toEqual({ id: 'w1', ...check });
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/wellness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer id-token' },
      body: JSON.stringify(check),
    });
  });

  it("shows the API's message for a second check-in on the same day (409)", async () => {
    const { client } = clientReturning(
      jsonResponse(409, { statusCode: 409, error: 'Conflict', message: 'You have already checked in today' }),
    );

    expect((await caught(client.saveWellness(check))).message).toBe('You have already checked in today');
  });
});

describe('FR1: session calls (#4)', () => {
  const session = { type: 'TRAINING' as const, date: '2026-11-20', durationMinutes: 60, rpe: 7 };

  it('posts a session with the token', async () => {
    const { client, fetchFn } = clientReturning(jsonResponse(201, { id: 's1', ...session, load: 420 }));

    await expect(client.logSession(session)).resolves.toEqual({ id: 's1', ...session, load: 420 });
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer id-token' },
      body: JSON.stringify(session),
    });
  });

  it('reads recent sessions from GET /sessions', async () => {
    const list = [{ id: 's1', ...session, load: 420 }];
    const { client, fetchFn } = clientReturning(jsonResponse(200, list));

    await expect(client.recentSessions()).resolves.toEqual(list);
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/sessions', expect.objectContaining({ method: 'GET' }));
  });

  it('asks for fewer sessions when a limit is given', async () => {
    const { client, fetchFn } = clientReturning(jsonResponse(200, []));

    await expect(client.recentSessions(1)).resolves.toEqual([]);
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/sessions?limit=1', expect.objectContaining({ method: 'GET' }));
  });
});

describe('FR4: squad list calls (#2 AC3)', () => {
  it('reads the caller’s squads from GET /squads', async () => {
    const squads = [{ squadId: 's1', squadName: 'Harriers', role: 'ATHLETE', consentGiven: false }];
    const { client, fetchFn } = clientReturning(jsonResponse(200, squads));

    await expect(client.mySquads()).resolves.toEqual(squads);
    expect(fetchFn).toHaveBeenCalledWith('http://api.test/squads', expect.objectContaining({ method: 'GET' }));
  });

  it('encodes the squad id in the members path', async () => {
    const { client, fetchFn } = clientReturning(jsonResponse(200, []));

    await client.squadMembers('a/b?c');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/squads/a%2Fb%3Fc/members',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
