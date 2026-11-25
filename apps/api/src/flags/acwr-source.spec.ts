import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays } from '@loadwise/analytics';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { CLOCK as METRICS_CLOCK } from '../metrics/clock';
import { PrismaService } from '../prisma/prisma.service';
import { CLOCK as FLAGS_CLOCK } from './london-date';

// The real ACWR source, end to end: GET /me/flags reads the athlete's sessions and uses #7's EWMA
// ACWR, the same value GET /me/load returns. Only the database, Firebase and the clocks are faked.

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };
const TODAY = '2026-11-25';
// 09:00 UTC on 25 Nov is 09:00 in London (GMT).
const NOW = new Date(`${TODAY}T09:00:00.000Z`);

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn() },
  session: { findMany: jest.fn() },
  wellnessEntry: { findMany: jest.fn() },
};

const asAthlete = { Authorization: 'Bearer athlete-token' };

/** One session a day from `fromDaysBefore` to `toDaysBefore` days before today, as Prisma returns it. */
function dailySessions(fromDaysBefore: number, toDaysBefore: number, rpe: number, durationMinutes: number) {
  return Array.from({ length: fromDaysBefore - toDaysBefore + 1 }, (_, i) => ({
    date: new Date(addDays(TODAY, -(fromDaysBefore - i))),
    rpe,
    durationMinutes,
  }));
}

/**
 * 42 days of steady 30-minute RPE 4 sessions (120 AU), then the last 7 days at 90 minutes RPE 8
 * (720 AU): the acute EWMA rises much faster than the chronic one, so EWMA ACWR is well above 1.5.
 */
const spike = [...dailySessions(49, 7, 4, 30), ...dailySessions(6, 0, 8, 90)];
/** The same steady load every day for 42 days: acute and chronic EWMA stay close, ACWR near 1. */
const steady = dailySessions(41, 0, 4, 30);

describe('FR2: ACWR flag from real session data (#9 with #7)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(FLAGS_CLOCK)
      .useValue(() => NOW)
      .overrideProvider(METRICS_CLOCK)
      .useValue({ now: () => NOW })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockImplementation((args: { where: { firebaseUid?: string } }) =>
      Promise.resolve(args.where.firebaseUid ? ATHLETE : { healthConsentAt: new Date('2026-09-01T09:00:00.000Z') }),
    );
    prisma.wellnessEntry.findMany.mockResolvedValue([]);
  });

  it('flags an EWMA ACWR above 1.5 with the same value GET /me/load returns', async () => {
    prisma.session.findMany.mockResolvedValue(spike);

    const load = await request(app.getHttpServer()).get('/me/load').set(asAthlete).expect(200);
    const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

    expect(load.body.acwr.model).toBe('EWMA');
    expect(load.body.acwr.value).toBeGreaterThan(1.5);
    expect(res.body.checks.acwr).toBe('checked');
    expect(res.body.flags).toEqual([
      expect.objectContaining({ rule: 'ACWR_HIGH', metric: 'acwr', value: load.body.acwr.value, threshold: 1.5 }),
    ]);
  });

  it("reads only the caller's sessions up to today", async () => {
    prisma.session.findMany.mockResolvedValue(spike);

    await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

    expect(prisma.session.findMany).toHaveBeenCalledWith({
      where: { athleteId: ATHLETE.id, date: { lte: new Date(TODAY) } },
      select: { date: true, rpe: true, durationMinutes: true },
    });
  });

  it('checks ACWR but raises no flag for a steady load', async () => {
    prisma.session.findMany.mockResolvedValue(steady);

    const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

    expect(res.body.checks.acwr).toBe('checked');
    expect(res.body.flags).toEqual([]);
  });

  it('reports ACWR as unavailable before 28 days since the first session (DL-007)', async () => {
    prisma.session.findMany.mockResolvedValue(dailySessions(20, 0, 8, 90));

    const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

    expect(res.body.checks.acwr).toBe('unavailable');
    expect(res.body.flags).toEqual([]);
  });

  it('reports ACWR as unavailable with no sessions at all', async () => {
    prisma.session.findMany.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(200);

    expect(res.body.checks.acwr).toBe('unavailable');
  });

  it('fails with 500 and no data in the message when the sessions query fails', async () => {
    prisma.session.findMany.mockRejectedValue(new Error('connection refused'));

    const res = await request(app.getHttpServer()).get('/me/flags').set(asAthlete).expect(500);

    expect(JSON.stringify(res.body)).not.toContain('connection refused');
  });
});
