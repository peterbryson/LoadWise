import { corsOrigins } from './cors';

describe('NFR2: CORS allow-list', () => {
  it('allows no browser origins when CORS_ORIGINS is unset or empty', () => {
    expect(corsOrigins(undefined)).toBe(false);
    expect(corsOrigins('')).toBe(false);
    expect(corsOrigins(' , ')).toBe(false);
  });

  it('allows exactly the listed origins, ignoring spaces', () => {
    expect(corsOrigins('http://localhost:8081, http://localhost:19006')).toEqual([
      'http://localhost:8081',
      'http://localhost:19006',
    ]);
  });
});
