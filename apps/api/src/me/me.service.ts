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

  /**
   * #14, UK GDPR Art. 17: erases the user and every record that is theirs, in one statement.
   * Deleting the User row lets PostgreSQL's foreign keys do the work (schema.prisma): their
   * memberships and squad consent history, health-consent history, sessions, check-ins, injuries,
   * restrictions and flags all cascade. Records they made about someone else (an injury or
   * restriction logged as staff, a team session) belong to that athlete or squad, so those stay and
   * only lose the link to the deleted user (SET NULL).
   *
   * The alternative, deleting table by table in a transaction, would need changing for every new
   * table, and a forgotten one would leave data behind; a cascade cannot forget a table that has a
   * foreign key to User. The real-PostgreSQL test (integration/account-deletion.int.ts) checks it.
   *
   * The Firebase sign-in is removed by the app afterwards (DL-035): the API's Firebase Admin setup
   * has no service account, and Firebase holds only the email address and name.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
