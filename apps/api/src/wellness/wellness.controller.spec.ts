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
  wellnessEntry: { create: jest.fn() },
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
  return { id: 'w1', createdAt: new Date(), ...data };
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
  });

  describe('FR1: POST /wellness saves the daily check (#5)', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).post('/wellness').send(check).expect(401);
      expect(prisma.wellnessEntry.create).not.toHaveBeenCalled();
    });

    it("saves the four scores for the signed-in athlete's day", async () => {
      const res = await request(app.getHttpServer()).post('/wellness').set(asAthlete).send(check).expect(201);

      expect(res.body).toEqual({ id: 'w1', ...check });
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
      prisma.wellnessEntry.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

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
