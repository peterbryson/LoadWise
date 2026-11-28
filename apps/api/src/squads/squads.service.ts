import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSquad, StaffRole } from '@loadwise/shared';
import { SQUAD_NOT_FOUND, StaffAccessService } from '../access/staff-access.service';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { generateInviteCode } from './invite-code';

/**
 * One of the caller's squads, from GET /squads. Athletes see whether they share data with it;
 * only staff see its invite code.
 */
export type MySquad =
  | { squadId: string; squadName: string; role: 'ATHLETE'; consentGiven: boolean }
  | { squadId: string; squadName: string; role: StaffRole; inviteCode: string };

/** A member of a squad, from GET /squads/:squadId/members. Never includes health data or email. */
export type SquadMember =
  | { userId: string; displayName: string; role: 'ATHLETE'; consentGiven: boolean }
  | { userId: string; displayName: string; role: StaffRole };

export interface CreatedSquad {
  id: string;
  name: string;
  inviteCode: string;
  role: StaffRole;
}

export interface JoinedSquad {
  squadId: string;
  squadName: string;
  role: 'ATHLETE';
}

/**
 * #49: a squad's invite code, for its staff. `canReplace` tells the app whether to offer the
 * replace action; the API still checks the role on every replace request.
 */
export interface SquadInvite {
  squadId: string;
  squadName: string;
  inviteCode: string;
  canReplace: boolean;
}

// Names no squad or person, so the refusal reveals nothing beyond the caller's own role.
export const COACH_ONLY_REPLACE = 'Only a coach in this squad can replace its invite code';

/** A collision is astronomically unlikely, but the unique constraint makes it safe to retry. */
const MAX_INVITE_CODE_ATTEMPTS = 3;

@Injectable()
export class SquadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StaffAccessService,
  ) {}

  /** #2: creates a squad and makes the creator a member with their chosen staff role. */
  async create(userId: string, input: CreateSquad): Promise<CreatedSquad> {
    for (let attempt = 1; ; attempt++) {
      try {
        // A nested create runs as one statement, so there is never a squad without its creator.
        const squad = await this.prisma.squad.create({
          data: {
            name: input.name,
            inviteCode: generateInviteCode(),
            memberships: { create: { userId, role: input.role } },
          },
        });
        return { id: squad.id, name: squad.name, inviteCode: squad.inviteCode, role: input.role };
      } catch (error) {
        if (!isUniqueViolation(error) || attempt >= MAX_INVITE_CODE_ATTEMPTS) throw error;
      }
    }
  }

  /**
   * #2: an athlete joins a squad with its invite code. The code only ever grants the ATHLETE role,
   * so sharing it cannot give anyone staff access. Consent starts as not given (#3).
   */
  async join(userId: string, inviteCode: string): Promise<JoinedSquad> {
    const squad = await this.prisma.squad.findUnique({ where: { inviteCode } });
    if (!squad) throw new NotFoundException('No squad matches that invite code');

    try {
      await this.prisma.membership.create({
        data: { userId, squadId: squad.id, role: 'ATHLETE' },
      });
    } catch (error) {
      // @@unique([userId, squadId]) in the schema: this user is already in the squad.
      if (isUniqueViolation(error)) throw new ConflictException('You are already in this squad');
      throw error;
    }

    return { squadId: squad.id, squadName: squad.name, role: 'ATHLETE' };
  }

  /** #2 AC3: every squad the caller belongs to, in the order they joined. */
  async listMine(userId: string): Promise<MySquad[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        consentGiven: true,
        squad: { select: { id: true, name: true, inviteCode: true } },
      },
    });
    return memberships.map(({ role, consentGiven, squad }) =>
      role === 'ATHLETE'
        ? { squadId: squad.id, squadName: squad.name, role, consentGiven }
        : { squadId: squad.id, squadName: squad.name, role, inviteCode: squad.inviteCode },
    );
  }

  /**
   * #2 AC3: the members of a squad, for its staff only. A non-member gets 404 rather than 403 so
   * the response does not confirm that a squad id exists. Athletes in the squad get 403: they know
   * the squad exists, but not who else is in it.
   */
  async listMembers(viewerId: string, squadId: string): Promise<SquadMember[]> {
    await this.access.requireStaff(viewerId, squadId);

    const members = await this.prisma.membership.findMany({
      where: { squadId },
      orderBy: { joinedAt: 'asc' },
      select: { role: true, consentGiven: true, user: { select: { id: true, displayName: true } } },
    });
    return members.map(({ role, consentGiven, user }) =>
      role === 'ATHLETE'
        ? { userId: user.id, displayName: user.displayName, role, consentGiven }
        : { userId: user.id, displayName: user.displayName, role },
    );
  }

  /** #49 AC1, AC4: the squad's current invite code. 404 for a non-member, 403 for an athlete. */
  async inviteCode(viewerId: string, squadId: string): Promise<SquadInvite> {
    const role = await this.access.requireStaff(viewerId, squadId);
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      select: { id: true, name: true, inviteCode: true },
    });
    // Membership was just found, so the squad exists unless it was deleted in between.
    if (!squad) throw new NotFoundException(SQUAD_NOT_FOUND);
    return toInvite(squad, role);
  }

  /**
   * #49 AC3, AC4: replaces the squad's invite code with a new random one, so the old code no longer
   * joins the squad (join looks squads up by their current code). Only a COACH in the squad may do
   * this (DL-0XX); other staff get 403. Members who already joined are not affected.
   */
  async replaceInviteCode(viewerId: string, squadId: string): Promise<SquadInvite> {
    const role = await this.access.requireStaff(viewerId, squadId);
    if (role !== 'COACH') throw new ForbiddenException(COACH_ONLY_REPLACE);

    for (let attempt = 1; ; attempt++) {
      try {
        const squad = await this.prisma.squad.update({
          where: { id: squadId },
          data: { inviteCode: generateInviteCode() },
          select: { id: true, name: true, inviteCode: true },
        });
        return toInvite(squad, role);
      } catch (error) {
        // Another squad already has this code: the unique constraint refused it, so try another.
        if (!isUniqueViolation(error) || attempt >= MAX_INVITE_CODE_ATTEMPTS) throw error;
      }
    }
  }
}

function toInvite(
  squad: { id: string; name: string; inviteCode: string },
  role: StaffRole,
): SquadInvite {
  return {
    squadId: squad.id,
    squadName: squad.name,
    inviteCode: squad.inviteCode,
    canReplace: role === 'COACH',
  };
}
