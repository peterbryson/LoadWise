import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { REQUIRES_HEALTH_CONSENT_KEY } from '../consent/requires-health-consent.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { WellnessController } from './wellness.controller';

// HTTP tests through the real AppModule. Only the database and Firebase are faked, so the
// one-per-day unique constraint itself is not exercised here (issue log I-2).

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  wellnessEntry: { create: jest.fn(), findUnique: jest.fn() },
};

const asAthlete = { Authorization: 'Bearer athlete-token' };
const check = { date: '2026-11-20', sleep: 4, soreness: 2, fatigue: 3, stress: 5 };

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

function storedEntry(data: Record<string, unknown>) {
  // Prisma stores an undefined field as null, so the fake does the same.
  return { id: 'w1', createdAt: new Date(), ...data, clientId: data.clientId ?? null };
}

const CLIENT_ID = '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('wellness API', () => {
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
    prisma.wellnessEntry.create.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve(storedEntry(args.data)),
    );
    prisma.wellnessEntry.findUnique.mockResolvedValue(null);
  });

  describe('FR1: POST /wellness saves the daily check (#5)', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).post('/wellness').send(check).expect(401);
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });

    it("saves the four scores for the signed-in athlete's day", async () => {
      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(check).expect(201);

      expect(res.body).toEqual({ id: 'w1', ...check, clientId: null });
      expect(prisma.wellnessEntry.create).toHaveBeenCalledWith({
        data: {
          athleteId: ATHLETE.id,
          date: new Date('2026-11-20'),
          sleep: 4,
          soreness: 2,
          fatigue: 3,
          stress: 5,
        },
      });
    });

    it('ignores an athlete id in the body and saves for the caller', async () => {
      await request(app.getHttpServer())
        .post('/wellness')
        .set(asAthlete)
        .send({ ...check, athleteId: 'someone-else' })
        .expect(201);

      expect(prisma.wellnessEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ athleteId: ATHLETE.id }),
      });
    });
  });

  describe('FR1: one check-in per day (#5 AC2)', () => {
    it('refuses a second check-in for the same day (409)', async () => {
      prisma.wellnessEntry.create.mockRejectedValue(uniqueViolation());

      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(check).expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, message: 'You have already checked in today' });
    });
  });

  describe('FR1: scores are 1 to 5 (#5 AC3)', () => {
    it.each([
      ['a score below 1', { ...check, sleep: 0 }],
      ['a score above 5', { ...check, stress: 6 }],
      ['a decimal score', { ...check, fatigue: 2.5 }],
      ['a missing item', { date: check.date, sleep: 4, soreness: 2, fatigue: 3 }],
      ['a date that is not YYYY-MM-DD', { ...check, date: '20/11/2026' }],
    ])('rejects %s (400) and saves nothing', async (_case, body) => {
      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(body).expect(400);

      expect(res.body.issues.length).toBeGreaterThan(0);
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('FR1: offline sync idempotency (#6 AC3)', () => {
    const queued = { ...check, clientId: CLIENT_ID };
    const stored = {
      ...storedEntry({ athleteId: ATHLETE.id, date: new Date('2026-11-20'), sleep: 4, soreness: 2, fatigue: 3, stress: 5 }),
      id: 'w9',
      clientId: CLIENT_ID,
    };

    it('stores a new check-in with its clientId (201)', async () => {
      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(queued).expect(201);

      expect(res.body).toEqual({ id: 'w1', ...check, clientId: CLIENT_ID });
      expect(prisma.wellnessEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ athleteId: ATHLETE.id, clientId: CLIENT_ID }),
      });
    });

    it('returns the stored check-in for a replayed clientId (200) and creates nothing', async () => {
      prisma.wellnessEntry.findUnique.mockResolvedValue(stored);

      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(queued).expect(200);

      expect(res.body).toEqual({ id: 'w9', ...check, clientId: CLIENT_ID });
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });

    it('returns the stored check-in when two copies race past the lookup (200)', async () => {
      prisma.wellnessEntry.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
      prisma.wellnessEntry.create.mockRejectedValue(uniqueViolation());

      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(queued).expect(200);

      expect(res.body).toMatchObject({ id: 'w9', clientId: CLIENT_ID });
    });

    it('still refuses a different clientId for a day that already has a check-in (409, #5 AC2)', async () => {
      prisma.wellnessEntry.create.mockRejectedValue(uniqueViolation());

      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(queued).expect(409);

      expect(res.body).toMatchObject({ message: 'You have already checked in today' });
      expect(prisma.wellnessEntry.findUnique).toHaveBeenCalledTimes(2);
    });

    it('refuses a clientId already stored for another athlete (409) without revealing that check-in', async () => {
      prisma.wellnessEntry.findUnique.mockResolvedValue({ ...stored, athleteId: 'user-other' });

      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(queued).expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, message: 'This entry could not be saved. Log it again.' });
      expect(JSON.stringify(res.body)).not.toMatch(/w9|user-other/);
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });

    it.each([
      ['not a UUID', 'abc'],
      ['an empty string', ''],
      ['a number', 42],
    ])('rejects a clientId that is %s (400)', async (_case, clientId) => {
      await request(app.getHttpServer())
        .post('/wellness')
        .set(asAthlete)
        .send({ ...check, clientId })
        .expect(400);
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });

    it('still requires health-data consent for a replay (403)', async () => {
      consentGiven(false);
      prisma.wellnessEntry.findUnique.mockResolvedValue(stored);

      await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(queued).expect(403);
      expect(prisma.wellnessEntry.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('NFR2: health-data consent is required (#1 AC4)', () => {
    it('refuses a check-in from a user without recorded consent (403)', async () => {
      consentGiven(false);

      await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(check).expect(403);
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });

    it('applies the consent guard to the whole controller', () => {
      expect(new Reflector().get(REQUIRES_HEALTH_CONSENT_KEY, WellnessController)).toBe(true);
    });
  });
});
