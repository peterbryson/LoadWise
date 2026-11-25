import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { REQUIRES_HEALTH_CONSENT_KEY } from '../consent/requires-health-consent.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsController } from './sessions.controller';

// HTTP tests through the real AppModule. Only the database and Firebase are faked, so the real
// ORDER BY and index are not exercised here (issue log I-2).

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  session: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
};

const asAthlete = { Authorization: 'Bearer athlete-token' };
const session = { type: 'TRAINING', date: '2026-11-20', durationMinutes: 60, rpe: 7 };

/** AuthGuard looks the user up by Firebase uid; HealthConsentGuard by id. */
function consentGiven(given: boolean) {
  prisma.user.findUnique.mockImplementation((args: { where: { firebaseUid?: string } }) =>
    Promise.resolve(
      args.where.firebaseUid
        ? ATHLETE
        : { healthConsentAt: given ? new Date('2026-11-19T09:00:00.000Z') : null },
    ),
  );
}

function row(id: string, date: string, durationMinutes: number, rpe: number) {
  return {
    id,
    athleteId: ATHLETE.id,
    squadId: null,
    type: 'MATCH',
    date: new Date(date),
    durationMinutes,
    rpe,
    clientId: null,
    createdAt: new Date(),
  };
}

const CLIENT_ID = '3f2b8c4e-9a1d-4e6f-b7c2-5d8e1a9f0b34';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('sessions API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
    jest.resetAllMocks();
    consentGiven(true);
    // Prisma stores an undefined field as null, so the fake does the same.
    prisma.session.create.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 's1', squadId: null, createdAt: new Date(), ...args.data, clientId: args.data.clientId ?? null }),
    );
    prisma.session.findMany.mockResolvedValue([]);
    prisma.session.findUnique.mockResolvedValue(null);
  });

  describe('FR1: POST /sessions saves type, duration and RPE (#4 AC1)', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).post('/sessions').send(session).expect(401);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('saves the session for the signed-in athlete and returns its load', async () => {
      const res = await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(session).expect(201);

      expect(res.body).toEqual({ id: 's1', ...session, load: 420, clientId: null });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          athleteId: ATHLETE.id,
          type: 'TRAINING',
          date: new Date('2026-11-20'),
          durationMinutes: 60,
          rpe: 7,
        },
      });
    });

    it('ignores an athlete id in the body and saves for the caller', async () => {
      await request(app.getHttpServer())
        .post('/sessions')
        .set(asAthlete)
        .send({ ...session, athleteId: 'someone-else' })
        .expect(201);

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ athleteId: ATHLETE.id }),
      });
    });
  });

  describe('FR1: out-of-range values are rejected (#4 AC2)', () => {
    it.each([
      ['an RPE of 0', { ...session, rpe: 0 }],
      ['an RPE of 11', { ...session, rpe: 11 }],
      ['a decimal RPE', { ...session, rpe: 6.5 }],
      ['a duration of 0 minutes', { ...session, durationMinutes: 0 }],
      ['a duration over 600 minutes', { ...session, durationMinutes: 601 }],
      ['an unknown type', { ...session, type: 'training' }],
      ['a missing RPE', { type: 'TRAINING', date: '2026-11-20', durationMinutes: 60 }],
      ['a date that is not YYYY-MM-DD', { ...session, date: '20/11/2026' }],
    ])('rejects %s (400) and saves nothing', async (_case, body) => {
      const res = await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(body).expect(400);

      expect(res.body.issues.length).toBeGreaterThan(0);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });
  });

  describe('FR1: GET /sessions lists recent sessions, newest first (#4 AC3, AC4)', () => {
    it("returns only the caller's sessions, newest first, with their load", async () => {
      prisma.session.findMany.mockResolvedValue([row('s2', '2026-11-20', 80, 8), row('s1', '2026-11-18', 45, 5)]);

      const res = await request(app.getHttpServer()).get('/sessions').set(asAthlete).expect(200);

      expect(res.body).toEqual([
        { id: 's2', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640, clientId: null },
        { id: 's1', type: 'MATCH', date: '2026-11-18', durationMinutes: 45, rpe: 5, load: 225, clientId: null },
      ]);
      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: { athleteId: ATHLETE.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      });
    });

    it('returns an empty list for an athlete with no sessions', async () => {
      const res = await request(app.getHttpServer()).get('/sessions').set(asAthlete).expect(200);
      expect(res.body).toEqual([]);
    });

    it('accepts a limit up to 50', async () => {
      await request(app.getHttpServer()).get('/sessions?limit=50').set(asAthlete).expect(200);
      expect(prisma.session.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });

    it.each(['0', '51', 'ten'])('rejects limit=%s (400)', async (limit) => {
      await request(app.getHttpServer()).get(`/sessions?limit=${limit}`).set(asAthlete).expect(400);
      expect(prisma.session.findMany).not.toHaveBeenCalled();
    });

    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).get('/sessions').expect(401);
    });
  });

  describe('FR1: offline sync idempotency (#6 AC3)', () => {
    const queued = { ...session, clientId: CLIENT_ID };
    const stored = { ...row('s9', '2026-11-20', 60, 7), type: 'TRAINING', clientId: CLIENT_ID };

    it('stores a new entry with its clientId (201)', async () => {
      const res = await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(queued).expect(201);

      expect(res.body).toEqual({ id: 's1', ...session, load: 420, clientId: CLIENT_ID });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ athleteId: ATHLETE.id, clientId: CLIENT_ID }),
      });
    });

    it('returns the stored session for a replayed clientId (200) and creates nothing', async () => {
      prisma.session.findUnique.mockResolvedValue(stored);

      const res = await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(queued).expect(200);

      expect(res.body).toEqual({ id: 's9', ...session, load: 420, clientId: CLIENT_ID });
      expect(prisma.session.findUnique).toHaveBeenCalledWith({ where: { clientId: CLIENT_ID } });
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('returns the stored session when two copies race and the unique index rejects the second (200)', async () => {
      prisma.session.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
      prisma.session.create.mockRejectedValue(uniqueViolation());

      const res = await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(queued).expect(200);

      expect(res.body).toMatchObject({ id: 's9', clientId: CLIENT_ID });
    });

    it("refuses a clientId already stored for another athlete (409) without revealing that session", async () => {
      prisma.session.findUnique.mockResolvedValue({ ...stored, athleteId: 'user-other' });

      const res = await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(queued).expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, message: 'This entry could not be saved. Log it again.' });
      expect(JSON.stringify(res.body)).not.toMatch(/s9|user-other|TRAINING/);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it.each([
      ['not a UUID', 'abc'],
      ['an empty string', ''],
      ['a number', 42],
    ])('rejects a clientId that is %s (400)', async (_case, clientId) => {
      await request(app.getHttpServer())
        .post('/sessions')
        .set(asAthlete)
        .send({ ...session, clientId })
        .expect(400);
      expect(prisma.session.findUnique).not.toHaveBeenCalled();
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('still requires health-data consent for a replay (403)', async () => {
      consentGiven(false);
      prisma.session.findUnique.mockResolvedValue(stored);

      await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(queued).expect(403);
      expect(prisma.session.findUnique).not.toHaveBeenCalled();
    });

    it('passes on a database failure other than a unique violation (500)', async () => {
      prisma.session.create.mockRejectedValue(new Error('connection lost'));

      await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(queued).expect(500);
    });
  });

  describe('NFR2: health-data consent is required (#1 AC4)', () => {
    it('refuses to save a session without recorded consent (403)', async () => {
      consentGiven(false);

      await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(session).expect(403);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('refuses to list sessions without recorded consent (403)', async () => {
      consentGiven(false);

      await request(app.getHttpServer()).get('/sessions').set(asAthlete).expect(403);
      expect(prisma.session.findMany).not.toHaveBeenCalled();
    });

    it('applies the consent guard to the whole controller', () => {
      expect(new Reflector().get(REQUIRES_HEALTH_CONSENT_KEY, SessionsController)).toBe(true);
    });
  });
});
