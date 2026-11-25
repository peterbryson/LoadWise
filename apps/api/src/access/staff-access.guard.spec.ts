import { Controller, Get, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TOKEN_VERIFIER, TokenVerifier } from '../auth/token-verifier';
import { PrismaService } from '../prisma/prisma.service';
import { AccessModule } from './access.module';
import { RequiresStaffAccess } from './requires-staff-access.decorator';

// A route that wrongly uses the decorator without :athleteId must fail closed, never allow access.
@Controller('misconfigured')
class MisconfiguredController {
  @Get(':squadId')
  @RequiresStaffAccess('LOAD')
  read(): { ok: boolean } {
    return { ok: true };
  }
}

const fakeVerifier: TokenVerifier = {
  verify: (token) =>
    token === 'coach-token'
      ? Promise.resolve({ uid: 'fb-coach', email: 'c@x.com' })
      : Promise.reject(new UnauthorizedException('Invalid token')),
};

const prisma = {
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-coach', firebaseUid: 'fb-coach' }) },
  membership: { findUnique: jest.fn(), findFirst: jest.fn() },
};

describe('NFR2: staff access guard fails closed (#11)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AccessModule],
      controllers: [MisconfiguredController],
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

  it('refuses a route that has no :athleteId with a server error, and checks nothing (500)', async () => {
    const res = await request(app.getHttpServer())
      .get('/misconfigured/squad-1')
      .set('Authorization', 'Bearer coach-token')
      .expect(500);

    expect(res.body).not.toHaveProperty('ok');
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });
});
