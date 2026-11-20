import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** The signed-in user's own account details, as returned by GET /me. */
export interface Me {
  id: string;
  email: string;
  displayName: string;
  healthConsentGiven: boolean;
  /** ISO timestamp of when health-data consent was given, or null. */
  healthConsentAt: string | null;
}

const ME_FIELDS = { id: true, email: true, displayName: true, healthConsentAt: true } as const;

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<Me> {
    // AuthGuard has just found or created this user, so it always exists.
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: ME_FIELDS,
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      healthConsentGiven: user.healthConsentAt !== null,
      healthConsentAt: user.healthConsentAt?.toISOString() ?? null,
    };
  }

  /**
   * #1 AC4, DL-008: records explicit consent to health-data processing. The only place this
   * consent is written, so the event history and the cached User.healthConsentAt stay in step.
   *
   * Giving consent again is harmless: the conditional update only matches while consent is not yet
   * recorded, and Postgres locks the row, so two requests at once still create exactly one event.
   */
  async giveHealthConsent(userId: string, noticeVersion: string): Promise<Me> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.user.updateMany({
        where: { id: userId, healthConsentAt: null },
        data: { healthConsentAt: now },
      });
      if (count === 1) {
        await tx.healthConsentEvent.create({
          data: { userId, action: 'GRANTED', noticeVersion, createdAt: now },
        });
      }
    });
    return this.get(userId);
  }
}
