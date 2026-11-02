import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L, so codes can be read aloud or copied off a whiteboard. Matches INVITE_CODE_PATTERN. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/**
 * A random invite code. 31^8 ≈ 850 billion possibilities, so guessing one is impractical.
 * randomInt is cryptographically secure, unlike Math.random.
 */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
