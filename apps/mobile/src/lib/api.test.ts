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
