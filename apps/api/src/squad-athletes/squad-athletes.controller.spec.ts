import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';

// Response shapes, validation and failures for a viewer who is allowed in. Who is allowed is tested
// role by role in src/access/staff-access.spec.ts. The database is faked (issue log I-2).

const PHYSIO = { id: 'user-physio', firebaseUid: 'fb-physio' };
const BASE = '/squads/squad-1/athletes/ath-1';

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'physio-token'
      ? Promise.resolve({ uid: 'fb-physio', email: 'p@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  membership: { findUnique: jest.fn(), findFirst: jest.fn() },
  wellnessEntry: { findMany: jest.fn() },
  injury: { findMany: jest.fn(), create: jest.fn() },
};

const asPhysio = { Authorization: 'Bearer physio-token' };

describe('NFR2: staff views of one athlete (#11)', () => {
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
    prisma.user.findUnique.mockResolvedValue(PHYSIO);
    prisma.membership.findUnique.mockResolvedValue({ role: 'PHYSIO' });
    prisma.membership.findFirst.mockResolvedValue({ id: 'm-ath-1' });
  });

  describe('GET wellness (#11 AC2: S&C coach and physio see scores)', () => {
    it('returns the last 28 check-ins, newest first, as calendar days with scores only', async () => {
      prisma.wellnessEntry.findMany.mockResolvedValue([
        { date: new Date('2026-11-24T00:00:00Z'), sleep: 4, soreness: 2, fatigue: 3, stress: 5 },
      ]);

      const res = await request(app.getHttpServer()).get(`${BASE}/wellness`).set(asPhysio).expect(200);

      expect(res.body).toEqual([{ date: '2026-11-24', sleep: 4, soreness: 2, fatigue: 3, stress: 5 }]);
      expect(prisma.wellnessEntry.findMany).toHaveBeenCalledWith({
        where: { athleteId: 'ath-1' },
        orderBy: { date: 'desc' },
        take: 28,
        select: { date: true, sleep: true, soreness: true, fatigue: true, stress: true },
      });
    });

    it('returns an empty list for an athlete with no check-ins', async () => {
      prisma.wellnessEntry.findMany.mockResolvedValue([]);

      await request(app.getHttpServer()).get(`${BASE}/wellness`).set(asPhysio).expect(200, []);
    });

    it('hides database failures behind a generic error (500)', async () => {
      prisma.wellnessEntry.findMany.mockRejectedValue(new Error('connection lost'));

      const res = await request(app.getHttpServer()).get(`${BASE}/wellness`).set(asPhysio).expect(500);
      expect(res.body.message).toBe('Something went wrong');
    });
  });

  describe('injuries (#11 AC1: physio only)', () => {
    it('lists injuries newest onset first with calendar-day dates', async () => {
      prisma.injury.findMany.mockResolvedValue([
        {
          id: 'inj-1',
          bodyArea: 'Left hamstring',
          onsetDate: new Date('2026-11-10T00:00:00Z'),
          returnDate: null,
          notes: null,
        },
      ]);

      const res = await request(app.getHttpServer()).get(`${BASE}/injuries`).set(asPhysio).expect(200);

      expect(res.body).toEqual([
        { id: 'inj-1', bodyArea: 'Left hamstring', onsetDate: '2026-11-10', returnDate: null, notes: null },
      ]);
      expect(prisma.injury.findMany.mock.calls[0][0]).toMatchObject({
        where: { athleteId: 'ath-1' },
        orderBy: { onsetDate: 'desc' },
      });
    });

    it('records an injury for the athlete in the path, by the signed-in physio', async () => {
      prisma.injury.create.mockResolvedValue({
        id: 'inj-2',
        bodyArea: 'Right ankle',
        onsetDate: new Date('2026-11-01T00:00:00Z'),
        returnDate: new Date('2026-11-15T00:00:00Z'),
        notes: 'Taped for matches',
      });

      const res = await request(app.getHttpServer())
        .post(`${BASE}/injuries`)
        .set(asPhysio)
        .send({
          bodyArea: '  Right ankle ',
          onsetDate: '2026-11-01',
          returnDate: '2026-11-15',
          notes: 'Taped for matches',
          athleteId: 'someone-else',
          recordedById: 'someone-else',
        })
        .expect(201);

      expect(res.body).toEqual({
        id: 'inj-2',
        bodyArea: 'Right ankle',
        onsetDate: '2026-11-01',
        returnDate: '2026-11-15',
        notes: 'Taped for matches',
      });
      expect(prisma.injury.create.mock.calls[0][0].data).toEqual({
        athleteId: 'ath-1',
        recordedById: PHYSIO.id,
        bodyArea: 'Right ankle',
        onsetDate: new Date('2026-11-01'),
        returnDate: new Date('2026-11-15'),
        notes: 'Taped for matches',
      });
    });

    it('stores a missing or blank note and return date as null', async () => {
      prisma.injury.create.mockResolvedValue({
        id: 'inj-3',
        bodyArea: 'Knee',
        onsetDate: new Date('2026-11-01T00:00:00Z'),
        returnDate: null,
        notes: null,
      });

      await request(app.getHttpServer())
        .post(`${BASE}/injuries`)
        .set(asPhysio)
        .send({ bodyArea: 'Knee', onsetDate: '2026-11-01', notes: '   ' })
        .expect(201);
      expect(prisma.injury.create.mock.calls[0][0].data).toMatchObject({ returnDate: null, notes: null });
    });

    it.each([
      ['a missing body area', { onsetDate: '2026-11-01' }],
      ['a one-character body area', { bodyArea: 'K', onsetDate: '2026-11-01' }],
      ['a body area over 60 characters', { bodyArea: 'x'.repeat(61), onsetDate: '2026-11-01' }],
      ['a missing onset date', { bodyArea: 'Knee' }],
      ['an onset date that is not a date', { bodyArea: 'Knee', onsetDate: '01/11/2026' }],
      ['an impossible date', { bodyArea: 'Knee', onsetDate: '2026-02-30' }],
      ['a return date before onset', { bodyArea: 'Knee', onsetDate: '2026-11-10', returnDate: '2026-11-09' }],
      ['notes over 500 characters', { bodyArea: 'Knee', onsetDate: '2026-11-01', notes: 'x'.repeat(501) }],
    ])('rejects %s (400)', async (_case, body) => {
      const res = await request(app.getHttpServer()).post(`${BASE}/injuries`).set(asPhysio).send(body).expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(prisma.injury.create).not.toHaveBeenCalled();
    });

    it('accepts a return on the same day as onset', async () => {
      prisma.injury.create.mockResolvedValue({
        id: 'inj-4',
        bodyArea: 'Knee',
        onsetDate: new Date('2026-11-01T00:00:00Z'),
        returnDate: new Date('2026-11-01T00:00:00Z'),
        notes: null,
      });

      await request(app.getHttpServer())
        .post(`${BASE}/injuries`)
        .set(asPhysio)
        .send({ bodyArea: 'Knee', onsetDate: '2026-11-01', returnDate: '2026-11-01' })
        .expect(201);
    });

    it('hides database failures when recording (500)', async () => {
      prisma.injury.create.mockRejectedValue(new Error('connection lost'));

      const res = await request(app.getHttpServer())
        .post(`${BASE}/injuries`)
        .set(asPhysio)
        .send({ bodyArea: 'Knee', onsetDate: '2026-11-01' })
        .expect(500);
      expect(res.body.message).toBe('Something went wrong');
    });

    it('reports a failed access lookup as a server error, never as access granted (500)', async () => {
      prisma.membership.findFirst.mockRejectedValue(new Error('connection lost'));

      await request(app.getHttpServer()).get(`${BASE}/injuries`).set(asPhysio).expect(500);
      expect(prisma.injury.findMany).not.toHaveBeenCalled();
    });
  });
});
