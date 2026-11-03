import { UnauthorizedException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  createTokenVerifier,
  FirebaseIdTokenChecker,
  FirebaseTokenVerifier,
} from './firebase-token-verifier';
import { RejectAllTokenVerifier } from './token-verifier';

function decoded(claims: Partial<DecodedIdToken>): DecodedIdToken {
  return { uid: 'fb-123', ...claims } as DecodedIdToken;
}

function firebaseError(code: string): Error {
  return Object.assign(new Error('Firebase says no'), { code });
}

function checkerReturning(result: Promise<DecodedIdToken>): FirebaseIdTokenChecker {
  return { verifyIdToken: jest.fn().mockReturnValue(result) };
}

describe('NFR2: Firebase token verifier (#1)', () => {
  it('returns the uid, email and name from a valid token', async () => {
    const checker = checkerReturning(
      Promise.resolve(decoded({ email: 'a@example.com', name: 'Aoife' })),
    );

    await expect(new FirebaseTokenVerifier(checker).verify('good-token')).resolves.toEqual({
      uid: 'fb-123',
      email: 'a@example.com',
      name: 'Aoife',
    });
    expect(checker.verifyIdToken).toHaveBeenCalledWith('good-token');
  });

  it('leaves the name out when the token has none', async () => {
    const checker = checkerReturning(Promise.resolve(decoded({ email: 'a@example.com' })));

    await expect(new FirebaseTokenVerifier(checker).verify('good-token')).resolves.toEqual({
      uid: 'fb-123',
      email: 'a@example.com',
      name: undefined,
    });
  });

  it('rejects a token without an email, since every LoadWise user needs one', async () => {
    const checker = checkerReturning(Promise.resolve(decoded({})));

    await expect(new FirebaseTokenVerifier(checker).verify('no-email')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each(['auth/argument-error', 'auth/id-token-expired', 'auth/invalid-id-token'])(
    'rejects with 401 when Firebase reports %s',
    async (code) => {
      const checker = checkerReturning(Promise.reject(firebaseError(code)));

      await expect(new FirebaseTokenVerifier(checker).verify('bad')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it('does not hide unexpected errors as a failed sign-in', async () => {
    const bug = new TypeError('unexpected');
    const checker = checkerReturning(Promise.reject(bug));

    await expect(new FirebaseTokenVerifier(checker).verify('token')).rejects.toBe(bug);
  });
});

describe('NFR2: choosing the token verifier (#1)', () => {
  it('fails closed with RejectAllTokenVerifier when no Firebase project is configured', () => {
    expect(createTokenVerifier(undefined)).toBeInstanceOf(RejectAllTokenVerifier);
    expect(createTokenVerifier('')).toBeInstanceOf(RejectAllTokenVerifier);
  });

  it('uses the Firebase verifier when a project ID is set', () => {
    expect(createTokenVerifier('loadwise-test')).toBeInstanceOf(FirebaseTokenVerifier);
  });
});
