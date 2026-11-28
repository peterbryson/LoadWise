import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { SquadRole } from '@loadwise/shared';
import request from 'supertest';
import { AppModule } from '../app.module';
import { STAFF_ACCESS_CATEGORY_KEY } from '../access/staff-access.guard';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';
import { InjuriesController } from './injuries.controller';

// #21 through the real AppModule (global auth guard, StaffAccessGuard, validation, controller and
// service). Who may call each route is also covered role by role in src/access/staff-access.spec.ts.
//
// The database is an in-memory fake that answers queries by matching their `where` fields, so a
// restriction recorded by one request is seen by the next, and a consent withdrawal through
// PUT /squads/:id/consent applies to the next read. It does not prove real PostgreSQL behaviour:
// the squadId foreign keys, cascades and indexes stay untested until integration tests exist (I-2).

const SQUAD_A = 'squad-a';
const SQUAD_C = 'squad-c';
const ATHLETE = 'ath-1';
const NOW = new Date('2026-11-27T10:00:00Z');

interface FakeMembership {
  id: string;
  userId: string;
  squadId: string;
  role: SquadRole;
  consentGiven: boolean;
}

interface FakeInjury {
  id: string;
  athleteId: string;
  squadId: string | null;
  recordedById: string | null;
  bodyArea: string;
  onsetDate: Date;
  returnDate: Date | null;
  notes: string | null;
}

interface FakeRestriction {
  id: string;
  athleteId: string;
  squadId: string;
  recordedById: string | null;
  description: string;
  reviewOn: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

/** One user per role in squad A, a physio and a coach in squad C, and the athlete in both. */
const USERS = [
  { id: 'physio-a', firebaseUid: 'fb-physio-a', healthConsentAt: NOW },
  { id: 'coach-a', firebaseUid: 'fb-coach-a', healthConsentAt: NOW },
  { id: 'sc-a', firebaseUid: 'fb-sc-a', healthConsentAt: NOW },
  { id: 'physio-c', firebaseUid: 'fb-physio-c', healthConsentAt: NOW },
  { id: 'coach-c', firebaseUid: 'fb-coach-c', healthConsentAt: NOW },
  { id: 'outsider', firebaseUid: 'fb-outsider', healthConsentAt: NOW },
  { id: ATHLETE, firebaseUid: 'fb-ath-1', healthConsentAt: NOW },
];

const TOKEN_OF: Record<string, string> = Object.fromEntries(
  USERS.map((u) => [`${u.id}-token`, u.firebaseUid]),
);
const as = (userId: string) => ({ Authorization: `Bearer ${userId}-token` });

let memberships: FakeMembership[] = [];
let injuries: FakeInjury[] = [];
let restrictions: FakeRestriction[] = [];
let nextId = 1;

function matches(row: object, where: object): boolean {
  return Object.entries(where).every(
    ([key, value]) => (row as Record<string, unknown>)[key] === value,
  );
}

/** Applies a Prisma `select` of plain fields, so the test sees exactly what the service asked for. */
function pick<T extends object>(row: T, select?: Record<string, boolean>): Partial<T> {
  if (!select) return row;
  return Object.fromEntries(Object.entries(row).filter(([key]) => select[key])) as Partial<T>;
}

type Query = { where: Record<string, unknown>; select?: Record<string, boolean> };

const prisma = {
  user: {
    findUnique: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(USERS.find((u) => matches(u, where)) ?? null),
    ),
    create: jest.fn(),
  },
  membership: {
    findUnique: jest.fn(
      ({ where }: { where: { userId_squadId: { userId: string; squadId: string } } }) =>
        Promise.resolve(memberships.find((m) => matches(m, where.userId_squadId)) ?? null),
    ),
    findFirst: jest.fn(({ where }: { where: Partial<FakeMembership> }) =>
      Promise.resolve(memberships.find((m) => matches(m, where)) ?? null),
    ),
    updateMany: jest.fn(
      ({ where, data }: { where: Partial<FakeMembership>; data: { consentGiven: boolean } }) => {
        const rows = memberships.filter((m) => matches(m, where));
        rows.forEach((m) => (m.consentGiven = data.consentGiven));
        return Promise.resolve({ count: rows.length });
      },
    ),
  },
  consentEvent: { create: jest.fn((args: { data: object }) => Promise.resolve(args.data)) },
  injury: {
    findMany: jest.fn(({ where, select }: Query) =>
      Promise.resolve(
        injuries
          .filter((i) => matches(i, where))
          .sort((a, b) => b.onsetDate.getTime() - a.onsetDate.getTime())
          .map((i) => pick(i, select)),
      ),
    ),
    create: jest.fn(
      ({ data, select }: { data: Omit<FakeInjury, 'id'>; select?: Record<string, boolean> }) => {
        const row = { id: `inj-${nextId++}`, ...data };
        injuries.push(row);
        return Promise.resolve(pick(row, select));
      },
    ),
  },
  restriction: {
    findMany: jest.fn(({ where, select }: Query) =>
      Promise.resolve(
        restrictions
          .filter((r) => matches(r, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => pick(r, select)),
      ),
    ),
    findFirst: jest.fn(({ where, select }: Query) => {
      const row = restrictions.find((r) => matches(r, where));
      return Promise.resolve(row ? pick(row, select) : null);
    }),
    create: jest.fn(
      ({
        data,
        select,
      }: {
        data: Omit<FakeRestriction, 'id' | 'createdAt' | 'endedAt'>;
        select?: Record<string, boolean>;
      }) => {
        const row: FakeRestriction = {
          id: `res-${nextId++}`,
          endedAt: null,
          createdAt: new Date(NOW.getTime() + nextId),
          ...data,
        };
        restrictions.push(row);
        return Promise.resolve(pick(row, select));
      },
    ),
    update: jest.fn(
      ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: { endedAt: Date };
        select?: Record<string, boolean>;
      }) => {
        const row = restrictions.find((r) => r.id === where.id);
        if (!row) return Promise.reject(new Error('Record to update not found'));
        row.endedAt = data.endedAt;
        return Promise.resolve(pick(row, select));
      },
    ),
  },
};
const fakeDb = {
  ...prisma,
  $transaction: jest.fn((work: (tx: typeof prisma) => Promise<unknown>) => work(prisma)),
};

const fakeVerifier: TokenVerifier = {
  verify: (token) => {
    const uid = TOKEN_OF[token];
    return uid
      ? Promise.resolve({ uid, email: `${uid}@x.com` })
      : Promise.reject(new UnauthorizedException('Invalid token'));
  },
};

function seed() {
  nextId = 1;
  injuries = [];
  restrictions = [];
  memberships = [
    { id: 'm-physio-a', userId: 'physio-a', squadId: SQUAD_A, role: 'PHYSIO', consentGiven: false },
    { id: 'm-coach-a', userId: 'coach-a', squadId: SQUAD_A, role: 'COACH', consentGiven: false },
    { id: 'm-sc-a', userId: 'sc-a', squadId: SQUAD_A, role: 'SC_COACH', consentGiven: false },
    { id: 'm-physio-c', userId: 'physio-c', squadId: SQUAD_C, role: 'PHYSIO', consentGiven: false },
    { id: 'm-coach-c', userId: 'coach-c', squadId: SQUAD_C, role: 'COACH', consentGiven: false },
    { id: 'm-ath-a', userId: ATHLETE, squadId: SQUAD_A, role: 'ATHLETE', consentGiven: true },
    { id: 'm-ath-c', userId: ATHLETE, squadId: SQUAD_C, role: 'ATHLETE', consentGiven: true },
  ];
}

let app: INestApplication;
const base = (squadId: string, athleteId = ATHLETE) => `/squads/${squadId}/athletes/${athleteId}`;

const recordInjury = (viewer: string, body: object, squadId = SQUAD_A) =>
  request(app.getHttpServer())
    .post(`${base(squadId)}/injuries`)
    .set(as(viewer))
    .send(body);
const listInjuries = (viewer: string, squadId = SQUAD_A) =>
  request(app.getHttpServer())
    .get(`${base(squadId)}/injuries`)
    .set(as(viewer));
const addRestriction = (viewer: string, body: object, squadId = SQUAD_A) =>
  request(app.getHttpServer())
    .post(`${base(squadId)}/restrictions`)
    .set(as(viewer))
    .send(body);
const listRestrictions = (viewer: string, squadId = SQUAD_A) =>
  request(app.getHttpServer())
    .get(`${base(squadId)}/restrictions`)
    .set(as(viewer));
const endRestriction = (viewer: string, restrictionId: string, squadId = SQUAD_A) =>
  request(app.getHttpServer())
    .post(`${base(squadId)}/restrictions/${restrictionId}/end`)
    .set(as(viewer));

const INJURY = {
  bodyArea: 'Left hamstring',
  onsetDate: '2026-11-20',
  notes: 'Grade 1 strain, synthetic note',
};
const RESTRICTION = { description: 'No contact training', reviewOn: '2026-12-04' };

beforeAll(async () => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'],
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(fakeDb)
    .overrideProvider(TOKEN_VERIFIER)
    .useValue(fakeVerifier)
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  seed();
});

describe('FR4 #21 AC1: the physio records an injury and restrictions', () => {
  it('records an injury in the squad from the path, by the signed-in physio, and lists it back', async () => {
    const created = await recordInjury('physio-a', {
      ...INJURY,
      squadId: SQUAD_C,
      recordedById: 'coach-a',
    }).expect(201);

    expect(created.body).toEqual({
      id: 'inj-1',
      bodyArea: 'Left hamstring',
      onsetDate: '2026-11-20',
      returnDate: null,
      notes: 'Grade 1 strain, synthetic note',
    });
    expect(injuries[0]).toMatchObject({
      athleteId: ATHLETE,
      squadId: SQUAD_A,
      recordedById: 'physio-a',
    });
    const listed = await listInjuries('physio-a').expect(200);
    expect(listed.body).toEqual([created.body]);
  });

  it('records a restriction with its review date, in the squad from the path, by the signed-in physio', async () => {
    const res = await addRestriction('physio-a', {
      description: '  No contact training ',
      reviewOn: '2026-12-04',
      squadId: SQUAD_C,
      athleteId: 'someone-else',
      recordedById: 'coach-a',
      endedAt: null,
    }).expect(201);

    expect(res.body).toEqual({
      id: 'res-1',
      description: 'No contact training',
      reviewOn: '2026-12-04',
      recordedAt: expect.any(String),
      active: true,
    });
    expect(restrictions[0]).toMatchObject({
      athleteId: ATHLETE,
      squadId: SQUAD_A,
      recordedById: 'physio-a',
      reviewOn: new Date('2026-12-04'),
      endedAt: null,
    });
  });

  it('stores a restriction with no review date as null', async () => {
    const res = await addRestriction('physio-a', { description: 'Non-contact drills only' }).expect(
      201,
    );

    expect(res.body.reviewOn).toBeNull();
  });

  it('ends a restriction, keeps the row, and stops listing it', async () => {
    const { body } = await addRestriction('physio-a', RESTRICTION).expect(201);

    const ended = await endRestriction('physio-a', body.id).expect(200);

    expect(ended.body).toEqual({ ...body, active: false });
    expect(restrictions[0].endedAt).toEqual(NOW);
    await listRestrictions('coach-a').expect(200, []);
  });

  it('treats ending an already ended restriction as done, without changing when it ended', async () => {
    const { body } = await addRestriction('physio-a', RESTRICTION).expect(201);
    await endRestriction('physio-a', body.id).expect(200);
    jest.setSystemTime(new Date('2026-11-28T09:00:00Z'));

    const again = await endRestriction('physio-a', body.id).expect(200);

    expect(again.body.active).toBe(false);
    expect(restrictions[0].endedAt).toEqual(NOW);
    expect(prisma.restriction.update).toHaveBeenCalledTimes(1);
    jest.setSystemTime(NOW);
  });

  it('refuses to end a restriction that does not exist for this athlete in this squad (404)', async () => {
    const { body } = await addRestriction('physio-a', RESTRICTION).expect(201);
    memberships.push({
      id: 'm-other-a',
      userId: 'ath-2',
      squadId: SQUAD_A,
      role: 'ATHLETE',
      consentGiven: true,
    });

    for (const res of [
      await endRestriction('physio-a', 'no-such-id'),
      await request(app.getHttpServer())
        .post(`${base(SQUAD_A, 'ath-2')}/restrictions/${body.id}/end`)
        .set(as('physio-a')),
      await endRestriction('physio-c', body.id, SQUAD_C),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Restriction not found');
    }
    expect(restrictions[0].endedAt).toBeNull();
  });
});

describe('FR4 #21: invalid input is rejected with a clear error', () => {
  it.each([
    ['a missing description', {}, 'description', 'Enter the restriction'],
    ['a description that is not text', { description: 42 }, 'description', 'Enter the restriction'],
    [
      'a two-character description',
      { description: ' ab ' },
      'description',
      'Enter the restriction, at least 3 characters',
    ],
    [
      'a description over 120 characters',
      { description: 'x'.repeat(121) },
      'description',
      'Keep the restriction to 120 characters or fewer',
    ],
    [
      'a review date that is not YYYY-MM-DD',
      { description: 'No contact', reviewOn: '04/12/2026' },
      'reviewOn',
      'Enter the review date as YYYY-MM-DD',
    ],
    [
      'an impossible review date',
      { description: 'No contact', reviewOn: '2026-02-30' },
      'reviewOn',
      'Enter the review date as YYYY-MM-DD',
    ],
  ])('rejects a restriction with %s (400)', async (_case, body, path, message) => {
    const res = await addRestriction('physio-a', body).expect(400);

    expect(res.body.message).toBe('Validation failed');
    expect(res.body.issues[0]).toEqual({ path, message });
    expect(prisma.restriction.create).not.toHaveBeenCalled();
  });

  it('accepts a description of exactly 3 and exactly 120 characters', async () => {
    await addRestriction('physio-a', { description: 'abc' }).expect(201);
    await addRestriction('physio-a', { description: 'x'.repeat(120) }).expect(201);
  });

  it.each([
    ['a missing body area', { onsetDate: '2026-11-01' }, 'bodyArea', 'Enter the body area'],
    [
      'a missing onset date',
      { bodyArea: 'Knee' },
      'onsetDate',
      'Enter the onset date as YYYY-MM-DD',
    ],
    [
      'a return date before onset',
      { bodyArea: 'Knee', onsetDate: '2026-11-10', returnDate: '2026-11-09' },
      'returnDate',
      'The return date cannot be before the onset date',
    ],
  ])('rejects an injury with %s, naming the field (400)', async (_case, body, path, message) => {
    const res = await recordInjury('physio-a', body).expect(400);

    expect(res.body.issues[0]).toEqual({ path, message });
    expect(prisma.injury.create).not.toHaveBeenCalled();
  });

  it('checks access before the body, so a coach learns nothing from a malformed request (403)', async () => {
    const res = await addRestriction('coach-a', {}).expect(403);

    expect(res.body).not.toHaveProperty('issues');
  });
});

describe('FR4 #21 AC2: restrictions are shown to that athlete’s coaches', () => {
  it.each(['coach-a', 'sc-a', 'physio-a'])(
    '%s sees active restrictions, newest first',
    async (viewer) => {
      await addRestriction('physio-a', { description: 'No contact training' }).expect(201);
      await addRestriction('physio-a', RESTRICTION).expect(201);
      const { body: older } = await addRestriction('physio-a', {
        description: 'No sprinting',
      }).expect(201);
      await endRestriction('physio-a', older.id).expect(200);

      const res = await listRestrictions(viewer).expect(200);

      expect(res.body.map((r: { description: string }) => r.description)).toEqual([
        'No contact training',
        'No contact training',
      ]);
      expect(res.body[0]).toEqual({
        id: 'res-2',
        description: 'No contact training',
        reviewOn: '2026-12-04',
        recordedAt: expect.any(String),
        active: true,
      });
    },
  );

  it('returns an empty list when the athlete has no active restrictions', async () => {
    await listRestrictions('coach-a').expect(200, []);
  });

  it('asks the database for active rows of this athlete in this squad, and only non-clinical fields', async () => {
    await listRestrictions('coach-a').expect(200);

    const query = prisma.restriction.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ athleteId: ATHLETE, squadId: SQUAD_A, endedAt: null });
    expect(Object.keys(query.select ?? {}).sort()).toEqual([
      'createdAt',
      'description',
      'endedAt',
      'id',
      'reviewOn',
    ]);
  });

  it('hides database failures behind a generic error (500)', async () => {
    prisma.restriction.findMany.mockRejectedValueOnce(new Error('connection lost'));

    const res = await listRestrictions('coach-a').expect(500);
    expect(res.body.message).toBe('Something went wrong');
  });
});

describe('NFR2 #21: coaches never see injury notes (#11 AC1 still holds)', () => {
  it.each(['coach-a', 'sc-a'])('%s cannot list or record injuries (403)', async (viewer) => {
    await recordInjury('physio-a', INJURY).expect(201);

    for (const res of [await listInjuries(viewer), await recordInjury(viewer, INJURY)]) {
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toMatch(/hamstring|synthetic note/i);
    }
    expect(injuries).toHaveLength(1);
  });

  it.each(['coach-a', 'sc-a'])('%s cannot set or end a restriction (403)', async (viewer) => {
    const { body } = await addRestriction('physio-a', RESTRICTION).expect(201);

    await addRestriction(viewer, RESTRICTION).expect(403);
    await endRestriction(viewer, body.id).expect(403);
    expect(restrictions).toHaveLength(1);
    expect(restrictions[0].endedAt).toBeNull();
  });

  it('a coach’s restriction list carries nothing from the injury record', async () => {
    await recordInjury('physio-a', INJURY).expect(201);
    await addRestriction('physio-a', RESTRICTION).expect(201);

    const res = await listRestrictions('coach-a').expect(200);

    expect(JSON.stringify(res.body)).not.toMatch(
      /hamstring|synthetic note|onset|bodyArea|notes|physio-a/i,
    );
  });

  it('the athlete themself cannot use the staff routes (403)', async () => {
    await listRestrictions(ATHLETE).expect(403);
    await listInjuries(ATHLETE).expect(403);
  });

  it('someone outside the squad gets 404 on every route, and someone signed out 401', async () => {
    await listRestrictions('outsider').expect(404);
    await addRestriction('outsider', RESTRICTION).expect(404);
    await listInjuries('outsider').expect(404);
    await request(app.getHttpServer())
      .get(`${base(SQUAD_A)}/restrictions`)
      .expect(401);
  });
});

describe('NFR2 #21: injuries and restrictions are scoped to the squad that recorded them (I-14)', () => {
  it('a physio in another squad the athlete shares with sees neither squad A’s injuries nor its restrictions', async () => {
    await recordInjury('physio-a', INJURY).expect(201);
    await addRestriction('physio-a', RESTRICTION).expect(201);

    await listInjuries('physio-c', SQUAD_C).expect(200, []);
    await listRestrictions('physio-c', SQUAD_C).expect(200, []);
    await listRestrictions('coach-c', SQUAD_C).expect(200, []);
  });

  it('each squad’s staff see only their own squad’s restrictions for the same athlete', async () => {
    await addRestriction('physio-a', { description: 'No contact training' }).expect(201);
    await addRestriction('physio-c', { description: 'Upper body gym only' }, SQUAD_C).expect(201);

    expect(
      (await listRestrictions('coach-a').expect(200)).body.map(
        (r: { description: string }) => r.description,
      ),
    ).toEqual(['No contact training']);
    expect(
      (await listRestrictions('coach-c', SQUAD_C).expect(200)).body.map(
        (r: { description: string }) => r.description,
      ),
    ).toEqual(['Upper body gym only']);
  });

  it('a squad A physio cannot reach squad C through squad A’s path or squad C’s path (404)', async () => {
    await listRestrictions('physio-a', SQUAD_C).expect(404);
    await addRestriction('physio-a', RESTRICTION, SQUAD_C).expect(404);
  });

  it('never returns injuries recorded before #21 with no squad', async () => {
    injuries.push({
      id: 'legacy',
      athleteId: ATHLETE,
      squadId: null,
      recordedById: null,
      bodyArea: 'Knee',
      onsetDate: new Date('2026-11-01'),
      returnDate: null,
      notes: null,
    });

    await listInjuries('physio-a').expect(200, []);
  });
});

describe('NFR2 #21: withdrawing squad consent hides restrictions immediately (#3 AC3)', () => {
  const setSharing = (squadId: string, share: boolean) =>
    request(app.getHttpServer())
      .put(`/squads/${squadId}/consent`)
      .set(as(ATHLETE))
      .send({ share })
      .expect(200);

  it('removes the coach’s and physio’s access on the next request, and restores it on re-grant', async () => {
    await addRestriction('physio-a', RESTRICTION).expect(201);
    await listRestrictions('coach-a').expect(200);

    await setSharing(SQUAD_A, false);

    for (const res of [
      await listRestrictions('coach-a'),
      await listRestrictions('sc-a'),
      await listRestrictions('physio-a'),
      await listInjuries('physio-a'),
      await addRestriction('physio-a', RESTRICTION),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('You do not have access to this athlete’s data');
    }

    await setSharing(SQUAD_A, true);
    const back = await listRestrictions('coach-a').expect(200);
    expect(back.body).toHaveLength(1);
  });

  it('withdrawing from squad A leaves squad C’s restrictions visible to squad C', async () => {
    await addRestriction('physio-c', RESTRICTION, SQUAD_C).expect(201);

    await setSharing(SQUAD_A, false);

    await listRestrictions('coach-c', SQUAD_C).expect(200);
  });
});

describe('NFR2 #21: every route on the injuries controller is protected', () => {
  it('declares a data category on each handler, and only INJURY on writes', () => {
    const reflector = new Reflector();
    const handlers = Object.getOwnPropertyNames(InjuriesController.prototype).filter(
      (name) => name !== 'constructor',
    );
    const categories = Object.fromEntries(
      handlers.map((name) => [
        name,
        reflector.get(
          STAFF_ACCESS_CATEGORY_KEY,
          InjuriesController.prototype[name as keyof InjuriesController],
        ),
      ]),
    );

    expect(categories).toEqual({
      injuries: 'INJURY',
      recordInjury: 'INJURY',
      restrictions: 'RESTRICTIONS',
      addRestriction: 'INJURY',
      endRestriction: 'INJURY',
    });
  });
});
