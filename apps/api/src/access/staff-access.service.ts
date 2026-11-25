import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { DataCategory, SquadRole, StaffRole } from '@loadwise/shared';
import { PrismaService } from '../prisma/prisma.service';
import { canView } from './staff-access.policy';

// Messages name no athlete, squad or value, so a refusal reveals nothing about anyone's data.
export const SQUAD_NOT_FOUND = 'Squad not found';
export const STAFF_ONLY = 'Only staff in this squad can see this';
export const ROLE_NOT_ALLOWED = 'Your role in this squad does not include this data';
export const NO_ATHLETE_ACCESS = 'You do not have access to this athlete’s data';

/**
 * #3, #11, NFR 2.2: the one place that decides whether a staff member may see an athlete's data.
 * Every check reads the database on every request, with no caching, so a withdrawn consent or a
 * removed membership takes effect on the very next request.
 */
@Injectable()
export class StaffAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The viewer's staff role in the squad. 404 if they are not in it, so a squad id cannot be
   * probed for existence; 403 if they are an athlete in it.
   */
  async requireStaff(viewerId: string, squadId: string): Promise<StaffRole> {
    const role = await this.roleIn(viewerId, squadId);
    if (role === 'ATHLETE') throw new ForbiddenException(STAFF_ONLY);
    return role;
  }

  /**
   * Allows the request only if all three hold, checked in this order:
   * 1. the viewer is a member of squadId (else 404);
   * 2. the viewer's role there includes the category (else 403);
   * 3. the athlete is an ATHLETE member of the same squad and currently shares data with it (else 403).
   *
   * The role is checked before the athlete is looked up, so a role without access learns nothing
   * about which athletes exist or share data. Every failure in step 3 gives the same message, so
   * "not in this squad", "not an athlete" and "not sharing" cannot be told apart.
   */
  async assertCanView(
    viewerId: string,
    squadId: string,
    athleteId: string,
    category: DataCategory,
  ): Promise<StaffRole> {
    const role = await this.roleIn(viewerId, squadId);
    if (role === 'ATHLETE' || !canView(role, category)) throw new ForbiddenException(ROLE_NOT_ALLOWED);

    const sharing = await this.prisma.membership.findFirst({
      where: { userId: athleteId, squadId, role: 'ATHLETE', consentGiven: true },
      select: { id: true },
    });
    if (!sharing) throw new ForbiddenException(NO_ATHLETE_ACCESS);
    return role;
  }

  private async roleIn(userId: string, squadId: string): Promise<SquadRole> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_squadId: { userId, squadId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException(SQUAD_NOT_FOUND);
    return membership.role;
  }
}
