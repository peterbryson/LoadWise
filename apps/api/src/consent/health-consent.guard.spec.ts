import { Controller, Get, INestApplication, Post, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';
import {
  REQUIRES_HEALTH_CONSENT_KEY,
  RequiresHealthConsent,
} from './requires-health-consent.decorator';

// No health-data routes exist yet (#4 and #5 add them), so a stand-in controller exercises the guard.
@RequiresHealthConsent()
@Controller('health-data-test')
class HealthDataTestController {
  @Post()
  write(): { saved: boolean } {
    return { saved: true };
  }

  @Get()
  read(): { ok: boolean } {
    return { ok: true };
  }
}

const ATHLETE = { id: 'user-athlete', firebaseUid: 'fb-athlete' };

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'athlete-token'
      ? Promise.resolve({ uid: 'fb-athlete', email: 'a@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };

const asAthlete = { Authorization: 'Bearer athlete-token' };

/** AuthGuard looks the user up by Firebase ID; HealthConsentGuard looks them up by LoadWise ID. */
function userWithConsent(healthConsentAt: Date | null) {
  prisma.user.findUnique.mockImplementation(
    ({ where }: { where: { firebaseUid?: string; id?: string } }) =>
      Promise.resolve(where.firebaseUid ? ATHLETE : { healthConsentAt }),
  );
}

describe('NFR2: health-data consent guard (#1 AC4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [HealthDataTestController],
    })
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
  });

  it('refuses a health-data write until consent is given (403)', async () => {
    userWithConsent(null);

    const res = await request(app.getHttpServer())
      .post('/health-data-test')
      .set(asAthlete)
      .expect(403);

    expect(res.body.message).toBe('Agree to health-data processing in first-time setup first');
  });

  it('allows the write once consent is given', async () => {
    userWithConsent(new Date('2026-11-20T10:00:00.000Z'));

    await request(app.getHttpServer())
      .post('/health-data-test')
      .set(asAthlete)
      .expect(201, { saved: true });
  });

  it('covers every route when applied to the controller class', async () => {
    userWithConsent(null);

    await request(app.getHttpServer()).get('/health-data-test').set(asAthlete).expect(403);
    expect(new Reflector().get(REQUIRES_HEALTH_CONSENT_KEY, HealthDataTestController)).toBe(true);
  });

  it('checks sign-in before consent (401)', async () => {
    await request(app.getHttpServer()).post('/health-data-test').expect(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses the write if the user record cannot be found (403)', async () => {
    prisma.user.findUnique.mockImplementation(({ where }: { where: { firebaseUid?: string } }) =>
      Promise.resolve(where.firebaseUid ? ATHLETE : null),
    );

    await request(app.getHttpServer()).post('/health-data-test').set(asAthlete).expect(403);
  });
});
