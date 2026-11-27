import { STAFF_DATA_ACCESS, DATA_CATEGORIES } from '@loadwise/shared';
import type { SquadRole } from '@loadwise/shared';
import { createApiClient, MySquad } from './api';
import { roleInSquad, viewerCanSee } from './viewer-role';

const squads: MySquad[] = [
  { squadId: 'sq-1', squadName: 'Harriers', role: 'PHYSIO', inviteCode: 'ABCD2345' },
  { squadId: 'sq-2', squadName: 'Seconds', role: 'ATHLETE', consentGiven: true },
];

describe('NFR2 #51: the viewer’s role in a squad', () => {
  it('reads the role for the squad on screen', () => {
    expect(roleInSquad(squads, 'sq-1')).toBe('PHYSIO');
    expect(roleInSquad(squads, 'sq-2')).toBe('ATHLETE');
  });

  it('gives null for a squad the viewer is not in', () => {
    expect(roleInSquad(squads, 'sq-9')).toBeNull();
    expect(roleInSquad([], 'sq-1')).toBeNull();
  });
});

describe('NFR2 #51: the screen asks only for what the role may see (DL-022)', () => {
  const roles: SquadRole[] = ['ATHLETE', 'COACH', 'SC_COACH', 'PHYSIO'];

  it.each(roles.flatMap((role) => DATA_CATEGORIES.map((category) => [role, category] as const)))(
    '%s and %s follow the shared matrix the API enforces',
    (role, category) => {
      expect(viewerCanSee(role, category)).toBe(STAFF_DATA_ACCESS[role].includes(category));
    },
  );

  it('matches the rows #51 depends on', () => {
    expect(viewerCanSee('COACH', 'LOAD_DETAIL')).toBe(false);
    expect(viewerCanSee('COACH', 'WELLNESS_SCORES')).toBe(false);
    expect(viewerCanSee('SC_COACH', 'LOAD_DETAIL')).toBe(true);
    expect(viewerCanSee('SC_COACH', 'WELLNESS_SCORES')).toBe(true);
    expect(viewerCanSee('PHYSIO', 'LOAD_DETAIL')).toBe(true);
    expect(viewerCanSee('PHYSIO', 'WELLNESS_SCORES')).toBe(true);
  });

  it('fails closed when the role is unknown', () => {
    for (const category of DATA_CATEGORIES) expect(viewerCanSee(null, category)).toBe(false);
  });
});

describe('FR4 #51: athlete detail API calls', () => {
  function client() {
    const fetchFn = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response);
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getIdToken: async () => 'id-token',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    return { api, fetchFn };
  }

  it('reads monotony and strain from load-detail, encoding both ids', async () => {
    const { api, fetchFn } = client();
    await api.athleteLoadDetail('sq/1', 'a?1');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/squads/sq%2F1/athletes/a%3F1/load-detail',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('reads wellness scores from the wellness route, encoding both ids', async () => {
    const { api, fetchFn } = client();
    await api.athleteWellness('sq/1', 'a?1');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/squads/sq%2F1/athletes/a%3F1/wellness',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
