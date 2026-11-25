import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { CLOCK } from '../metrics/clock';
import { PrismaService } from '../prisma/prisma.service';

// #8 through the real AppModule. Who may call these routes is tested role by role in
// src/access/staff-access.spec.ts; this file tests what an allowed viewer receives.
// The database is faked (issue log I-2), so the real date filter is not exercised here.

const TODAY = '2026-11-25'; // a Wednesday; this week starts Monday 23 Nov
const STAFF = { id: 'user-staff', firebaseUid: 'fb-staff', healthConsentAt: null };
const ATHLETE = { id: 'ath-1', firebaseUid: 'fb-ath', healthConsentAt: new Date('2026-11-01T10:00:00Z') };

const fakeVerifier: TokenVerifier = {
  verify: (token) => {
    if (token === 'staff-token') return Promise.resolve({ uid: 'fb-staff', email: 's@x.com' });
    if (token === 'athlete-token') return Promise.resolve({ uid: 'fb-ath', email: 'a@x.com' });
    return Promise.reject(new UnauthorizedException('Invalid token'));
  },
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  membership: { findUnique: jest.fn(), findFirst: jest.fn() },
  session: { findMany: jest.fn() },
};

/**
 * The athlete is in squads A and B and logged one session for each, plus one with no squad.
 * Prisma returns only the selected fields, so the rows carry no squad: the totals cannot depend on it.
 * Hand calculation (load = RPE × minutes):
 *   Mon 23 Nov, for squad A: 5 × 60 = 300
 *   Tue 24 Nov, for squad B: 6 × 50 = 300
 *   Wed 25 Nov, no squad:    4 × 30 = 120
 *   This week so far = 720, each session counted once.
 */
const SESSIONS = [
  { date: new Date('2026-11-23T00:00:00Z'), rpe: 5, durationMinutes: 60 },
  { date: new Date('2026-11-24T00:00:00Z'), rpe: 6, durationMinutes: 50 },
  { date: new Date('2026-11-25T00:00:00Z'), rpe: 4, durationMinutes: 30 },
];

const asStaff = { Authorization: 'Bearer staff-token' };

describe('FR2: combined multi-team load (#8)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(CLOCK)
      .useValue({ now: () => new Date(`${TODAY}T12:00:00Z`) })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: { where: { firebaseUid?: string; id?: string } }) =>
      Promise.resolve(
        [STAFF, ATHLETE].find((u) => u.firebaseUid === where.firebaseUid || u.id === where.id) ?? null,
      ),
    );
    // The viewer is staff (S&C coach, which has LOAD and LOAD_DETAIL) in every squad asked about,
    // and the athlete shares with it.
    prisma.membership.findUnique.mockResolvedValue({ role: 'SC_COACH' });
    prisma.membership.findFirst.mockResolvedValue({ id: 'm-ath-1' });
    prisma.session.findMany.mockResolvedValue(SESSIONS);
  });

  describe('AC1: sessions from every squad count once in the athlete’s totals', () => {
    it('adds sessions logged for squad A, squad B and no squad into one weekly total', async () => {
      const res = await request(app.getHttpServer()).get('/squads/squad-a/athletes/ath-1/load').set(asStaff).expect(200);

      expect(res.body.weeks).toHaveLength(6);
      expect(res.body.weeks[5]).toEqual({ weekStart: '2026-11-23', load: 720, partial: true });
    });

    it('reads the athlete’s sessions by athlete only, never filtered by squad', async () => {
      await request(app.getHttpServer()).get('/squads/squad-a/athletes/ath-1/load').set(asStaff).expect(200);

      expect(prisma.session.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.session.findMany.mock.calls[0][0].where).toEqual({
        athleteId: 'ath-1',
        date: { lte: new Date(TODAY) },
      });
    });
  });

  describe('AC2: each squad’s staff see the combined load', () => {
    it('gives staff of squad A and staff of squad B the same totals', async () => {
      const viaA = await request(app.getHttpServer()).get('/squads/squad-a/athletes/ath-1/load').set(asStaff).expect(200);
      const viaB = await request(app.getHttpServer()).get('/squads/squad-b/athletes/ath-1/load').set(asStaff).expect(200);

      expect(viaB.body).toEqual(viaA.body);
    });

    it('matches the totals the athlete sees on their own Trends tab', async () => {
      const staffView = await request(app.getHttpServer())
        .get('/squads/squad-a/athletes/ath-1/load')
        .set(asStaff)
        .expect(200);
      const ownView = await request(app.getHttpServer())
        .get('/me/load')
        .set({ Authorization: 'Bearer athlete-token' })
        .expect(200);

      const { today, weeks, usualWeek, acwr } = ownView.body;
      expect(staffView.body).toEqual({ today, weeks, usualWeek, acwr });
    });

    it('returns totals only: no sessions, monotony or strain (DL-022)', async () => {
      const res = await request(app.getHttpServer()).get('/squads/squad-a/athletes/ath-1/load').set(asStaff).expect(200);

      expect(Object.keys(res.body).sort()).toEqual(['acwr', 'today', 'usualWeek', 'weeks']);
      expect(res.body.today).toBe(TODAY);
      expect(res.body.acwr).toEqual({ model: 'EWMA', value: null, availableFrom: '2026-12-21' });
    });

    it('gives an empty picture, not an error, for an athlete with no sessions', async () => {
      prisma.session.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer()).get('/squads/squad-a/athletes/ath-1/load').set(asStaff).expect(200);

      expect(res.body.weeks.every((week: { load: number }) => week.load === 0)).toBe(true);
      expect(res.body.usualWeek).toBeNull();
      expect(res.body.acwr).toEqual({ model: 'EWMA', value: null, availableFrom: null });
    });
  });

  describe('load detail for S&C coaches and physios (#8 with #11)', () => {
    it('returns only monotony and strain, from the same combined sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/squads/squad-a/athletes/ath-1/load-detail')
        .set(asStaff)
        .expect(200);

      expect(Object.keys(res.body).sort()).toEqual(['monotony', 'strain', 'today']);
      // Last 7 days 19 to 25 Nov: [0, 0, 0, 0, 300, 300, 120]; mean 102.857, so monotony > 0.
      expect(res.body.monotony).toBeGreaterThan(0);
      expect(res.body.strain).toBeCloseTo(720 * res.body.monotony, 6);
    });
  });

  describe('failures', () => {
    it('answers 500 without naming the athlete when the database fails', async () => {
      prisma.session.findMany.mockRejectedValue(new Error('connection lost for ath-1'));

      const res = await request(app.getHttpServer()).get('/squads/squad-a/athletes/ath-1/load').set(asStaff).expect(500);

      expect(JSON.stringify(res.body)).not.toContain('ath-1');
    });
  });
});
