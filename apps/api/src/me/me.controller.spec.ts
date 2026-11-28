import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HEALTH_DATA_NOTICE_VERSION } from '@loadwise/shared';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';

// HTTP tests through the real AppModule. Only the database and Firebase are faked, so these do not
// prove the real transaction or the row lock behind "exactly one event" (issue log I-2).

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };
const CONSENTED_AT = new Date('2026-11-20T10:00:00.000Z');

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  healthConsentEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

const asAthlete = { Authorization: 'Bearer athlete-token' };

function storedUser(healthConsentAt: Date | null) {
  return { id: ATHLETE.id, email: 'a@x.com', displayName: 'a', healthConsentAt };
}

describe('me API', () => {
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
    prisma.user.findUnique.mockResolvedValue(ATHLETE);
    // The fake transaction runs the callback against the same fake client.
    prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => Promise<unknown>) =>
      work(prisma),
    );
  });

  describe('FR4: GET /me (I-7)', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).get('/me').expect(401);
    });

    it('reports that consent is still needed for a new user', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(storedUser(null));

      const res = await request(app.getHttpServer()).get('/me').set(asAthlete).expect(200);

      expect(res.body).toEqual({
        id: ATHLETE.id,
        email: 'a@x.com',
        displayName: 'a',
        healthConsentGiven: false,
        healthConsentAt: null,
      });
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ATHLETE.id } }),
      );
    });

    it('reports when consent was given', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(storedUser(CONSENTED_AT));

      const res = await request(app.getHttpServer()).get('/me').set(asAthlete).expect(200);

      expect(res.body).toMatchObject({
        healthConsentGiven: true,
        healthConsentAt: CONSENTED_AT.toISOString(),
      });
    });
  });

  describe('NFR2: POST /me/health-consent (#1 AC4)', () => {
    const consent = { noticeVersion: HEALTH_DATA_NOTICE_VERSION };

    it('records a GRANTED event with the notice version and the cached time in one transaction', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUniqueOrThrow.mockResolvedValue(storedUser(CONSENTED_AT));

      const res = await request(app.getHttpServer())
        .post('/me/health-consent')
        .set(asAthlete)
        .send(consent)
        .expect(200);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [{ where, data }] = prisma.user.updateMany.mock.calls[0];
      expect(where).toEqual({ id: ATHLETE.id, healthConsentAt: null });
      expect(prisma.healthConsentEvent.create).toHaveBeenCalledWith({
        data: {
          userId: ATHLETE.id,
          action: 'GRANTED',
          noticeVersion: HEALTH_DATA_NOTICE_VERSION,
          createdAt: data.healthConsentAt,
        },
      });
      expect(res.body).toMatchObject({ healthConsentGiven: true });
    });

    it('records no second event when consent was already given', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });
      prisma.user.findUniqueOrThrow.mockResolvedValue(storedUser(CONSENTED_AT));

      const res = await request(app.getHttpServer())
        .post('/me/health-consent')
        .set(asAthlete)
        .send(consent)
        .expect(200);

      expect(prisma.healthConsentEvent.create).not.toHaveBeenCalled();
      expect(res.body).toMatchObject({
        healthConsentGiven: true,
        healthConsentAt: CONSENTED_AT.toISOString(),
      });
    });

    it('rejects an out-of-date notice version and writes nothing (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/me/health-consent')
        .set(asAthlete)
        .send({ noticeVersion: '2020-01' })
        .expect(400);

      expect(res.body.issues[0].message).toBe(
        'The privacy notice has changed. Update the app and try again.',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a request with no notice version (400)', async () => {
      await request(app.getHttpServer())
        .post('/me/health-consent')
        .set(asAthlete)
        .send({})
        .expect(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).post('/me/health-consent').send(consent).expect(401);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('reports a database failure as a server error without recording consent (500)', async () => {
      prisma.$transaction.mockRejectedValue(new Error('connection lost'));

      await request(app.getHttpServer())
        .post('/me/health-consent')
        .set(asAthlete)
        .send(consent)
        .expect(500);
    });
  });

  describe('NFR2 #14: DELETE /me deletes the account and data', () => {
    it('requires sign-in (401) and deletes nothing', async () => {
      await request(app.getHttpServer()).delete('/me').expect(401);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("deletes only the caller's own user row and returns 204", async () => {
      prisma.user.delete.mockResolvedValue(storedUser(null));

      const res = await request(app.getHttpServer()).delete('/me').set(asAthlete).expect(204);

      expect(res.body).toEqual({});
      expect(prisma.user.delete).toHaveBeenCalledTimes(1);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: ATHLETE.id } });
    });

    it('works without health-data consent, so anyone can leave', async () => {
      prisma.user.delete.mockResolvedValue(storedUser(null));
      await request(app.getHttpServer()).delete('/me').set(asAthlete).expect(204);
    });

    it('reports a database failure as 500 without the error detail', async () => {
      prisma.user.delete.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));

      const res = await request(app.getHttpServer()).delete('/me').set(asAthlete).expect(500);

      expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    });
  });
});
