import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays } from '@loadwise/analytics';
import type { SquadRole } from '@loadwise/shared';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { CLOCK as FLAGS_CLOCK } from '../flags/london-date';
import { CLOCK as METRICS_CLOCK } from '../metrics/clock';
import { PrismaService } from '../prisma/prisma.service';

// #10 through the real AppModule. The database is an in-memory fake that filters by the fields the
// service queries (athleteId, `in` lists, date ranges), so the tests also check what is read. It
// does not prove real PostgreSQL behaviour or speed (issue log I-2); NFR 3.1 is measured separately.

const TODAY = '2026-11-25';
const NOW = new Date(`${TODAY}T12:00:00.000Z`);
const SQUAD = 'squad-a';
const VIEWER = 'viewer';

type Day = { date: Date };
interface SessionRow extends Day { athleteId: string; rpe: number; durationMinutes: number }
interface CheckInRow extends Day { athleteId: string; sleep: number; soreness: number; fatigue: number; stress: number }

function dailySessions(athleteId: string, fromDaysBefore: number, toDaysBefore: number, rpe: number, minutes: number) {
  return Array.from({ length: fromDaysBefore - toDaysBefore + 1 }, (_, i): SessionRow => ({
    athleteId,
    date: new Date(addDays(TODAY, -(fromDaysBefore - i))),
    rpe,
    durationMinutes: minutes,
  }));
}

function checkIn(athleteId: string, daysBefore: number, sleep: number, other = 4): CheckInRow {
  return { athleteId, date: new Date(addDays(TODAY, -daysBefore)), sleep, soreness: other, fatigue: other, stress: other };
}

/**
 * Fixtures (hand-reasoned; the EWMA spike is the same shape as #9's acwr-source.spec.ts, EWMA ≈ 1.81):
 * - Spike: 42 days at 120 AU then 7 days at 720 AU, so ACWR is far above 1.5. No check-ins.
 * - Sleep: steady 120 AU a day for 42 days (ACWR ≈ 1.05, checked, not flagged). 15 check-ins in the
 *   baseline window: sleep 3 on days 1-7, 5 on days 8-14, 4 on day 15, so mean 60/15 = 4 and sample
 *   SD √(14/14) = 1; guide 4 − 1.5 × 1 = 2.5. Today sleep 2 < 2.5 → one wellness flag. Other items
 *   are 4 every day (SD 0) and 4 today, so not below their usual.
 * - Clear: the same steady load and 15 check-ins of all 4s, then all 4s today: both checks run, nothing fires.
 * - New: nothing logged yet, so neither check can run.
 * - Private: has data but does not share with this squad, so none of it may be read.
 * - Lapsed (#50): steady load until 3 days ago (22 Nov), then nothing; one check-in, yesterday. Not
 *   enough check-ins for a baseline, so incomplete; with 3 zero days the ACWR falls, so no load flag.
 */
const SESSIONS: SessionRow[] = [
  ...dailySessions('ath-spike', 49, 7, 4, 30),
  ...dailySessions('ath-spike', 6, 0, 8, 90),
  ...dailySessions('ath-sleep', 41, 0, 4, 30),
  ...dailySessions('ath-clear', 41, 0, 4, 30),
  ...dailySessions('ath-private', 41, 0, 8, 90),
  ...dailySessions('ath-lapsed', 41, 3, 4, 30),
];
const CHECK_INS: CheckInRow[] = [
  ...[1, 2, 3, 4, 5, 6, 7].map((d) => checkIn('ath-sleep', d, 3)),
  ...[8, 9, 10, 11, 12, 13, 14].map((d) => checkIn('ath-sleep', d, 5)),
  checkIn('ath-sleep', 15, 4),
  checkIn('ath-sleep', 0, 2),
  ...Array.from({ length: 15 }, (_, i) => checkIn('ath-clear', i + 1, 4)),
  checkIn('ath-clear', 0, 4),
  checkIn('ath-private', 0, 1, 1),
  checkIn('ath-lapsed', 1, 4),
];

interface Member { userId: string; displayName: string; role: SquadRole; consentGiven: boolean }
let members: Member[] = [];
let viewerRole: SquadRole | null = 'COACH';

function seedMembers() {
  members = [
    { userId: 'ath-spike', displayName: 'Spike Athlete', role: 'ATHLETE', consentGiven: true },
    { userId: 'ath-sleep', displayName: 'Sleep Athlete', role: 'ATHLETE', consentGiven: true },
    { userId: 'ath-clear', displayName: 'Clear Athlete', role: 'ATHLETE', consentGiven: true },
    { userId: 'ath-new', displayName: 'New Athlete', role: 'ATHLETE', consentGiven: true },
    { userId: 'ath-lapsed', displayName: 'Lapsed Athlete', role: 'ATHLETE', consentGiven: true },
    { userId: 'ath-private', displayName: 'Private Athlete', role: 'ATHLETE', consentGiven: false },
    { userId: 'colleague', displayName: 'Other Coach', role: 'PHYSIO', consentGiven: false },
  ];
}

type AthleteFilter = string | { in: string[] };
type DateFilter = { gte?: Date; lte?: Date };
function matchesAthlete(id: string, filter: AthleteFilter) {
  return typeof filter === 'string' ? id === filter : filter.in.includes(id);
}
function inRange(date: Date, { gte, lte }: DateFilter) {
  return (!gte || date >= gte) && (!lte || date <= lte);
}

const TOKENS: Record<string, string> = { 'viewer-token': VIEWER, 'sleep-token': 'ath-sleep' };
const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    TOKENS[token]
      ? Promise.resolve({ uid: `fb-${TOKENS[token]}`, email: 'x@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: {
    findUnique: jest.fn(({ where }: { where: { firebaseUid?: string; id?: string } }) => {
      const id = where.firebaseUid ? where.firebaseUid.replace(/^fb-/, '') : where.id;
      return Promise.resolve({ id, firebaseUid: `fb-${id}`, healthConsentAt: new Date('2026-09-01T09:00:00Z') });
    }),
    create: jest.fn(),
  },
  membership: {
    findUnique: jest.fn(({ where }: { where: { userId_squadId: { userId: string; squadId: string } } }) => {
      const { userId, squadId } = where.userId_squadId;
      if (squadId !== SQUAD) return Promise.resolve(null);
      if (userId === VIEWER) return Promise.resolve(viewerRole ? { role: viewerRole } : null);
      const member = members.find((m) => m.userId === userId);
      return Promise.resolve(member ? { role: member.role } : null);
    }),
    findMany: jest.fn(({ where }: { where: { squadId: string; role: SquadRole } }) =>
      Promise.resolve(
        members
          .filter((m) => where.squadId === SQUAD && m.role === where.role)
          .map((m) => ({ consentGiven: m.consentGiven, user: { id: m.userId, displayName: m.displayName } })),
      ),
    ),
  },
  squad: { findUnique: jest.fn(() => Promise.resolve({ name: 'Harriers' })) },
  session: {
    findMany: jest.fn(({ where }: { where: { athleteId: AthleteFilter; date: DateFilter } }) =>
      Promise.resolve(SESSIONS.filter((s) => matchesAthlete(s.athleteId, where.athleteId) && inRange(s.date, where.date))),
    ),
  },
  wellnessEntry: {
    findMany: jest.fn(({ where }: { where: { athleteId: AthleteFilter; date: DateFilter } }) =>
      Promise.resolve(
        CHECK_INS.filter((c) => matchesAthlete(c.athleteId, where.athleteId) && inRange(c.date, where.date)).sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        ),
      ),
    ),
  },
};

const asViewer = { Authorization: 'Bearer viewer-token' };

describe('FR4: squad overview (#10)', () => {
  let app: INestApplication;
  const get = (headers: Record<string, string> = asViewer) =>
    request(app.getHttpServer()).get(`/squads/${SQUAD}/overview`).set(headers);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(METRICS_CLOCK)
      .useValue({ now: () => NOW })
      .overrideProvider(FLAGS_CLOCK)
      .useValue(() => NOW)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    viewerRole = 'COACH';
    seedMembers();
  });

  describe('AC1: all athletes are listed with status and flags', () => {
    it('lists every athlete in the squad, problems first, and no staff', async () => {
      const res = await get().expect(200);

      expect(res.body).toMatchObject({ squadId: SQUAD, squadName: 'Harriers', date: TODAY, viewerRole: 'COACH' });
      expect(res.body.athletes.map((a: { displayName: string; status?: string; sharing: boolean }) => [
        a.displayName,
        a.sharing ? a.status : 'not sharing',
      ])).toEqual([
        ['Sleep Athlete', 'flagged'],
        ['Spike Athlete', 'flagged'],
        ['Lapsed Athlete', 'incomplete'],
        ['New Athlete', 'incomplete'],
        ['Clear Athlete', 'clear'],
        ['Private Athlete', 'not sharing'],
      ]);
    });

    it('flags a load spike with its value, guide and a third-person reason', async () => {
      const res = await get().expect(200);
      const spike = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-spike');

      expect(spike.flags).toHaveLength(1);
      expect(spike.flags[0]).toMatchObject({ rule: 'ACWR_HIGH', metric: 'acwr', threshold: 1.5 });
      expect(spike.flags[0].value).toBeGreaterThan(1.5);
      expect(spike.flags[0].reason).toMatch(/^Load ratio \(ACWR\) is \d\.\d{2,}, above the 1\.5 guide\.$/);
      expect(spike.load.acwr).toBe(spike.flags[0].value);
      expect(spike.checks).toEqual({ acwr: 'checked', wellness: 'no-baseline' });
    });

    it('gives a coach a wellness flag’s status without the score or guide (DL-022)', async () => {
      const res = await get().expect(200);
      const sleep = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-sleep');

      expect(sleep.flags).toEqual([
        {
          rule: 'WELLNESS_LOW',
          metric: 'sleep',
          value: null,
          threshold: null,
          reason: 'Sleep today is more than 1.5 SD below their usual.',
        },
      ]);
    });

    it.each(['SC_COACH', 'PHYSIO'] as const)('gives a %s the wellness score and the guide', async (role) => {
      viewerRole = role;
      const res = await get().expect(200);
      const sleep = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-sleep');

      expect(sleep.flags[0]).toEqual({
        rule: 'WELLNESS_LOW',
        metric: 'sleep',
        value: 2,
        threshold: 2.5,
        reason: 'Sleep today is 2, more than 1.5 SD below their usual (guide: 2.5).',
      });
    });

    it('marks an athlete with nothing logged as incomplete, never as clear (DL-020)', async () => {
      const res = await get().expect(200);
      const fresh = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-new');

      expect(fresh).toEqual({
        athleteId: 'ath-new',
        displayName: 'New Athlete',
        sharing: true,
        status: 'incomplete',
        flags: [],
        checks: { acwr: 'unavailable', wellness: 'no-baseline' },
        logging: { checkedInToday: false, lastSessionDate: null },
        load: { thisWeek: 0, usualWeek: null, acwr: null },
      });
    });

    it('marks an athlete as clear only when both checks ran', async () => {
      const res = await get().expect(200);
      const clear = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-clear');

      expect(clear.status).toBe('clear');
      expect(clear.checks).toEqual({ acwr: 'checked', wellness: 'checked' });
      // Steady 120 AU a day: Mon 23 to Wed 25 Nov = 360 AU this week so far.
      expect(clear.load.thisWeek).toBe(360);
    });

    it('agrees with what the athlete sees on GET /me/flags and GET /me/load', async () => {
      const overview = await get().expect(200);
      viewerRole = 'PHYSIO';
      const physioView = await get().expect(200);
      const own = { Authorization: 'Bearer sleep-token' };
      const ownFlags = await request(app.getHttpServer()).get('/me/flags').set(own).expect(200);
      const ownLoad = await request(app.getHttpServer()).get('/me/load').set(own).expect(200);

      const coachRow = overview.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-sleep');
      const physioRow = physioView.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-sleep');
      expect(coachRow.checks).toEqual(ownFlags.body.checks);
      expect(physioRow.flags.map((f: { rule: string; metric: string; value: number; threshold: number }) => [
        f.rule,
        f.metric,
        f.value,
        f.threshold,
      ])).toEqual(
        ownFlags.body.flags.map((f: { rule: string; metric: string; value: number; threshold: number }) => [
          f.rule,
          f.metric,
          f.value,
          f.threshold,
        ]),
      );
      expect(coachRow.load).toEqual({
        thisWeek: ownLoad.body.weeks[5].load,
        usualWeek: ownLoad.body.usualWeek,
        acwr: ownLoad.body.acwr.value,
      });
    });
  });

  describe('FR4 #50: who has logged today', () => {
    const loggingOf = (body: { athletes: { athleteId: string; logging?: unknown }[] }) =>
      Object.fromEntries(body.athletes.map((a) => [a.athleteId, a.logging]));

    it('AC1: shows each sharing athlete’s check-in today and the date of their last session', async () => {
      const res = await get().expect(200);

      expect(loggingOf(res.body)).toEqual({
        'ath-sleep': { checkedInToday: true, lastSessionDate: TODAY },
        'ath-spike': { checkedInToday: false, lastSessionDate: TODAY },
        'ath-lapsed': { checkedInToday: false, lastSessionDate: '2026-11-22' },
        'ath-new': { checkedInToday: false, lastSessionDate: null },
        'ath-clear': { checkedInToday: true, lastSessionDate: TODAY },
        'ath-private': undefined,
      });
    });

    it.each(['COACH', 'SC_COACH', 'PHYSIO'] as const)(
      'AC1: gives a %s the same yes/no and date, with no wellness scores in it (DL-022)',
      async (role) => {
        viewerRole = role;
        const res = await get().expect(200);
        const sleep = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-sleep');

        expect(sleep.logging).toEqual({ checkedInToday: true, lastSessionDate: TODAY });
      },
    );

    it('AC3: says when the overview was built, from the API’s clock', async () => {
      const res = await get().expect(200);

      expect(res.body.generatedAt).toBe(NOW.toISOString());
    });

    it('shows no logging data for an athlete who does not share, though they logged today', async () => {
      const res = await get().expect(200);
      const hidden = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-private');

      expect(hidden).not.toHaveProperty('logging');
      expect(hidden).toEqual({ athleteId: 'ath-private', displayName: 'Private Athlete', sharing: false });
    });

    it('drops an athlete’s logging data on the next request after they stop sharing (#3 AC3)', async () => {
      const before = await get().expect(200);
      expect(loggingOf(before.body)['ath-sleep']).toBeDefined();
      members.find((m) => m.userId === 'ath-sleep')!.consentGiven = false;

      const after = await get().expect(200);
      expect(loggingOf(after.body)['ath-sleep']).toBeUndefined();
    });
  });

  describe('NFR2: consent and minimised data (#3, #11)', () => {
    it('shows an athlete who does not share by name only, and never reads their data', async () => {
      const res = await get().expect(200);
      const hidden = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-private');

      expect(hidden).toEqual({ athleteId: 'ath-private', displayName: 'Private Athlete', sharing: false });
      const sessionIds = (prisma.session.findMany.mock.calls[0][0].where.athleteId as { in: string[] }).in;
      const wellnessIds = (prisma.wellnessEntry.findMany.mock.calls[0][0].where.athleteId as { in: string[] }).in;
      expect(sessionIds).not.toContain('ath-private');
      expect(wellnessIds).not.toContain('ath-private');
    });

    it('drops an athlete’s data on the next request after they stop sharing (#3 AC3)', async () => {
      await get().expect(200);
      members.find((m) => m.userId === 'ath-spike')!.consentGiven = false;

      const res = await get().expect(200);
      const spike = res.body.athletes.find((a: { athleteId: string }) => a.athleteId === 'ath-spike');
      expect(spike).toEqual({ athleteId: 'ath-spike', displayName: 'Spike Athlete', sharing: false });
    });

    it.each([
      ['a viewer who is not in the squad', null, 404],
      ['an athlete in the squad', 'ATHLETE', 403],
    ] as const)('refuses %s (%i) without reading any athlete data', async (_name, role, status) => {
      viewerRole = role;
      const res = await get().expect(status);

      expect(prisma.membership.findMany).not.toHaveBeenCalled();
      expect(prisma.session.findMany).not.toHaveBeenCalled();
      expect(JSON.stringify(res.body)).not.toMatch(/Athlete/);
    });

    it('refuses a request without sign-in (401)', async () => {
      await get({}).expect(401);
      expect(prisma.session.findMany).not.toHaveBeenCalled();
    });
  });

  describe('NFR3: one query each for sessions and check-ins, however many athletes', () => {
    it('reads the whole squad in two batched queries', async () => {
      await get().expect(200);

      expect(prisma.session.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.wellnessEntry.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.session.findMany.mock.calls[0][0].where).toEqual({
        athleteId: { in: ['ath-spike', 'ath-sleep', 'ath-clear', 'ath-new', 'ath-lapsed'] },
        date: { lte: new Date(TODAY) },
      });
      expect(prisma.wellnessEntry.findMany.mock.calls[0][0].where).toEqual({
        athleteId: { in: ['ath-spike', 'ath-sleep', 'ath-clear', 'ath-new', 'ath-lapsed'] },
        date: { gte: new Date('2026-10-28'), lte: new Date(TODAY) },
      });
    });

    it('lists a squad with no athletes without reading any health data', async () => {
      members = members.filter((m) => m.role !== 'ATHLETE');
      const res = await get().expect(200);

      expect(res.body.athletes).toEqual([]);
      expect(prisma.session.findMany).not.toHaveBeenCalled();
      expect(prisma.wellnessEntry.findMany).not.toHaveBeenCalled();
    });
  });
});
