import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';

// HTTP tests through the real AppModule with a fake database. They show which writes are made and
// in which transaction callback, but cannot prove that Postgres rolls the transaction back or
// serialises concurrent requests on the row lock (issue log I-2).

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };
const SQUAD_ID = 'squad-1';
const MEMBERSHIP_ID = 'membership-1';

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  membership: { findUnique: jest.fn(), updateMany: jest.fn() },
  consentEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

const asAthlete = { Authorization: 'Bearer athlete-token' };

/** AuthGuard looks the user up by Firebase ID; the service looks up health consent by LoadWise ID. */
function athleteWithHealthConsent(healthConsentAt: Date | null) {
  prisma.user.findUnique.mockImplementation(({ where }: { where: { firebaseUid?: string } }) =>
    Promise.resolve(where.firebaseUid ? ATHLETE : { healthConsentAt }),
  );
}

function put(share: unknown) {
  return request(app.getHttpServer()).put(`/squads/${SQUAD_ID}/consent`).set(asAthlete).send({ share });
}

let app: INestApplication;

describe('NFR2: per-squad consent (#3)', () => {
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
    athleteWithHealthConsent(new Date('2026-11-20T10:00:00.000Z'));
    prisma.membership.findUnique.mockResolvedValue({ id: MEMBERSHIP_ID, role: 'ATHLETE' });
    // The fake transaction runs the callback against the same fake client.
    prisma.$transaction.mockImplementation((work: (tx: typeof prisma) => Promise<unknown>) =>
      work(prisma),
    );
  });

  describe('granting (#3 AC2)', () => {
    it('writes a GRANTED event and the cached state together in one transaction', async () => {
      prisma.membership.updateMany.mockResolvedValue({ count: 1 });

      const res = await put(true).expect(200);

      expect(res.body).toEqual({ squadId: SQUAD_ID, consentGiven: true });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: { userId_squadId: { userId: ATHLETE.id, squadId: SQUAD_ID } },
        select: { id: true, role: true },
      });
      expect(prisma.membership.updateMany).toHaveBeenCalledWith({
        where: { id: MEMBERSHIP_ID, consentGiven: false },
        data: { consentGiven: true },
      });
      expect(prisma.consentEvent.create).toHaveBeenCalledWith({
        data: { membershipId: MEMBERSHIP_ID, action: 'GRANTED' },
      });
    });

    it('writes no duplicate event when sharing is already on', async () => {
      prisma.membership.updateMany.mockResolvedValue({ count: 0 });

      const res = await put(true).expect(200);

      expect(res.body).toEqual({ squadId: SQUAD_ID, consentGiven: true });
      expect(prisma.consentEvent.create).not.toHaveBeenCalled();
    });

    it('refuses to share until health-data consent is given (403, DL-008)', async () => {
      athleteWithHealthConsent(null);

      const res = await put(true).expect(403);

      expect(res.body.message).toBe('Agree to health-data processing in first-time setup first');
      expect(prisma.membership.updateMany).not.toHaveBeenCalled();
      expect(prisma.consentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('withdrawing (#3 AC3)', () => {
    it('writes a WITHDRAWN event and clears the cached state in one transaction', async () => {
      prisma.membership.updateMany.mockResolvedValue({ count: 1 });

      const res = await put(false).expect(200);

      expect(res.body).toEqual({ squadId: SQUAD_ID, consentGiven: false });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.membership.updateMany).toHaveBeenCalledWith({
        where: { id: MEMBERSHIP_ID, consentGiven: true },
        data: { consentGiven: false },
      });
      expect(prisma.consentEvent.create).toHaveBeenCalledWith({
        data: { membershipId: MEMBERSHIP_ID, action: 'WITHDRAWN' },
      });
    });

    it('lets an athlete withdraw even without health-data consent, so they can always stop sharing', async () => {
      athleteWithHealthConsent(null);
      prisma.membership.updateMany.mockResolvedValue({ count: 1 });

      await put(false).expect(200);
      expect(prisma.consentEvent.create).toHaveBeenCalled();
    });

    it('writes no event when the athlete was not sharing anyway', async () => {
      prisma.membership.updateMany.mockResolvedValue({ count: 0 });

      await put(false).expect(200);
      expect(prisma.consentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('who can change it', () => {
    it.each(['COACH', 'SC_COACH', 'PHYSIO'])('refuses a %s membership (403)', async (role) => {
      prisma.membership.findUnique.mockResolvedValue({ id: MEMBERSHIP_ID, role });

      const res = await put(true).expect(403);

      expect(res.body.message).toBe('Only athletes choose whether to share their data with a squad');
      expect(prisma.membership.updateMany).not.toHaveBeenCalled();
    });

    it('answers 404 when the caller is not in the squad', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      const res = await put(true).expect(404);

      expect(res.body.message).toBe('Squad not found');
      expect(prisma.membership.updateMany).not.toHaveBeenCalled();
    });

    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).put(`/squads/${SQUAD_ID}/consent`).send({ share: true }).expect(401);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('only ever changes the caller’s own membership, whatever the body says', async () => {
      prisma.membership.updateMany.mockResolvedValue({ count: 1 });

      await request(app.getHttpServer())
        .put(`/squads/${SQUAD_ID}/consent`)
        .set(asAthlete)
        .send({ share: true, userId: 'someone-else' })
        .expect(200);
      expect(prisma.membership.findUnique.mock.calls[0][0].where).toEqual({
        userId_squadId: { userId: ATHLETE.id, squadId: SQUAD_ID },
      });
    });
  });

  describe('invalid input', () => {
    it.each([
      ['a missing share field', undefined],
      ['the string "false"', 'false'],
      ['a number', 1],
      ['null', null],
    ])('rejects %s (400)', async (_case, share) => {
      const res = await put(share).expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('dependency failures', () => {
    it('reports a failed event write as a server error, with no detail (500)', async () => {
      prisma.membership.updateMany.mockResolvedValue({ count: 1 });
      prisma.consentEvent.create.mockRejectedValue(new Error('connection lost'));

      const res = await put(true).expect(500);

      // With real Postgres the cached update above is rolled back with the transaction (I-2).
      expect(res.body.message).toBe('Something went wrong');
    });
  });
});
