import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RejectAllTokenVerifier, TOKEN_VERIFIER } from './token-verifier';

@Module({
  providers: [
    AuthService,
    // Swapped for the Firebase verifier in #1, and for a fake in tests.
    { provide: TOKEN_VERIFIER, useClass: RejectAllTokenVerifier },
    // APP_GUARD makes AuthGuard run on every route in the app, not just this module's.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
