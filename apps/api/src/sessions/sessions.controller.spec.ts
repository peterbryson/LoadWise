import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
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
  session: { create: jest.fn(), findMany: jest.fn() },
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
    createdAt: new Date(),
  };
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
    prisma.session.create.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 's1', squadId: null, createdAt: new Date(), ...args.data }),
    );
    prisma.session.findMany.mockResolvedValue([]);
  });

  describe('FR1: POST /sessions saves type, duration and RPE (#4 AC1)', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).post('/sessions').send(session).expect(401);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('saves the session for the signed-in athlete and returns its load', async () => {
      const res = await request(app.getHttpServer()).post('/sessions').set(asAthlete).send(session).expect(201);

      expect(res.body).toEqual({ id: 's1', ...session, load: 420 });
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
        { id: 's2', type: 'MATCH', date: '2026-11-20', durationMinutes: 80, rpe: 8, load: 640 },
        { id: 's1', type: 'MATCH', date: '2026-11-18', durationMinutes: 45, rpe: 5, load: 225 },
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
