import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays } from '@loadwise/analytics';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../src/auth/token-verifier';
import { CLOCK as FLAGS_CLOCK } from '../src/flags/london-date';
import { CLOCK as METRICS_CLOCK } from '../src/metrics/clock';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * NFR 3.1 and #10 AC2: the squad overview for 40 athletes with a full season of data, measured
 * against a real local PostgreSQL through the whole API (auth guard, access checks, queries,
 * analytics). Opt-in: run `pnpm --filter @loadwise/api perf:overview` with the local database up
 * (`docker compose up -d db`) and migrations applied. Not part of `pnpm test` or CI.
 *
 * Synthetic data only. Each run creates its own squad under a unique `perf-` id prefix and deletes
 * exactly those rows afterwards, so it never touches other data in the database.
 *
 * Limits: this is the developer laptop, not staging, and the client runs in the same process, so
 * there is no network time. NFR 3.1 is to be re-measured with k6 against staging.
 */

process.loadEnvFile?.('.env');

const TODAY = '2026-11-25';
const NOW = new Date(`${TODAY}T12:00:00.000Z`);
const ATHLETES = 40;
const SEASON_DAYS = 365;
const SEQUENTIAL_REQUESTS = 50;
const CONCURRENT_USERS = 10;
const REQUESTS_PER_USER = 5;
const P95_TARGET_MS = 2000;

const RUN = `perf-${Date.now().toString(36)}`;
const SQUAD_ID = `${RUN}-squad`;
const COACH_ID = `${RUN}-coach`;
const athleteId = (n: number) => `${RUN}-athlete-${String(n).padStart(2, '0')}`;

const fakeVerifier: TokenVerifier = {
  verify: () => Promise.resolve({ uid: `${COACH_ID}-fb`, email: `${COACH_ID}@example.test` }),
};

/**
 * A full season per athlete (NFR 3.1's definition): one check-in every day and five sessions a
 * week (no sessions on Wednesdays or Sundays). Deterministic patterns, no randomness, so every run
 * reads the same amount of data.
 */
function seasonFor(n: number) {
  const id = athleteId(n);
  const sessions = [];
  const checkIns = [];
  for (let back = SEASON_DAYS - 1; back >= 0; back--) {
    const date = new Date(addDays(TODAY, -back));
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 3) {
      sessions.push({
        id: `${id}-s-${back}`,
        athleteId: id,
        type: 'TRAINING' as const,
        date,
        durationMinutes: 45 + ((back + n) % 4) * 15,
        rpe: 3 + ((back * 7 + n) % 6),
      });
    }
    const score = (offset: number) => 2 + ((back + n + offset) % 4);
    checkIns.push({
      id: `${id}-w-${back}`,
      athleteId: id,
      date,
      sleep: score(0),
      soreness: score(1),
      fatigue: score(2),
      stress: score(3),
    });
  }
  return { sessions, checkIns };
}

function percentile(sortedMs: number[], p: number): number {
  return sortedMs[Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1)];
}

function summary(label: string, timesMs: number[]) {
  const sorted = [...timesMs].sort((a, b) => a - b);
  return {
    label,
    requests: sorted.length,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(sorted[sorted.length - 1]),
  };
}

describe('NFR3.1: squad overview for 40 athletes with a full season (#10 AC2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const results: ReturnType<typeof summary>[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(METRICS_CLOCK)
      .useValue({ now: () => NOW })
      .overrideProvider(FLAGS_CLOCK)
      .useValue(() => NOW)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { id: COACH_ID, firebaseUid: `${COACH_ID}-fb`, email: `${COACH_ID}@example.test`, displayName: 'Perf Coach' },
    });
    await prisma.squad.create({ data: { id: SQUAD_ID, name: 'Perf squad', inviteCode: RUN.slice(-8).toUpperCase() } });
    await prisma.membership.create({ data: { userId: COACH_ID, squadId: SQUAD_ID, role: 'COACH' } });
    for (let n = 1; n <= ATHLETES; n++) {
      const id = athleteId(n);
      await prisma.user.create({
        data: {
          id,
          firebaseUid: `${id}-fb`,
          email: `${id}@example.test`,
          displayName: `Synthetic Athlete ${n}`,
          healthConsentAt: new Date('2025-11-01T09:00:00Z'),
        },
      });
      await prisma.membership.create({ data: { userId: id, squadId: SQUAD_ID, role: 'ATHLETE', consentGiven: true } });
      const { sessions, checkIns } = seasonFor(n);
      await prisma.session.createMany({ data: sessions });
      await prisma.wellnessEntry.createMany({ data: checkIns });
    }
  }, 300_000);

  afterAll(async () => {
    const ids = [COACH_ID, ...Array.from({ length: ATHLETES }, (_, i) => athleteId(i + 1))];
    await prisma.session.deleteMany({ where: { athleteId: { in: ids } } });
    await prisma.wellnessEntry.deleteMany({ where: { athleteId: { in: ids } } });
    await prisma.membership.deleteMany({ where: { squadId: SQUAD_ID } });
    await prisma.squad.deleteMany({ where: { id: SQUAD_ID } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
    process.stdout.write(`\nNFR 3.1 squad overview, ${ATHLETES} athletes x ${SEASON_DAYS} days:\n`);
    for (const r of results) {
      process.stdout.write(`  ${r.label}: ${r.requests} requests, p50 ${r.p50} ms, p95 ${r.p95} ms, max ${r.max} ms\n`);
    }
  }, 120_000);

  const timedGet = async () => {
    const started = performance.now();
    const res = await request(app.getHttpServer())
      .get(`/squads/${SQUAD_ID}/overview`)
      .set({ Authorization: 'Bearer perf' });
    const elapsed = performance.now() - started;
    expect(res.status).toBe(200);
    expect(res.body.athletes).toHaveLength(ATHLETES);
    return elapsed;
  };

  it('returns all 40 athletes, with the season loaded', async () => {
    const sessions = await prisma.session.count({ where: { athlete: { memberships: { some: { squadId: SQUAD_ID } } } } });
    const checkIns = await prisma.wellnessEntry.count({
      where: { athlete: { memberships: { some: { squadId: SQUAD_ID } } } },
    });
    expect(checkIns).toBe(ATHLETES * SEASON_DAYS);
    expect(sessions).toBeGreaterThan(ATHLETES * 250);
    await timedGet(); // warm-up: first request pays for connection and code loading
  });

  it('includes who has logged today (#50 AC1), so the timings below cover it', async () => {
    const res = await request(app.getHttpServer()).get(`/squads/${SQUAD_ID}/overview`).set({ Authorization: 'Bearer perf' });
    // The season has a check-in every day, and no sessions on Wednesdays: today (25 Nov) is a Wednesday.
    for (const athlete of res.body.athletes) {
      expect(athlete.logging).toEqual({ checkedInToday: true, lastSessionDate: '2026-11-24' });
    }
  });

  it(`has p95 under ${P95_TARGET_MS} ms for one staff user, ${SEQUENTIAL_REQUESTS} requests in a row`, async () => {
    const times: number[] = [];
    for (let i = 0; i < SEQUENTIAL_REQUESTS; i++) times.push(await timedGet());
    const result = summary('1 user, sequential', times);
    results.push(result);
    expect(result.p95).toBeLessThan(P95_TARGET_MS);
  }, 300_000);

  it(`has p95 under ${P95_TARGET_MS} ms with ${CONCURRENT_USERS} staff users at once`, async () => {
    const times: number[] = [];
    await Promise.all(
      Array.from({ length: CONCURRENT_USERS }, async () => {
        for (let i = 0; i < REQUESTS_PER_USER; i++) times.push(await timedGet());
      }),
    );
    const result = summary(`${CONCURRENT_USERS} concurrent users`, times);
    results.push(result);
    expect(result.p95).toBeLessThan(P95_TARGET_MS);
  }, 300_000);
});
