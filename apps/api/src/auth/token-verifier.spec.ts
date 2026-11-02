import { UnauthorizedException } from '@nestjs/common';
import { RejectAllTokenVerifier } from './token-verifier';

describe('NFR2: default token verifier', () => {
  it('rejects every token until Firebase is configured, so the API fails closed', async () => {
    await expect(new RejectAllTokenVerifier().verify()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
