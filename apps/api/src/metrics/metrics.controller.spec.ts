import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { REQUIRES_HEALTH_CONSENT_KEY } from '../consent/requires-health-consent.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CLOCK, londonDate } from './clock';
import { MetricsController } from './metrics.controller';

// HTTP tests through the real AppModule. Only the database, Firebase and the clock are faked, so
// the real date filter on the sessions query is not exercised here (issue log I-2). The metric
// values themselves are tested against hand-calculated fixtures in @loadwise/analytics.

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  session: { findMany: jest.fn() },
};

// 23:30 UTC on Tue 24 Nov is still Tue 24 Nov in London (GMT in winter).
const clock = { now: jest.fn(() => new Date('2026-11-24T23:30:00.000Z')) };

const asAthlete = { Authorization: 'Bearer athlete-token' };

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

/** A row as Prisma returns it for the select in MetricsService. */
function row(date: string, rpe: number, durationMinutes: number) {
  return { date: new Date(date), rpe, durationMinutes };
}

describe('FR2: GET /me/load (#7)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consentGiven(true);
    prisma.session.findMany.mockResolvedValue([]);
  });

  it("returns the caller's weekly load, usual week and ACWR, computed from their sessions (AC2, AC3)", async () => {
    // First session Tue 27 Oct, 1000 AU (RPE 10 × 100). 27 Oct + 28 days = 24 Nov, which is today.
    prisma.session.findMany.mockResolvedValue([
      row('2026-10-27', 10, 100),
      row('2026-11-23', 6, 60), // 360 AU, Mon of this week
      row('2026-11-24', 5, 30), // 150 AU, today
    ]);

    const res = await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(200);

    expect(res.body).toMatchObject({
      today: '2026-11-24',
      weeks: [
        { weekStart: '2026-10-19', load: 0, partial: false },
        { weekStart: '2026-10-26', load: 1000, partial: false },
        { weekStart: '2026-11-02', load: 0, partial: false },
        { weekStart: '2026-11-09', load: 0, partial: false },
        { weekStart: '2026-11-16', load: 0, partial: false },
        { weekStart: '2026-11-23', load: 510, partial: true },
      ],
      // The week of 26 Oct starts before the first session, so no usual week yet (DL-007).
      usualWeek: null,
      acwr: { model: 'EWMA', availableFrom: '2026-11-24' },
    });
    expect(typeof res.body.acwr.value).toBe('number');
    expect(typeof res.body.monotony).toBe('number');
    expect(typeof res.body.strain).toBe('number');
  });

  it("reads only the caller's sessions up to today, and only the fields the metrics need", async () => {
    await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(200);

    expect(prisma.session.findMany).toHaveBeenCalledWith({
      where: { athleteId: ATHLETE.id, date: { lte: new Date('2026-11-24') } },
      select: { date: true, rpe: true, durationMinutes: true },
    });
  });

  it('returns the empty state for an athlete with no sessions', async () => {
    const res = await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(200);

    expect(res.body).toEqual({
      today: '2026-11-24',
      weeks: [
        { weekStart: '2026-10-19', load: 0, partial: false },
        { weekStart: '2026-10-26', load: 0, partial: false },
        { weekStart: '2026-11-02', load: 0, partial: false },
        { weekStart: '2026-11-09', load: 0, partial: false },
        { weekStart: '2026-11-16', load: 0, partial: false },
        { weekStart: '2026-11-23', load: 0, partial: true },
      ],
      usualWeek: null,
      acwr: { model: 'EWMA', value: null, availableFrom: null },
      monotony: null,
      strain: null,
    });
  });

  it('says when ACWR will appear before 28 days have passed', async () => {
    prisma.session.findMany.mockResolvedValue([row('2026-11-20', 7, 60)]);

    const res = await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(200);

    expect(res.body.acwr).toEqual({ model: 'EWMA', value: null, availableFrom: '2026-12-18' });
  });

  it('uses the London calendar day as today, not the UTC day', async () => {
    // 23:30 UTC on 1 Jul is 00:30 on 2 Jul in London (BST).
    clock.now.mockReturnValueOnce(new Date('2026-07-01T23:30:00.000Z'));

    const res = await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(200);

    expect(res.body.today).toBe('2026-07-02');
  });

  it('returns a consistent 500 without health data if the database fails', async () => {
    prisma.session.findMany.mockRejectedValue(new Error('connection refused'));

    const res = await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(500);

    expect(JSON.stringify(res.body)).not.toContain('connection refused');
  });

  it('requires sign-in (401)', async () => {
    await request(app.getHttpServer()).get('/me/load').expect(401);
    expect(prisma.session.findMany).not.toHaveBeenCalled();
  });

  describe('NFR2: health-data consent is required (#1 AC4)', () => {
    it('refuses to return load metrics without recorded consent (403)', async () => {
      consentGiven(false);

      await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(403);
      expect(prisma.session.findMany).not.toHaveBeenCalled();
    });

    it('applies the consent guard to the whole controller', () => {
      expect(new Reflector().get(REQUIRES_HEALTH_CONSENT_KEY, MetricsController)).toBe(true);
    });
  });
});

describe('FR2: London calendar day for metrics (#7)', () => {
  it.each([
    ['2026-11-24T23:30:00.000Z', '2026-11-24'], // GMT: London = UTC
    ['2026-07-01T23:30:00.000Z', '2026-07-02'], // BST: London = UTC + 1
    ['2026-03-29T00:30:00.000Z', '2026-03-29'], // clocks go forward at 01:00 UTC
    ['2026-10-25T00:30:00.000Z', '2026-10-25'], // clocks go back at 01:00 UTC
  ])('%s is %s in London', (instant, expected) => {
    expect(londonDate(new Date(instant))).toBe(expected);
  });
});
