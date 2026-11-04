import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';

// HTTP tests through the real AppModule: global auth guard, Zod validation, controller and service.
// Only the database (PrismaService) and Firebase (TokenVerifier) are replaced with fakes.

const COACH = { id: 'user-coach', firebaseUid: 'fb-coach' };
const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };
const SQUAD = { id: 'squad-1', name: 'Belfast Harriers', inviteCode: 'ABCD2345' };

const fakeVerifier: TokenVerifier = {
  verify: (token) => {
    if (token === 'coach-token') return Promise.resolve({ uid: 'fb-coach', email: 'c@x.com' });
    if (token === 'athlete-token') return Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' });
    return Promise.reject(new UnauthorizedException('Invalid token'));
  },
};

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  squad: { create: jest.fn(), findUnique: jest.fn() },
  membership: { create: jest.fn() },
};

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

const asCoach = { Authorization: 'Bearer coach-token' };
const asAthlete = { Authorization: 'Bearer athlete-token' };

describe('squads API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();
    // logger: false hides Nest's stack traces for the 500s these tests trigger on purpose.
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // Both test users already exist unless a test says otherwise.
    prisma.user.findUnique.mockImplementation(({ where }: { where: { firebaseUid: string } }) =>
      Promise.resolve(where.firebaseUid === 'fb-coach' ? COACH : ATHLETE),
    );
  });

  describe('NFR2: authentication guard', () => {
    it('leaves GET /health public', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });

    it('rejects a request with no Authorization header (401)', async () => {
      await request(app.getHttpServer()).post('/squads').send({}).expect(401);
      expect(prisma.squad.create).not.toHaveBeenCalled();
    });

    it('rejects a header that is not a Bearer token (401)', async () => {
      await request(app.getHttpServer())
        .post('/squads')
        .set('Authorization', 'Token coach-token')
        .send({ name: 'Squad', role: 'COACH' })
        .expect(401);
    });

    it('rejects an invalid token (401)', async () => {
      await request(app.getHttpServer())
        .post('/squads')
        .set('Authorization', 'Bearer forged')
        .send({ name: 'Squad', role: 'COACH' })
        .expect(401);
      expect(prisma.squad.create).not.toHaveBeenCalled();
    });

    it('creates the LoadWise user on their first signed-in request', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(COACH);
      prisma.squad.create.mockResolvedValue(SQUAD);

      await request(app.getHttpServer())
        .post('/squads')
        .set(asCoach)
        .send({ name: 'Belfast Harriers', role: 'COACH' })
        .expect(201);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { firebaseUid: 'fb-coach', email: 'c@x.com', displayName: 'c' },
        }),
      );
    });
  });

  describe('FR4: POST /squads (#2 create a squad)', () => {
    it('creates the squad with the creator as a staff member and returns an invite code', async () => {
      prisma.squad.create.mockResolvedValue(SQUAD);

      const res = await request(app.getHttpServer())
        .post('/squads')
        .set(asCoach)
        .send({ name: '  Belfast Harriers  ', role: 'COACH' })
        .expect(201);

      expect(res.body).toEqual({ ...SQUAD, role: 'COACH' });
      const { data } = prisma.squad.create.mock.calls[0][0];
      expect(data.name).toBe('Belfast Harriers'); // trimmed by the shared schema
      expect(data.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
      expect(data.memberships).toEqual({ create: { userId: COACH.id, role: 'COACH' } });
    });

    it.each([
      ['a missing name', { role: 'COACH' }],
      ['a one-character name', { name: 'A', role: 'COACH' }],
      ['a name over 60 characters', { name: 'x'.repeat(61), role: 'COACH' }],
      ['a missing role', { name: 'Squad' }],
      ['an unknown role', { name: 'Squad', role: 'MANAGER' }],
    ])('rejects %s (400)', async (_case, body) => {
      const res = await request(app.getHttpServer())
        .post('/squads')
        .set(asCoach)
        .send(body)
        .expect(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.issues.length).toBeGreaterThan(0);
      expect(prisma.squad.create).not.toHaveBeenCalled();
    });

    it('does not let anyone create a squad as an ATHLETE (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/squads')
        .set(asAthlete)
        .send({ name: 'Squad', role: 'ATHLETE' })
        .expect(400);
      expect(res.body.issues[0].path).toBe('role');
    });

    it('retries with a new invite code if the first one is already taken', async () => {
      prisma.squad.create.mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce(SQUAD);

      await request(app.getHttpServer())
        .post('/squads')
        .set(asCoach)
        .send({ name: 'Belfast Harriers', role: 'COACH' })
        .expect(201);
      expect(prisma.squad.create).toHaveBeenCalledTimes(2);
    });

    it('gives up after 3 invite code collisions (500)', async () => {
      prisma.squad.create.mockRejectedValue(uniqueViolation());

      await request(app.getHttpServer())
        .post('/squads')
        .set(asCoach)
        .send({ name: 'Belfast Harriers', role: 'COACH' })
        .expect(500);
      expect(prisma.squad.create).toHaveBeenCalledTimes(3);
    });

    it('does not retry on other database errors (500)', async () => {
      prisma.squad.create.mockRejectedValue(new Error('connection lost'));

      const res = await request(app.getHttpServer())
        .post('/squads')
        .set(asCoach)
        .send({ name: 'Belfast Harriers', role: 'COACH' })
        .expect(500);
      expect(prisma.squad.create).toHaveBeenCalledTimes(1);
      // The global filter (#27) replaces the database error with a generic message.
      expect(res.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Something went wrong',
      });
    });
  });

  describe('FR4: POST /squads/join (#2 invite athletes)', () => {
    it('joins the squad as an ATHLETE without consent given yet', async () => {
      prisma.squad.findUnique.mockResolvedValue(SQUAD);

      const res = await request(app.getHttpServer())
        .post('/squads/join')
        .set(asAthlete)
        .send({ inviteCode: SQUAD.inviteCode })
        .expect(201);

      expect(res.body).toEqual({ squadId: SQUAD.id, squadName: SQUAD.name, role: 'ATHLETE' });
      // consentGiven is left to its schema default (false); granting it is #3.
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: { userId: ATHLETE.id, squadId: SQUAD.id, role: 'ATHLETE' },
      });
    });

    it('accepts a lower-case code with spaces around it', async () => {
      prisma.squad.findUnique.mockResolvedValue(SQUAD);

      await request(app.getHttpServer())
        .post('/squads/join')
        .set(asAthlete)
        .send({ inviteCode: ' abcd2345 ' })
        .expect(201);
      expect(prisma.squad.findUnique).toHaveBeenCalledWith({ where: { inviteCode: 'ABCD2345' } });
    });

    it('ignores any role sent with the code, so a code never grants staff access', async () => {
      prisma.squad.findUnique.mockResolvedValue(SQUAD);

      const res = await request(app.getHttpServer())
        .post('/squads/join')
        .set(asAthlete)
        .send({ inviteCode: SQUAD.inviteCode, role: 'COACH' })
        .expect(201);
      expect(res.body.role).toBe('ATHLETE');
      expect(prisma.membership.create.mock.calls[0][0].data.role).toBe('ATHLETE');
    });

    it.each([
      ['a missing code', {}],
      ['a code that is too short', { inviteCode: 'ABC' }],
      ['a code with look-alike characters', { inviteCode: 'ABCD0O1I' }],
    ])('rejects %s (400)', async (_case, body) => {
      await request(app.getHttpServer()).post('/squads/join').set(asAthlete).send(body).expect(400);
      expect(prisma.squad.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 for a well-formed code that matches no squad', async () => {
      prisma.squad.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/squads/join')
        .set(asAthlete)
        .send({ inviteCode: 'ZZZZ9999' })
        .expect(404);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it('returns 409 if the user is already in the squad', async () => {
      prisma.squad.findUnique.mockResolvedValue(SQUAD);
      prisma.membership.create.mockRejectedValue(uniqueViolation());

      await request(app.getHttpServer())
        .post('/squads/join')
        .set(asAthlete)
        .send({ inviteCode: SQUAD.inviteCode })
        .expect(409);
    });

    it('reports other database errors as a server error, not a conflict (500)', async () => {
      prisma.squad.findUnique.mockResolvedValue(SQUAD);
      prisma.membership.create.mockRejectedValue(new Error('connection lost'));

      await request(app.getHttpServer())
        .post('/squads/join')
        .set(asAthlete)
        .send({ inviteCode: SQUAD.inviteCode })
        .expect(500);
    });

    it('requires sign-in (401)', async () => {
      await request(app.getHttpServer())
        .post('/squads/join')
        .send({ inviteCode: SQUAD.inviteCode })
        .expect(401);
    });
  });
});
