import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { createTokenVerifier } from './firebase-token-verifier';
import { TOKEN_VERIFIER } from './token-verifier';

@Module({
  providers: [
    AuthService,
    // Firebase when FIREBASE_PROJECT_ID is set, otherwise reject everything. Tests use a fake.
    {
      provide: TOKEN_VERIFIER,
      useFactory: () => createTokenVerifier(process.env.FIREBASE_PROJECT_ID),
    },
    // APP_GUARD makes AuthGuard run on every route in the app, not just this module's.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
