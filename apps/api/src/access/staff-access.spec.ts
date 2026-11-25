import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { DataCategory, SquadRole } from '@loadwise/shared';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';
import { SquadAthletesController } from '../squad-athletes/squad-athletes.controller';
import { STAFF_ACCESS_CATEGORY_KEY } from './staff-access.guard';

// NFR 2.2: every staff data endpoint, for every role, against every access case, through the real
// AppModule (global auth guard, StaffAccessGuard, validation, controllers and services).
//
// The database is an in-memory fake that answers the membership queries by matching their `where`
// fields, so consent changes made through PUT /squads/:id/consent are seen by the next request.
// It does not prove real Postgres behaviour: transactions, row locks, constraints and the real
// query plans stay untested until PostgreSQL integration tests exist (issue log I-2).

const SQUAD_A = 'squad-a';
const SQUAD_B = 'squad-b';
const VIEWER = 'viewer';

interface FakeUser {
  id: string;
  firebaseUid: string;
  healthConsentAt: Date | null;
}

interface FakeMembership {
  id: string;
  userId: string;
  squadId: string;
  role: SquadRole;
  consentGiven: boolean;
}

const USERS: FakeUser[] = [
  { id: VIEWER, firebaseUid: 'fb-viewer', healthConsentAt: new Date('2026-11-20T10:00:00Z') },
  { id: 'ath-consented', firebaseUid: 'fb-ath-consented', healthConsentAt: new Date('2026-11-20T10:00:00Z') },
  { id: 'ath-withdrawn', firebaseUid: 'fb-ath-withdrawn', healthConsentAt: new Date('2026-11-20T10:00:00Z') },
];

const TOKENS: Record<string, string> = {
  'viewer-token': 'fb-viewer',
  'consented-token': 'fb-ath-consented',
  'withdrawn-token': 'fb-ath-withdrawn',
};

let memberships: FakeMembership[] = [];
let consentEvents: { membershipId: string; action: string }[] = [];

function matches(row: object, where: object): boolean {
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

const prisma = {
  user: {
    findUnique: jest.fn(({ where }: { where: { firebaseUid?: string; id?: string } }) =>
      Promise.resolve(USERS.find((u) => matches(u, where)) ?? null),
    ),
    create: jest.fn(),
  },
  membership: {
    findUnique: jest.fn(({ where }: { where: { userId_squadId: { userId: string; squadId: string } } }) =>
      Promise.resolve(memberships.find((m) => matches(m, where.userId_squadId)) ?? null),
    ),
    findFirst: jest.fn(({ where }: { where: Partial<FakeMembership> }) =>
      Promise.resolve(memberships.find((m) => matches(m, where)) ?? null),
    ),
    findMany: jest.fn(({ where }: { where: { squadId: string } }) =>
      Promise.resolve(
        memberships
          .filter((m) => m.squadId === where.squadId)
          .map((m) => ({ role: m.role, consentGiven: m.consentGiven, user: { id: m.userId, displayName: m.userId } })),
      ),
    ),
    updateMany: jest.fn(
      ({ where, data }: { where: Partial<FakeMembership>; data: { consentGiven: boolean } }) => {
        const rows = memberships.filter((m) => matches(m, where));
        rows.forEach((m) => (m.consentGiven = data.consentGiven));
        return Promise.resolve({ count: rows.length });
      },
    ),
  },
  consentEvent: {
    create: jest.fn(({ data }: { data: { membershipId: string; action: string } }) => {
      consentEvents.push(data);
      return Promise.resolve(data);
    }),
  },
  wellnessEntry: { findMany: jest.fn() },
  injury: { findMany: jest.fn(), create: jest.fn() },
  session: { findMany: jest.fn() },
};
// Added after the object exists, as the callback receives the fake client itself.
const fakeDb = {
  ...prisma,
  $transaction: jest.fn((work: (tx: typeof prisma) => Promise<unknown>) => work(prisma)),
};

const fakeVerifier: TokenVerifier = {
  verify: (token) => {
    const uid = TOKENS[token];
    return uid
      ? Promise.resolve({ uid, email: `${uid}@x.com` })
      : Promise.reject(new UnauthorizedException('Invalid token'));
  },
};

/** The viewer's membership of squad A (null: not a member), plus every kind of target athlete. */
function seed(viewerRole: SquadRole | null) {
  consentEvents = [];
  memberships = [
    { id: 'm-consented', userId: 'ath-consented', squadId: SQUAD_A, role: 'ATHLETE', consentGiven: true },
    { id: 'm-other', userId: 'ath-other-squad', squadId: SQUAD_B, role: 'ATHLETE', consentGiven: true },
    { id: 'm-withdrawn', userId: 'ath-withdrawn', squadId: SQUAD_A, role: 'ATHLETE', consentGiven: true },
    { id: 'm-never', userId: 'ath-never', squadId: SQUAD_A, role: 'ATHLETE', consentGiven: false },
    { id: 'm-colleague', userId: 'staff-colleague', squadId: SQUAD_A, role: 'COACH', consentGiven: false },
  ];
  if (viewerRole) {
    memberships.push({ id: 'm-viewer', userId: VIEWER, squadId: SQUAD_A, role: viewerRole, consentGiven: false });
  }
}

let app: INestApplication;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function withdraw(token: string, share = false) {
  await request(app.getHttpServer())
    .put(`/squads/${SQUAD_A}/consent`)
    .set(auth(token))
    .send({ share })
    .expect(200);
}

const VALID_INJURY = { bodyArea: 'Left hamstring', onsetDate: '2026-11-10' };

interface Endpoint {
  name: string;
  category: DataCategory;
  okStatus: number;
  call: (athleteId: string, headers: Record<string, string>) => request.Test;
  dataQuery: () => jest.Mock;
}

const ENDPOINTS: Endpoint[] = [
  {
    name: 'GET load',
    category: 'LOAD',
    okStatus: 200,
    call: (athleteId, headers) =>
      request(app.getHttpServer()).get(`/squads/${SQUAD_A}/athletes/${athleteId}/load`).set(headers),
    dataQuery: () => prisma.session.findMany,
  },
  {
    name: 'GET load-detail',
    category: 'LOAD_DETAIL',
    okStatus: 200,
    call: (athleteId, headers) =>
      request(app.getHttpServer()).get(`/squads/${SQUAD_A}/athletes/${athleteId}/load-detail`).set(headers),
    dataQuery: () => prisma.session.findMany,
  },
  {
    name: 'GET wellness',
    category: 'WELLNESS_SCORES',
    okStatus: 200,
    call: (athleteId, headers) =>
      request(app.getHttpServer()).get(`/squads/${SQUAD_A}/athletes/${athleteId}/wellness`).set(headers),
    dataQuery: () => prisma.wellnessEntry.findMany,
  },
  {
    name: 'GET injuries',
    category: 'INJURY',
    okStatus: 200,
    call: (athleteId, headers) =>
      request(app.getHttpServer()).get(`/squads/${SQUAD_A}/athletes/${athleteId}/injuries`).set(headers),
    dataQuery: () => prisma.injury.findMany,
  },
  {
    name: 'POST injuries',
    category: 'INJURY',
    okStatus: 201,
    call: (athleteId, headers) =>
      request(app.getHttpServer())
        .post(`/squads/${SQUAD_A}/athletes/${athleteId}/injuries`)
        .set(headers)
        .send(VALID_INJURY),
    dataQuery: () => prisma.injury.create,
  },
];

/** Hand-written from Peter's #11 matrix, independent of the policy code under test. */
const ALLOWED_ROLES: Record<DataCategory, SquadRole[]> = {
  LOAD: ['COACH', 'SC_COACH', 'PHYSIO'],
  LOAD_DETAIL: ['SC_COACH', 'PHYSIO'],
  FLAGS: ['COACH', 'SC_COACH', 'PHYSIO'],
  WELLNESS_STATUS: ['COACH', 'SC_COACH', 'PHYSIO'],
  WELLNESS_SCORES: ['SC_COACH', 'PHYSIO'],
  INJURY: ['PHYSIO'],
};

type Outcome = 'role-decides' | 403 | 404 | 401;

interface Scenario {
  name: string;
  athleteId: string;
  viewerInSquad: boolean;
  signedIn: boolean;
  outcome: Outcome;
  prepare?: () => Promise<void>;
}

const SCENARIOS: Scenario[] = [
  { name: 'a consenting athlete in my squad', athleteId: 'ath-consented', viewerInSquad: true, signedIn: true, outcome: 'role-decides' },
  { name: 'an athlete in another squad', athleteId: 'ath-other-squad', viewerInSquad: true, signedIn: true, outcome: 403 },
  {
    name: 'an athlete who withdrew consent',
    athleteId: 'ath-withdrawn',
    viewerInSquad: true,
    signedIn: true,
    outcome: 403,
    prepare: () => withdraw('withdrawn-token'),
  },
  { name: 'an athlete who never consented', athleteId: 'ath-never', viewerInSquad: true, signedIn: true, outcome: 403 },
  { name: 'a staff member, not an athlete', athleteId: 'staff-colleague', viewerInSquad: true, signedIn: true, outcome: 403 },
  { name: 'any athlete, when I am not in the squad', athleteId: 'ath-consented', viewerInSquad: false, signedIn: true, outcome: 404 },
  { name: 'any athlete, when I am not signed in', athleteId: 'ath-consented', viewerInSquad: true, signedIn: false, outcome: 401 },
];

const ROLES: SquadRole[] = ['ATHLETE', 'COACH', 'SC_COACH', 'PHYSIO'];

const MATRIX = ROLES.flatMap((role) =>
  ENDPOINTS.flatMap((endpoint) =>
    SCENARIOS.map((scenario) => {
      const expected =
        scenario.outcome === 'role-decides'
          ? ALLOWED_ROLES[endpoint.category].includes(role)
            ? endpoint.okStatus
            : 403
          : scenario.outcome;
      return [role, endpoint.name, scenario.name, expected, endpoint, scenario] as const;
    }),
  ),
);

describe('NFR2: role-based access (#11 AC3)', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakeDb)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.wellnessEntry.findMany.mockResolvedValue([
      { date: new Date('2026-11-24T00:00:00Z'), sleep: 4, soreness: 2, fatigue: 3, stress: 4 },
    ]);
    prisma.injury.findMany.mockResolvedValue([]);
    prisma.session.findMany.mockResolvedValue([]);
    prisma.injury.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'inj-1', ...data }),
    );
  });

  describe('staff data endpoints: every role × endpoint × access case', () => {
    it.each(MATRIX)('%s → %s for %s: %i', async (role, _endpoint, _scenario, expected, endpoint, scenario) => {
      seed(scenario.viewerInSquad ? role : null);
      await scenario.prepare?.();

      const res = await endpoint.call(scenario.athleteId, scenario.signedIn ? auth('viewer-token') : {});

      expect(res.status).toBe(expected);
      if (expected === endpoint.okStatus) {
        expect(endpoint.dataQuery()).toHaveBeenCalledTimes(1);
        expect(endpoint.dataQuery().mock.calls[0][0]).toMatchObject(
          endpoint.name === 'POST injuries'
            ? { data: { athleteId: scenario.athleteId } }
            : { where: { athleteId: scenario.athleteId } },
        );
      } else {
        // A refused request never reaches the data, and the reason names no one.
        expect(endpoint.dataQuery()).not.toHaveBeenCalled();
        expect(JSON.stringify(res.body)).not.toContain(scenario.athleteId);
        expect(Object.keys(res.body).sort()).toEqual(['error', 'message', 'statusCode']);
      }
    });
  });

  describe('GET /squads/:squadId/members: every role × access case (#2 AC3)', () => {
    it.each([
      ['ATHLETE', 403],
      ['COACH', 200],
      ['SC_COACH', 200],
      ['PHYSIO', 200],
    ] as const)('%s in the squad: %i', async (role, expected) => {
      seed(role);

      await request(app.getHttpServer()).get(`/squads/${SQUAD_A}/members`).set(auth('viewer-token')).expect(expected);
    });

    it.each(ROLES)('%s in another squad only: 404', async (role) => {
      seed(null);
      memberships.push({ id: 'm-viewer-b', userId: VIEWER, squadId: SQUAD_B, role, consentGiven: false });

      await request(app.getHttpServer()).get(`/squads/${SQUAD_A}/members`).set(auth('viewer-token')).expect(404);
    });

    it('not signed in: 401', async () => {
      seed('COACH');

      await request(app.getHttpServer()).get(`/squads/${SQUAD_A}/members`).expect(401);
    });
  });

  describe('consent takes effect on the next request (#3 AC2, AC3)', () => {
    const wellness = () =>
      request(app.getHttpServer())
        .get(`/squads/${SQUAD_A}/athletes/ath-consented/wellness`)
        .set(auth('viewer-token'));

    it('removes access on the very next request after withdrawal, and restores it on re-grant', async () => {
      seed('PHYSIO');

      await wellness().expect(200);
      await withdraw('consented-token');
      await wellness().expect(403);
      await withdraw('consented-token', true);
      await wellness().expect(200);

      expect(consentEvents).toEqual([
        { membershipId: 'm-consented', action: 'WITHDRAWN' },
        { membershipId: 'm-consented', action: 'GRANTED' },
      ]);
      // One fresh consent lookup per request: nothing is cached between requests.
      expect(prisma.membership.findFirst).toHaveBeenCalledTimes(3);
    });

    it('withdrawing from one squad leaves sharing with another squad untouched (#3 AC1)', async () => {
      seed(null);
      memberships.push(
        { id: 'm-viewer-b', userId: VIEWER, squadId: SQUAD_B, role: 'PHYSIO', consentGiven: false },
        { id: 'm-consented-b', userId: 'ath-consented', squadId: SQUAD_B, role: 'ATHLETE', consentGiven: true },
      );

      await withdraw('consented-token');

      await request(app.getHttpServer())
        .get(`/squads/${SQUAD_B}/athletes/ath-consented/wellness`)
        .set(auth('viewer-token'))
        .expect(200);
      expect(memberships.find((m) => m.id === 'm-consented')?.consentGiven).toBe(false);
    });

    it('a staff member in two squads sees an athlete only through the squad the athlete shares with', async () => {
      seed('PHYSIO');
      memberships.push(
        { id: 'm-viewer-b', userId: VIEWER, squadId: SQUAD_B, role: 'PHYSIO', consentGiven: false },
        { id: 'm-never-b', userId: 'ath-never', squadId: SQUAD_B, role: 'ATHLETE', consentGiven: true },
      );

      await request(app.getHttpServer())
        .get(`/squads/${SQUAD_A}/athletes/ath-never/wellness`)
        .set(auth('viewer-token'))
        .expect(403);
      await request(app.getHttpServer())
        .get(`/squads/${SQUAD_B}/athletes/ath-never/wellness`)
        .set(auth('viewer-token'))
        .expect(200);
    });
  });

  describe('order of checks', () => {
    it('refuses a role without access before validating the body, so it learns nothing (403, not 400)', async () => {
      seed('COACH');

      await request(app.getHttpServer())
        .post(`/squads/${SQUAD_A}/athletes/ath-consented/injuries`)
        .set(auth('viewer-token'))
        .send({})
        .expect(403);
    });

    it('checks the role before looking up the athlete, so a coach cannot probe who shares data', async () => {
      seed('COACH');

      await request(app.getHttpServer())
        .get(`/squads/${SQUAD_A}/athletes/ath-never/injuries`)
        .set(auth('viewer-token'))
        .expect(403);
      expect(prisma.membership.findFirst).not.toHaveBeenCalled();
    });

    it('gives the same message for not in squad, not an athlete and not sharing', async () => {
      seed('PHYSIO');
      const messages = new Set<string>();
      for (const athleteId of ['ath-other-squad', 'ath-never', 'staff-colleague', 'no-such-user']) {
        const res = await request(app.getHttpServer())
          .get(`/squads/${SQUAD_A}/athletes/${athleteId}/wellness`)
          .set(auth('viewer-token'))
          .expect(403);
        messages.add(res.body.message);
      }
      expect([...messages]).toEqual(['You do not have access to this athlete’s data']);
    });
  });

  describe('every route on the staff athlete controller is protected', () => {
    it('declares a data category on each handler', () => {
      const reflector = new Reflector();
      const handlers = Object.getOwnPropertyNames(SquadAthletesController.prototype).filter(
        (name) => name !== 'constructor',
      );
      expect(handlers.length).toBeGreaterThan(0);
      for (const name of handlers) {
        const handler = SquadAthletesController.prototype[name as keyof SquadAthletesController];
        expect([name, reflector.get(STAFF_ACCESS_CATEGORY_KEY, handler)]).toEqual([name, expect.any(String)]);
      }
    });
  });
});
