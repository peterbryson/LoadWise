import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SquadRole } from '@loadwise/shared';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';

// #48 AC2: health-data consent belongs to logging your own health data, not to having an account.
// A staff-only user (no health-data consent) must be able to use every staff route, while every
// route that reads or writes their own health data still returns 403.
//
// Runs through the real AppModule with an in-memory fake database, like staff-access.spec.ts, so it
// does not prove real Postgres behaviour (issue log I-2).

const SQUAD = 'squad-a';
const COACH = 'coach-no-consent';
const ATHLETE = 'athlete-sharing';

interface FakeMembership {
  userId: string;
  squadId: string;
  role: SquadRole;
  consentGiven: boolean;
}

const USERS = [
  { id: COACH, firebaseUid: 'fb-coach', email: 'coach@example.com', displayName: 'Coach', healthConsentAt: null },
  { id: ATHLETE, firebaseUid: 'fb-athlete', email: 'athlete@example.com', displayName: 'Athlete', healthConsentAt: new Date('2026-11-20T10:00:00Z') },
];

let memberships: FakeMembership[] = [];

function matches(row: object, where: object): boolean {
  return Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

function withUser(m: FakeMembership) {
  const user = USERS.find((u) => u.id === m.userId);
  return {
    role: m.role,
    consentGiven: m.consentGiven,
    user: { id: m.userId, displayName: user?.displayName ?? m.userId },
    squad: { id: m.squadId, name: 'U20s', inviteCode: 'ABCD2345' },
  };
}

const prisma = {
  user: {
    findUnique: jest.fn(({ where }: { where: { firebaseUid?: string; id?: string } }) =>
      Promise.resolve(USERS.find((u) => matches(u, where)) ?? null),
    ),
    findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(USERS.find((u) => u.id === where.id)),
    ),
    create: jest.fn(),
  },
  squad: {
    findUnique: jest.fn(() => Promise.resolve({ id: SQUAD, name: 'U20s', inviteCode: 'ABCD2345' })),
    create: jest.fn(({ data }: { data: { name: string; inviteCode: string } }) =>
      Promise.resolve({ id: 'squad-new', name: data.name, inviteCode: data.inviteCode }),
    ),
  },
  membership: {
    findUnique: jest.fn(({ where }: { where: { userId_squadId: { userId: string; squadId: string } } }) =>
      Promise.resolve(memberships.find((m) => matches(m, where.userId_squadId)) ?? null),
    ),
    findFirst: jest.fn(({ where }: { where: Partial<FakeMembership> }) =>
      Promise.resolve(memberships.find((m) => matches(m, where)) ?? null),
    ),
    findMany: jest.fn(({ where }: { where: Partial<FakeMembership> }) =>
      Promise.resolve(memberships.filter((m) => matches(m, where)).map(withUser)),
    ),
    updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
  },
  consentEvent: { create: jest.fn() },
  session: { findMany: jest.fn(() => Promise.resolve([])), create: jest.fn() },
  wellnessEntry: { findMany: jest.fn(() => Promise.resolve([])), create: jest.fn() },
  injury: { findMany: jest.fn(() => Promise.resolve([])), create: jest.fn() },
};
const fakeDb = {
  ...prisma,
  $transaction: jest.fn((work: (tx: typeof prisma) => Promise<unknown>) => work(prisma)),
};

const TOKENS: Record<string, string> = { 'coach-token': 'fb-coach' };

const fakeVerifier: TokenVerifier = {
  verify: (token) => {
    const uid = TOKENS[token];
    return uid
      ? Promise.resolve({ uid, email: `${uid}@example.com` })
      : Promise.reject(new UnauthorizedException('Invalid token'));
  },
};

let app: INestApplication;
const asCoach = { Authorization: 'Bearer coach-token' };
const server = () => request(app.getHttpServer());

describe('NFR2 #48 AC2: a staff-only user without health-data consent', () => {
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
    memberships = [
      { userId: COACH, squadId: SQUAD, role: 'COACH', consentGiven: false },
      { userId: ATHLETE, squadId: SQUAD, role: 'ATHLETE', consentGiven: true },
    ];
  });

  describe('can use the staff routes', () => {
    it('reads their own account, which reports no health-data consent', async () => {
      const res = await server().get('/me').set(asCoach).expect(200);
      expect(res.body.healthConsentGiven).toBe(false);
    });

    it('lists their squads', async () => {
      const res = await server().get('/squads').set(asCoach).expect(200);
      expect(res.body).toEqual([{ squadId: SQUAD, squadName: 'U20s', role: 'COACH', inviteCode: 'ABCD2345' }]);
    });

    it('creates a squad as staff', async () => {
      const res = await server().post('/squads').set(asCoach).send({ name: 'Seniors', role: 'PHYSIO' }).expect(201);
      expect(res.body).toMatchObject({ name: 'Seniors', role: 'PHYSIO' });
    });

    it('rejects an invalid squad with 400, not a consent error', async () => {
      const res = await server().post('/squads').set(asCoach).send({ name: 'x', role: 'ATHLETE' }).expect(400);
      expect(JSON.stringify(res.body)).not.toMatch(/health-data/);
    });

    it('lists the members of their squad', async () => {
      await server().get(`/squads/${SQUAD}/members`).set(asCoach).expect(200);
    });

    it('opens the squad overview', async () => {
      const res = await server().get(`/squads/${SQUAD}/overview`).set(asCoach).expect(200);
      expect(JSON.stringify(res.body)).toContain(ATHLETE);
    });

    it("reads a sharing athlete's combined load", async () => {
      await server().get(`/squads/${SQUAD}/athletes/${ATHLETE}/load`).set(asCoach).expect(200);
    });
  });

  describe('is still refused every route for their own health data (403)', () => {
    const today = '2026-11-27';
    const cases: [string, () => request.Test][] = [
      ['POST /sessions', () => server().post('/sessions').set(asCoach).send({ type: 'TRAINING', date: today, durationMinutes: 60, rpe: 5 })],
      ['GET /sessions', () => server().get('/sessions').set(asCoach)],
      ['POST /wellness', () => server().post('/wellness').set(asCoach).send({ date: today, sleep: 3, soreness: 3, fatigue: 3, stress: 3 })],
      ['GET /me/flags', () => server().get('/me/flags').set(asCoach)],
      ['GET /me/wellness-trend', () => server().get('/me/wellness-trend').set(asCoach)],
      ['GET /me/load', () => server().get('/me/load').set(asCoach)],
    ];

    it.each(cases)('%s returns 403 and stores nothing', async (_name, call) => {
      const res = await call().expect(403);
      expect(res.body.message).toBe('Agree to health-data processing in first-time setup first');
      expect(prisma.session.create).not.toHaveBeenCalled();
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });

    it('cannot start sharing an athlete membership until health-data consent is given', async () => {
      memberships.push({ userId: COACH, squadId: 'squad-b', role: 'ATHLETE', consentGiven: false });
      await server().put('/squads/squad-b/consent').set(asCoach).send({ share: true }).expect(403);
      expect(prisma.consentEvent.create).not.toHaveBeenCalled();
    });
  });

  it('still needs sign-in for the staff routes (401)', async () => {
    await server().get('/squads').expect(401);
    await server().get(`/squads/${SQUAD}/overview`).set({ Authorization: 'Bearer wrong' }).expect(401);
  });
});
