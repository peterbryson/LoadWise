import { Logger, UnauthorizedException } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { RejectAllTokenVerifier, TokenVerifier, VerifiedIdentity } from './token-verifier';

/** The one Firebase Admin call the verifier needs, so tests can pass a fake. */
export interface FirebaseIdTokenChecker {
  verifyIdToken(token: string): Promise<DecodedIdToken>;
}

/** Firebase Admin errors carry a `service/reason` code, e.g. `auth/id-token-expired`. */
function isFirebaseAuthError(error: unknown): boolean {
  const code: unknown = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.startsWith('auth/');
}

/**
 * #1: checks a Firebase ID token's signature, expiry, issuer and audience using Firebase Admin,
 * which also fetches and rotates Google's public keys. Revocation is not checked: that needs a
 * service account, and ID tokens expire after an hour anyway.
 */
export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(private readonly firebase: FirebaseIdTokenChecker) {}

  async verify(token: string): Promise<VerifiedIdentity> {
    let decoded: DecodedIdToken;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch (error) {
      // Firebase Admin also reports a failed key download as auth/argument-error, so an outage at
      // Google shows as 401 rather than 503. Failing closed is the safe side of that trade-off.
      if (isFirebaseAuthError(error)) {
        throw new UnauthorizedException('Invalid or expired sign-in token');
      }
      throw error;
    }

    if (!decoded.email) throw new UnauthorizedException('Sign-in token has no email address');
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
    };
  }
}

/**
 * Picks the verifier at startup. Without a Firebase project ID the API still fails closed:
 * every signed-in route returns 401 rather than becoming reachable without sign-in.
 */
export function createTokenVerifier(projectId: string | undefined): TokenVerifier {
  if (!projectId) {
    new Logger('Auth').warn('FIREBASE_PROJECT_ID is not set, so every sign-in will be rejected');
    return new RejectAllTokenVerifier();
  }
  const app = getApps()[0] ?? initializeApp({ projectId });
  return new FirebaseTokenVerifier(getAuth(app));
}
