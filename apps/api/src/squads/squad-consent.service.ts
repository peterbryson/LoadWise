import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HEALTH_CONSENT_REQUIRED_MESSAGE } from '../consent/health-consent.guard';
import { PrismaService } from '../prisma/prisma.service';

/** The athlete's sharing state for one squad, as returned by PUT /squads/:squadId/consent. */
export interface SquadConsentState {
  squadId: string;
  consentGiven: boolean;
}

@Injectable()
export class SquadConsentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * #3, DL-002: an athlete starts or stops sharing their data with one squad. This is the only
   * place per-squad consent is written, so the ConsentEvent history and the cached
   * Membership.consentGiven always change together, in one transaction.
   *
   * Only the athlete themself can call it (the user id comes from their token), and only for an
   * ATHLETE membership: staff memberships have no consent to give. Granting also needs
   * health-data consent (DL-008); withdrawing never does, so an athlete can always stop sharing.
   *
   * Idempotent: the conditional update only matches while the state is the opposite of the one
   * asked for, and Postgres locks the row it updates, so repeating a request, or two arriving at
   * once, writes exactly one event. Only real changes appear in the consent history.
   */
  async setConsent(userId: string, squadId: string, share: boolean): Promise<SquadConsentState> {
    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { userId_squadId: { userId, squadId } },
        select: { id: true, role: true },
      });
      // Same 404 as the member list, so a non-member cannot tell whether a squad id exists.
      if (!membership) throw new NotFoundException('Squad not found');
      if (membership.role !== 'ATHLETE') {
        throw new ForbiddenException('Only athletes choose whether to share their data with a squad');
      }

      if (share) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { healthConsentAt: true },
        });
        if (!user?.healthConsentAt) throw new ForbiddenException(HEALTH_CONSENT_REQUIRED_MESSAGE);
      }

      const { count } = await tx.membership.updateMany({
        where: { id: membership.id, consentGiven: !share },
        data: { consentGiven: share },
      });
      if (count === 1) {
        await tx.consentEvent.create({
          data: { membershipId: membership.id, action: share ? 'GRANTED' : 'WITHDRAWN' },
        });
      }
    });
    return { squadId, consentGiven: share };
  }
}
