import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TOKEN_VERIFIER, TokenVerifier } from './token-verifier';

/** The signed-in user, attached to each request by AuthGuard. */
export interface AuthUser {
  id: string;
  firebaseUid: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verifies the token, then finds the matching LoadWise user, creating them on their first
   * request. Firebase only proves who someone is; their LoadWise record lives in our database.
   */
  async authenticate(token: string): Promise<AuthUser> {
    const identity = await this.verifier.verify(token);

    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: identity.uid },
      select: { id: true, firebaseUid: true },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        firebaseUid: identity.uid,
        email: identity.email,
        displayName: identity.name ?? identity.email.split('@')[0],
      },
      select: { id: true, firebaseUid: true },
    });
  }
}
