import { UnauthorizedException } from '@nestjs/common';

/** The identity claims the API needs from a verified sign-in token. */
export interface VerifiedIdentity {
  uid: string;
  email: string;
  name?: string;
}

/**
 * Checks a sign-in token and returns who it belongs to, or throws UnauthorizedException.
 * An interface rather than calling Firebase directly, so tests can use a fake and the Firebase
 * implementation can be added with #1 without changing the guard.
 */
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}

/** Nest injection token for the TokenVerifier (interfaces don't exist at runtime). */
export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/**
 * Used until the Firebase verifier is added in #1. Rejects every token, so the API fails closed:
 * nothing behind the auth guard is reachable, rather than reachable without a real sign-in.
 */
export class RejectAllTokenVerifier implements TokenVerifier {
  verify(): Promise<VerifiedIdentity> {
    return Promise.reject(new UnauthorizedException('Sign-in is not configured yet'));
  }
}
