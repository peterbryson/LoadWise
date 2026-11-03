import { authErrorMessage } from './auth-errors';

describe('FR4: sign-in error messages (#1)', () => {
  it('uses one message for a wrong email or a wrong password, so accounts cannot be probed', () => {
    const expected = 'Email or password is incorrect. Try again.';
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe(expected);
    expect(authErrorMessage({ code: 'auth/wrong-password' })).toBe(expected);
    expect(authErrorMessage({ code: 'auth/user-not-found' })).toBe(expected);
  });

  it('explains network and rate-limit failures in plain language', () => {
    expect(authErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/No connection/);
    expect(authErrorMessage({ code: 'auth/too-many-requests' })).toMatch(/Too many attempts/);
  });

  it('falls back to a generic message for unknown codes and non-Firebase errors', () => {
    const fallback = 'Something went wrong signing in. Try again.';
    expect(authErrorMessage({ code: 'auth/something-new' })).toBe(fallback);
    expect(authErrorMessage(new Error('boom'))).toBe(fallback);
    expect(authErrorMessage(null)).toBe(fallback);
  });
});
