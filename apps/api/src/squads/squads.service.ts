import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSquad, StaffRole } from '@loadwise/shared';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { generateInviteCode } from './invite-code';

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

/** A collision is astronomically unlikely, but the unique constraint makes it safe to retry. */
const MAX_INVITE_CODE_ATTEMPTS = 3;

@Injectable()
export class SquadsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
