import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays } from '@loadwise/analytics';
import type { SquadRole } from '@loadwise/shared';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { SQUAD_NOT_FOUND, STAFF_ONLY } from '../access/staff-access.service';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { HEALTH_CONSENT_REQUIRED_MESSAGE } from '../consent/health-consent.guard';
import { CLOCK } from '../metrics/clock';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALREADY_RATED,
  ATHLETES_ONLY,
  CREATOR_ROLE_ONLY,
  DATE_IN_FUTURE,
  DATE_TOO_OLD,
  TEAM_SESSION_NOT_FOUND,
} from './team-sessions.service';

// #17 through the real AppModule. The database is an in-memory fake that applies the filters the
// service sends and imitates the two unique indexes on Session (clientId, and athleteId +
// teamSessionId) by throwing Prisma's P2002. It does not prove that PostgreSQL enforces them, or
// how it behaves under a real race (issue log I-2).

const TODAY = '2026-11-27';
const NOW = new Date(`${TODAY}T12:00:00.000Z`);
const SQUAD = 'squad-a';
const OTHER_SQUAD = 'squad-b';
const CLIENT_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

interface Member { userId: string; squadId: string; role: SquadRole; joinedAt: Date }
interface TeamRow { id: string; squadId: string; createdById: string | null; type: string; date: Date; durationMinutes: number; createdAt: Date }
interface SessionRow {
  id: string;
  athleteId: string;
  squadId: string | null;
  teamSessionId: string | null;
  type: string;
  date: Date;
  durationMinutes: number;
  rpe: number;
  clientId: string | null;
  createdAt: Date;
}

const EARLY = new Date('2026-09-01T09:00:00.000Z');
let members: Member[] = [];
let teamSessions: TeamRow[] = [];
let sessions: SessionRow[] = [];
let ids = 0;

function seed() {
  members = [
    { userId: 'coach', squadId: SQUAD, role: 'COACH', joinedAt: EARLY },
    { userId: 'sc', squadId: SQUAD, role: 'SC_COACH', joinedAt: EARLY },
    { userId: 'physio', squadId: SQUAD, role: 'PHYSIO', joinedAt: EARLY },
    // Athletes' squad-sharing consent is not on this fake on purpose: #17 never reads it.
    { userId: 'ath-a', squadId: SQUAD, role: 'ATHLETE', joinedAt: EARLY },
    { userId: 'ath-b', squadId: SQUAD, role: 'ATHLETE', joinedAt: EARLY },
    { userId: 'ath-new', squadId: SQUAD, role: 'ATHLETE', joinedAt: new Date(`${TODAY}T08:00:00.000Z`) },
    { userId: 'ath-a', squadId: OTHER_SQUAD, role: 'ATHLETE', joinedAt: EARLY },
    { userId: 'other-coach', squadId: OTHER_SQUAD, role: 'COACH', joinedAt: EARLY },
    { userId: 'no-consent', squadId: SQUAD, role: 'ATHLETE', joinedAt: EARLY },
  ];
  teamSessions = [];
  sessions = [];
  ids = 0;
}

const squadNames: Record<string, string> = { [SQUAD]: 'Harriers', [OTHER_SQUAD]: 'Club GAA' };

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
}

type DateFilter = { gte: Date; lte: Date };

const prisma = {
  user: {
    findUnique: jest.fn(({ where }: { where: { firebaseUid?: string; id?: string } }) => {
      const id = where.firebaseUid ? where.firebaseUid.replace(/^fb-/, '') : where.id;
      return Promise.resolve({ id, firebaseUid: `fb-${id}`, healthConsentAt: id === 'no-consent' ? null : EARLY });
    }),
    create: jest.fn(),
  },
  membership: {
    findUnique: jest.fn(({ where }: { where: { userId_squadId: { userId: string; squadId: string } } }) => {
      const { userId, squadId } = where.userId_squadId;
      const member = members.find((m) => m.userId === userId && m.squadId === squadId);
      return Promise.resolve(member ? { role: member.role } : null);
    }),
    findMany: jest.fn(({ where }: { where: { userId: string; role: SquadRole } }) =>
      Promise.resolve(
        members
          .filter((m) => m.userId === where.userId && m.role === where.role)
          .map((m) => ({ squadId: m.squadId, joinedAt: m.joinedAt })),
      ),
    ),
    count: jest.fn(({ where }: { where: { squadId: string; role: SquadRole } }) =>
      Promise.resolve(members.filter((m) => m.squadId === where.squadId && m.role === where.role).length),
    ),
  },
  teamSession: {
    create: jest.fn(({ data }: { data: Omit<TeamRow, 'id' | 'createdAt'> }) => {
      const row = { ...data, id: `ts-${++ids}`, createdAt: new Date(NOW.getTime() + ids) };
      teamSessions.push(row);
      return Promise.resolve(row);
    }),
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(teamSessions.find((t) => t.id === where.id) ?? null),
    ),
    findMany: jest.fn(
      ({ where }: { where: { squadId: { in: string[] }; date: DateFilter; sessions: { none: { athleteId: string } } } }) =>
        Promise.resolve(
          teamSessions
            .filter(
              (t) =>
                where.squadId.in.includes(t.squadId) &&
                t.date >= where.date.gte &&
                t.date <= where.date.lte &&
                !sessions.some((s) => s.teamSessionId === t.id && s.athleteId === where.sessions.none.athleteId),
            )
            .sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
            .map((t) => ({ ...t, squad: { name: squadNames[t.squadId] } })),
        ),
    ),
  },
  session: {
    create: jest.fn(({ data }: { data: Omit<SessionRow, 'id' | 'createdAt' | 'clientId'> & { clientId?: string } }) => {
      const clash = sessions.some(
        (s) =>
          (data.clientId && s.clientId === data.clientId) ||
          (s.athleteId === data.athleteId && s.teamSessionId === data.teamSessionId),
      );
      if (clash) return Promise.reject(uniqueViolation());
      const row = { ...data, clientId: data.clientId ?? null, id: `s-${++ids}`, createdAt: new Date() };
      sessions.push(row);
      return Promise.resolve(row);
    }),
    findUnique: jest.fn(({ where }: { where: { clientId: string } }) =>
      Promise.resolve(sessions.find((s) => s.clientId === where.clientId) ?? null),
    ),
  },
};

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token.startsWith('token-')
      ? Promise.resolve({ uid: `fb-${token.slice('token-'.length)}`, email: 'x@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const as = (userId: string) => ({ Authorization: `Bearer token-${userId}` });
const training = { type: 'TRAINING', date: TODAY, durationMinutes: 90 };

describe('team sessions API (#17)', () => {
  let app: INestApplication;

  const create = (userId: string, body: object = training, squadId = SQUAD) =>
    request(app.getHttpServer()).post(`/squads/${squadId}/team-sessions`).set(as(userId)).send(body);
  const toRate = (userId: string) => request(app.getHttpServer()).get('/team-sessions/to-rate').set(as(userId));
  const rate = (userId: string, teamSessionId: string, body: object) =>
    request(app.getHttpServer()).post(`/team-sessions/${teamSessionId}/rating`).set(as(userId)).send(body);

  /** Logs a team session as the coach and returns its id. */
  async function logged(body: object = training, squadId = SQUAD, coach = 'coach'): Promise<string> {
    const res = await create(coach, body, squadId).expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .overrideProvider(CLOCK)
      .useValue({ now: () => NOW })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    seed();
  });

  describe('FR1 #17 AC1: the coach logs the session once for the whole squad', () => {
    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer()).post(`/squads/${SQUAD}/team-sessions`).send(training).expect(401);
      expect(teamSessions).toHaveLength(0);
    });

    it('saves one team session and creates no session for any athlete', async () => {
      const res = await create('coach').expect(201);

      expect(res.body).toEqual({
        id: 'ts-1',
        squadId: SQUAD,
        type: 'TRAINING',
        date: TODAY,
        durationMinutes: 90,
        // ath-a, ath-b, ath-new and no-consent: every athlete member, whatever their sharing choice.
        athletesAsked: 4,
      });
      expect(teamSessions).toHaveLength(1);
      expect(teamSessions[0]).toMatchObject({ squadId: SQUAD, createdById: 'coach' });
      expect(sessions).toHaveLength(0);
    });

    it('lets an S&C coach log one too', async () => {
      await create('sc').expect(201);
      expect(teamSessions[0].createdById).toBe('sc');
    });

    it('takes the squad from the URL and the creator from the token, never from the body', async () => {
      await create('coach', { ...training, squadId: OTHER_SQUAD, createdById: 'someone-else' }).expect(201);
      expect(prisma.teamSession.create).toHaveBeenCalledWith({
        data: { squadId: SQUAD, createdById: 'coach', type: 'TRAINING', date: new Date(TODAY), durationMinutes: 90 },
      });
    });

    it.each([
      ['today', TODAY],
      ['6 days ago, the oldest day athletes are still asked', addDays(TODAY, -6)],
    ])('accepts a session dated %s', async (_case, date) => {
      const res = await create('coach', { ...training, date }).expect(201);
      expect(res.body.date).toBe(date);
    });
  });

  describe('FR1 #17: invalid team sessions are rejected with a clear error (400)', () => {
    it.each([
      ['a duration of 0 minutes', { ...training, durationMinutes: 0 }],
      ['a duration over 600 minutes', { ...training, durationMinutes: 601 }],
      ['a decimal duration', { ...training, durationMinutes: 45.5 }],
      ['an unknown type', { ...training, type: 'training' }],
      ['a date that is not YYYY-MM-DD', { ...training, date: '27/11/2026' }],
      ['a missing date', { type: 'TRAINING', durationMinutes: 90 }],
      ['a missing duration', { type: 'TRAINING', date: TODAY }],
    ])('rejects %s and saves nothing', async (_case, body) => {
      const res = await create('coach', body).expect(400);
      expect(res.body.issues.length).toBeGreaterThan(0);
      expect(teamSessions).toHaveLength(0);
    });

    it.each([
      ['tomorrow', addDays(TODAY, 1), DATE_IN_FUTURE],
      ['7 days ago, when athletes would no longer be asked', addDays(TODAY, -7), DATE_TOO_OLD],
    ])('rejects a session dated %s and says why', async (_case, date, message) => {
      const res = await create('coach', { ...training, date }).expect(400);
      expect(res.body.issues).toEqual([{ path: 'date', message }]);
      expect(teamSessions).toHaveLength(0);
    });
  });

  describe('NFR2 #17: only a coach or S&C coach of the squad can log one', () => {
    it('refuses a physio of the squad (403)', async () => {
      const res = await create('physio').expect(403);
      expect(res.body.message).toBe(CREATOR_ROLE_ONLY);
      expect(teamSessions).toHaveLength(0);
    });

    it('refuses an athlete of the squad (403)', async () => {
      const res = await create('ath-a').expect(403);
      expect(res.body.message).toBe(STAFF_ONLY);
      expect(teamSessions).toHaveLength(0);
    });

    it.each([
      ['someone in no squad', 'outsider'],
      ['a coach of a different squad', 'other-coach'],
    ])('answers %s with 404, so squad ids cannot be probed', async (_case, userId) => {
      const res = await create(userId).expect(404);
      expect(res.body.message).toBe(SQUAD_NOT_FOUND);
      expect(teamSessions).toHaveLength(0);
    });
  });

  describe('FR1 #17 AC2: every athlete in the squad is asked to add their RPE', () => {
    it('lists the new team session for every athlete in the squad, sharing or not', async () => {
      const id = await logged();

      for (const athlete of ['ath-a', 'ath-b', 'ath-new']) {
        const res = await toRate(athlete).expect(200);
        expect(res.body).toEqual([
          { id, squadId: SQUAD, squadName: 'Harriers', type: 'TRAINING', date: TODAY, durationMinutes: 90 },
        ]);
      }
    });

    it('asks nobody outside the squad, and no staff', async () => {
      await logged();
      for (const userId of ['outsider', 'other-coach', 'coach', 'physio']) {
        expect((await toRate(userId).expect(200)).body).toEqual([]);
      }
    });

    it('does not ask an athlete about a session from before they joined the squad', async () => {
      await logged({ ...training, date: addDays(TODAY, -1) });
      expect((await toRate('ath-new').expect(200)).body).toEqual([]);
      expect((await toRate('ath-a').expect(200)).body).toHaveLength(1);
    });

    it('lists sessions from all the athlete’s squads, newest first', async () => {
      const older = await logged({ ...training, date: addDays(TODAY, -6) });
      const match = await logged({ type: 'MATCH', date: addDays(TODAY, -2), durationMinutes: 70 }, OTHER_SQUAD, 'other-coach');

      const res = await toRate('ath-a').expect(200);
      expect(res.body.map((t: { id: string; squadName: string }) => [t.id, t.squadName])).toEqual([
        [match, 'Club GAA'],
        [older, 'Harriers'],
      ]);
    });

    it('stops asking once the 7 days from the session date have passed', async () => {
      // Logged within the window, then read as if a week has gone by.
      await logged({ ...training, date: addDays(TODAY, -6) });
      teamSessions[0].date = new Date(addDays(TODAY, -7));
      expect((await toRate('ath-a').expect(200)).body).toEqual([]);
    });

    it('stops asking an athlete once they have added their RPE, and only that athlete', async () => {
      const id = await logged();
      await rate('ath-a', id, { rpe: 6 }).expect(201);

      expect((await toRate('ath-a').expect(200)).body).toEqual([]);
      expect((await toRate('ath-b').expect(200)).body).toHaveLength(1);
    });

    it('requires sign-in (401) and health-data consent (403)', async () => {
      await request(app.getHttpServer()).get('/team-sessions/to-rate').expect(401);
      const res = await toRate('no-consent').expect(403);
      expect(res.body.message).toBe(HEALTH_CONSENT_REQUIRED_MESSAGE);
    });
  });

  describe('FR1 #17 AC2: adding an RPE saves the athlete’s own session', () => {
    it('saves a session with the team session’s details and the athlete’s RPE, and returns its load', async () => {
      const id = await logged();
      const res = await rate('ath-a', id, { rpe: 7 }).expect(201);

      // Load is RPE × minutes from @loadwise/analytics: 7 × 90 = 630 AU.
      expect(res.body).toEqual({
        id: expect.any(String),
        type: 'TRAINING',
        date: TODAY,
        durationMinutes: 90,
        rpe: 7,
        load: 630,
        clientId: null,
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({ athleteId: 'ath-a', squadId: SQUAD, teamSessionId: id });
    });

    it('lets an athlete rate a session of their squad whatever their sharing choice (their own data)', async () => {
      const id = await logged();
      await rate('ath-b', id, { rpe: 4 }).expect(201);
      expect(sessions[0].athleteId).toBe('ath-b');
    });

    it('saves for the caller and ignores an athlete id or duration in the body', async () => {
      const id = await logged();
      await rate('ath-a', id, { rpe: 5, athleteId: 'ath-b', durationMinutes: 10 }).expect(201);
      expect(sessions[0]).toMatchObject({ athleteId: 'ath-a', durationMinutes: 90 });
    });

    it('refuses a second rating of the same team session (409) and keeps the first', async () => {
      const id = await logged();
      await rate('ath-a', id, { rpe: 7 }).expect(201);
      const res = await rate('ath-a', id, { rpe: 3 }).expect(409);

      expect(res.body.message).toBe(ALREADY_RATED);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].rpe).toBe(7);
    });

    it('returns the stored session with 200 when the same clientId is sent again (#6, DL-023)', async () => {
      const id = await logged();
      const first = await rate('ath-a', id, { rpe: 7, clientId: CLIENT_ID }).expect(201);
      const again = await rate('ath-a', id, { rpe: 7, clientId: CLIENT_ID }).expect(200);

      expect(again.body).toEqual(first.body);
      expect(sessions).toHaveLength(1);
    });

    it('treats two copies arriving together as one: the second hits the unique index and is a replay', async () => {
      const id = await logged();
      await rate('ath-a', id, { rpe: 7, clientId: CLIENT_ID }).expect(201);
      // The second copy's lookup ran before the first copy was stored.
      prisma.session.findUnique.mockResolvedValueOnce(null);

      await rate('ath-a', id, { rpe: 7, clientId: CLIENT_ID }).expect(200);
      expect(sessions).toHaveLength(1);
    });

    it('refuses a clientId already used by another athlete (409) without saying whose', async () => {
      const id = await logged();
      await rate('ath-b', id, { rpe: 7, clientId: CLIENT_ID }).expect(201);
      const res = await rate('ath-a', id, { rpe: 7, clientId: CLIENT_ID }).expect(409);

      expect(res.body.message).toBe('This entry could not be saved. Log it again.');
      expect(sessions).toHaveLength(1);
    });

    it('refuses a clientId this athlete already used for a different team session (409)', async () => {
      const first = await logged();
      const second = await logged({ ...training, date: addDays(TODAY, -1) });
      await rate('ath-a', first, { rpe: 7, clientId: CLIENT_ID }).expect(201);

      await rate('ath-a', second, { rpe: 7, clientId: CLIENT_ID }).expect(409);
      expect(sessions).toHaveLength(1);
    });

    it.each([
      ['an RPE of 0', { rpe: 0 }],
      ['an RPE of 11', { rpe: 11 }],
      ['a decimal RPE', { rpe: 6.5 }],
      ['a missing RPE', {}],
      ['a clientId that is not a UUID', { rpe: 6, clientId: 'abc' }],
    ])('rejects %s (400) and saves nothing', async (_case, body) => {
      const id = await logged();
      const res = await rate('ath-a', id, body).expect(400);

      expect(res.body.issues.length).toBeGreaterThan(0);
      expect(sessions).toHaveLength(0);
    });

    it.each([
      ['a team session that does not exist', 'ath-a', 'ts-missing'],
      ['a team session of a squad the athlete is not in', 'outsider', 'ts-1'],
    ])('answers %s with 404', async (_case, userId, teamSessionId) => {
      await logged();
      const res = await rate(userId, teamSessionId, { rpe: 6 }).expect(404);
      expect(res.body.message).toBe(TEAM_SESSION_NOT_FOUND);
      expect(sessions).toHaveLength(0);
    });

    it('refuses staff of the squad (403): only athletes add an RPE', async () => {
      const id = await logged();
      const res = await rate('coach', id, { rpe: 6 }).expect(403);
      expect(res.body.message).toBe(ATHLETES_ONLY);
      expect(sessions).toHaveLength(0);
    });

    it('requires sign-in (401) and health-data consent (403)', async () => {
      const id = await logged();
      await request(app.getHttpServer()).post(`/team-sessions/${id}/rating`).send({ rpe: 6 }).expect(401);
      const res = await rate('no-consent', id, { rpe: 6 }).expect(403);
      expect(res.body.message).toBe(HEALTH_CONSENT_REQUIRED_MESSAGE);
      expect(sessions).toHaveLength(0);
    });
  });
});
