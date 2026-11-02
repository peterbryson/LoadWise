import { INVITE_CODE_PATTERN } from '@loadwise/shared';
import { generateInviteCode, INVITE_CODE_ALPHABET } from './invite-code';

describe('FR4: invite code generation (#2)', () => {
  it('always produces a code the shared schema accepts', () => {
    // Guards against the API alphabet and the shared pattern drifting apart.
    for (let i = 0; i < 500; i++) {
      expect(generateInviteCode()).toMatch(INVITE_CODE_PATTERN);
    }
  });

  it('never uses look-alike characters', () => {
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
});
