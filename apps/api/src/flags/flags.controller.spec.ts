import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { REQUIRES_HEALTH_CONSENT_KEY } from '../consent/requires-health-consent.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ACWR_SOURCE } from './acwr-source';
import { FlagsController } from './flags.controller';
import { CLOCK, isoDaysBefore, londonDate } from './london-date';

// HTTP tests through the real AppModule. Only the database, Firebase, the clock and the ACWR
// source are faked, so the real date-range query is not exercised here (issue log I-2).

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  wellnessEntry: { findMany: jest.fn() },
};
const acwrSource = { acwrFor: jest.fn() };
// 09:00 UTC on Wed 25 Nov 2026 is 09:00 in London (GMT), so today is 2026-11-25.
const now = { value: new Date('2026-11-25T09:00:00.000Z') };

const asAthlete = { Authorization: 'Bearer athlete-token' };
const TODAY = '2026-11-25';

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

/** A stored check-in `daysBefore` days before today, with the same score on items other than sleep. */
function row(daysBefore: number, sleep: number, others = 4) {
  return {
    date: new Date(isoDaysBefore(TODAY, daysBefore)),
    sleep,
    soreness: others,
    fatigue: others,
    stress: others,
  };
}

/**
 * 15 check-ins in the baseline window: sleep seven 3s, seven 5s and one 4, so the sleep baseline is
 * mean 4, sample SD 1 (squared deviations 14 / (15 - 1) = 1). Other items are all 4: mean 4, SD 0.
 */
const baselineRows = Array.from({ length: 15 }, (_, i) => row(i + 1, i === 14 ? 4 : i % 2 === 0 ? 3 : 5));

describe('flags API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(ACWR_SOURCE)
      .useValue(acwrSource)
      .overrideProvider(CLOCK)
      .useValue(() => now.value)
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
    now.value = new Date('2026-11-25T09:00:00.000Z');
    prisma.wellnessEntry.findMany.mockResolvedValue([]);
    acwrSource.acwrFor.mockResolvedValue(null);
  });

  describe('FR2: GET /me/flags (#9 AC1, AC2)', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).get('/me/flags').expect(401);
      expect(prisma.wellnessEntry.findMany).not.toHaveBeenCalled();
    });

    it('returns no flags for an athlete with no data', async () => {
      const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

      expect(res.body).toEqual({
        date: TODAY,
        flags: [],
        checks: { acwr: 'unavailable', wellness: 'no-baseline' },
        baselineCheckIns: 0,
        minCheckIns: 14,
      });
    });

    describe('says which checks ran, so no flags is never a false all-clear', () => {
      it('reports both checks as run with ACWR, a 14+ check-in baseline and a check-in today', async () => {
        acwrSource.acwrFor.mockResolvedValue(1.1);
        prisma.wellnessEntry.findMany.mockResolvedValue([...baselineRows, row(0, 4)]);

        const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

        expect(res.body).toMatchObject({ flags: [], checks: { acwr: 'checked', wellness: 'checked' }, baselineCheckIns: 15 });
      });

      it('reports ACWR as unavailable while the ACWR source has no value', async () => {
        prisma.wellnessEntry.findMany.mockResolvedValue([...baselineRows, row(0, 4)]);

        const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

        expect(res.body.checks).toEqual({ acwr: 'unavailable', wellness: 'checked' });
      });

      it('reports the baseline as building, with the count so far, below 14 check-ins', async () => {
        acwrSource.acwrFor.mockResolvedValue(1.1);
        prisma.wellnessEntry.findMany.mockResolvedValue([...baselineRows.slice(0, 13), row(0, 1, 1)]);

        const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

        expect(res.body).toMatchObject({
          checks: { acwr: 'checked', wellness: 'no-baseline' },
          baselineCheckIns: 13,
          minCheckIns: 14,
        });
      });

      it('reports no check-in today when the baseline exists but today has no check-in', async () => {
        acwrSource.acwrFor.mockResolvedValue(1.1);
        prisma.wellnessEntry.findMany.mockResolvedValue(baselineRows);

        const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

        expect(res.body.checks).toEqual({ acwr: 'checked', wellness: 'no-check-in' });
      });
    });

    it("reads only the caller's check-ins from the 28-day baseline window to today", async () => {
      await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

      expect(prisma.wellnessEntry.findMany).toHaveBeenCalledWith({
        where: { athleteId: ATHLETE.id, date: { gte: new Date('2026-10-28'), lte: new Date(TODAY) } },
        select: { date: true, sleep: true, soreness: true, fatigue: true, stress: true },
        orderBy: { date: 'asc' },
      });
      expect(acwrSource.acwrFor).toHaveBeenCalledWith(ATHLETE.id, TODAY);
    });

    it("flags today's sleep more than 1.5 SD below baseline with its reason, value and threshold", async () => {
      // Threshold = 4 - 1.5 × 1 = 2.5; today's sleep 2 is below it.
      prisma.wellnessEntry.findMany.mockResolvedValue([...baselineRows, row(0, 2)]);

      const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

      expect(res.body.flags).toEqual([
        {
          rule: 'WELLNESS_LOW',
          metric: 'sleep',
          value: 2,
          threshold: 2.5,
          reason: 'Your sleep score today is 2, more than 1.5 SD below your usual 4.0 (guide: 2.5).',
        },
      ]);
    });

    it('raises no wellness flag while the baseline has fewer than 14 check-ins', async () => {
      prisma.wellnessEntry.findMany.mockResolvedValue([...baselineRows.slice(0, 13), row(0, 1, 1)]);

      const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

      expect(res.body.flags).toEqual([]);
    });

    it('raises no wellness flag when the athlete has not checked in today', async () => {
      prisma.wellnessEntry.findMany.mockResolvedValue(baselineRows);

      const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

      expect(res.body.flags).toEqual([]);
    });

    it('flags ACWR above 1.5 from the ACWR source, and not ACWR of exactly 1.5', async () => {
      acwrSource.acwrFor.mockResolvedValueOnce(1.62).mockResolvedValueOnce(1.5);

      const high = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);
      const onGuide = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

      expect(high.body.flags).toEqual([
        {
          rule: 'ACWR_HIGH',
          metric: 'acwr',
          value: 1.62,
          threshold: 1.5,
          reason: 'Your acute:chronic workload ratio is 1.62, above the 1.5 guide.',
        },
      ]);
      expect(onGuide.body.flags).toEqual([]);
    });

    it('uses the UK calendar day: 00:30 BST on 1 July is still 30 June in UTC', async () => {
      now.value = new Date('2026-06-30T23:30:00.000Z');

      const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

      expect(res.body.date).toBe('2026-07-01');
    });

    it('fails with 500 and no data in the message when the database is unavailable', async () => {
      prisma.wellnessEntry.findMany.mockRejectedValue(new Error('connection refused'));

      const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(500);

      expect(JSON.stringify(res.body)).not.toContain('connection refused');
    });
  });

  describe('FR2: GET /me/wellness-trend (#9 AC3)', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).get('/me/wellness-trend').expect(401);
    });

    it('shows progress towards the 14 check-ins while the baseline is building', async () => {
      prisma.wellnessEntry.findMany.mockResolvedValue([...baselineRows.slice(0, 5), row(0, 3)]);

      const res = await request(app.getHttpServer()).get('/me/wellness-trend').set(asAthlete).expect(200);

      expect(res.body).toMatchObject({ date: TODAY, baselineCheckIns: 5, minCheckIns: 14 });
      expect(res.body.weeks).toHaveLength(6);
      expect(res.body.weeks[5]).toMatchObject({ endDate: TODAY, baseline: null });
      // This week's average: today - 1 to today - 5 plus today.
      expect(res.body.weeks[5].average.count).toBe(6);
    });

    it("returns this week's 7-day averages against the baseline", async () => {
      // This week (19 to 25 Nov): today - 1 to today - 6 are baselineRows 0 to 5 (sleep 3, 5, 3,
      // 5, 3, 5) plus today's sleep 2: (3 + 5 + 3 + 5 + 3 + 5 + 2) / 7 = 26 / 7 ≈ 3.714.
      prisma.wellnessEntry.findMany.mockResolvedValue([...baselineRows, row(0, 2)]);

      const res = await request(app.getHttpServer()).get('/me/wellness-trend').set(asAthlete).expect(200);
      const thisWeek = res.body.weeks[5];

      expect(res.body.baselineCheckIns).toBe(15);
      expect(thisWeek.average.items.sleep).toBeCloseTo(26 / 7, 10);
      expect(thisWeek.baseline.items.sleep.mean).toBeCloseTo(4, 10);
      expect(thisWeek.baseline.items.sleep.sd).toBeCloseTo(1, 10);
    });

    it('reads back far enough for the oldest week: 5 weeks plus 28 days before today', async () => {
      await request(app.getHttpServer()).get('/me/wellness-trend').set(asAthlete).expect(200);

      expect(prisma.wellnessEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { athleteId: ATHLETE.id, date: { gte: new Date('2026-09-23'), lte: new Date(TODAY) } },
        }),
      );
    });
  });

  describe('NFR2: health-data consent is required (#1 AC4)', () => {
    it.each(['/me/flags', '/me/wellness-trend'])('refuses %s without recorded consent (403)', async (path) => {
      consentGiven(false);

      await request(app.getHttpServer()).get(path).set(asAthlete).expect(403);
      expect(prisma.wellnessEntry.findMany).not.toHaveBeenCalled();
    });

    it('applies the consent guard to the whole controller', () => {
      expect(new Reflector().get(REQUIRES_HEALTH_CONSENT_KEY, FlagsController)).toBe(true);
    });
  });
});

describe('#9: UK calendar date helpers', () => {
  it.each([
    ['2026-11-25T23:59:00.000Z', '2026-11-25'],
    ['2026-07-01T23:30:00.000Z', '2026-07-02'],
    ['2026-03-29T00:30:00.000Z', '2026-03-29'],
  ])('%s is %s in London', (instant, expected) => {
    expect(londonDate(new Date(instant))).toBe(expected);
  });

  it('counts days back across a month and a clock change', () => {
    expect(isoDaysBefore('2026-11-25', 28)).toBe('2026-10-28');
    expect(isoDaysBefore('2026-03-30', 1)).toBe('2026-03-29');
  });
});
