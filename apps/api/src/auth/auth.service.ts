import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { TOKEN_VERIFIER, TokenVerifier } from './token-verifier';

/** The signed-in user, attached to each request by AuthGuard. */
export interface AuthUser {
  id: string;
  firebaseUid: string;
}

const AUTH_USER_FIELDS = { id: true, firebaseUid: true } as const;

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

    const existing = await this.findByFirebaseUid(identity.uid);
    if (existing) return existing;

    try {
      return await this.prisma.user.create({
        data: {
          firebaseUid: identity.uid,
          email: identity.email,
          displayName: identity.name ?? identity.email.split('@')[0],
        },
        select: AUTH_USER_FIELDS,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // The app often fires several requests on first launch, so another one may have just
      // created this user.
      const created = await this.findByFirebaseUid(identity.uid);
      if (created) return created;

      // Otherwise the email belongs to a different Firebase account. Accounts are never linked by
      // email, as that would let anyone who signs up with a matching address take one over.
      throw new ConflictException('This email address is already linked to another account');
    }
  }

  private findByFirebaseUid(firebaseUid: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({ where: { firebaseUid }, select: AUTH_USER_FIELDS });
  }
}
