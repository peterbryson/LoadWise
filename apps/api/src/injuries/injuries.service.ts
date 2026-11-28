import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  InjuryRecord,
  RecordInjury,
  RecordRestriction,
  TrainingRestriction,
} from '@loadwise/shared';
import { PrismaService } from '../prisma/prisma.service';

export const RESTRICTION_NOT_FOUND = 'Restriction not found';

const INJURY_FIELDS = {
  id: true,
  bodyArea: true,
  onsetDate: true,
  returnDate: true,
  notes: true,
} as const;

/** Everything a restriction response needs and nothing else: no athlete, recorder or injury link. */
const RESTRICTION_FIELDS = {
  id: true,
  description: true,
  reviewOn: true,
  endedAt: true,
  createdAt: true,
} as const;

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toInjuryRecord(injury: {
  id: string;
  bodyArea: string;
  onsetDate: Date;
  returnDate: Date | null;
  notes: string | null;
}): InjuryRecord {
  return {
    id: injury.id,
    bodyArea: injury.bodyArea,
    onsetDate: day(injury.onsetDate),
    returnDate: injury.returnDate ? day(injury.returnDate) : null,
    notes: injury.notes,
  };
}

function toRestriction(restriction: {
  id: string;
  description: string;
  reviewOn: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}): TrainingRestriction {
  return {
    id: restriction.id,
    description: restriction.description,
    reviewOn: restriction.reviewOn ? day(restriction.reviewOn) : null,
    recordedAt: restriction.createdAt.toISOString(),
    active: restriction.endedAt === null,
  };
}

/**
 * #11, #21: injuries and training restrictions for one athlete in one squad. Every query is scoped
 * to both the athlete and the squad in the path (I-14), so a physio in another squad the athlete
 * shares with never sees what this squad's physio recorded.
 *
 * It never checks access itself: every caller must sit behind @RequiresStaffAccess, which has
 * already confirmed the viewer's role in this squad and that the athlete shares data with it.
 */
@Injectable()
export class InjuriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every injury this squad's physios recorded for the athlete, most recent onset first. */
  async injuries(squadId: string, athleteId: string): Promise<InjuryRecord[]> {
    const injuries = await this.prisma.injury.findMany({
      where: { athleteId, squadId },
      orderBy: { onsetDate: 'desc' },
      select: INJURY_FIELDS,
    });
    return injuries.map(toInjuryRecord);
  }

  /** Records an injury; the squad and recorder come from the path and token, never the body. */
  async recordInjury(
    squadId: string,
    athleteId: string,
    recordedById: string,
    input: RecordInjury,
  ): Promise<InjuryRecord> {
    const injury = await this.prisma.injury.create({
      data: {
        athleteId,
        squadId,
        recordedById,
        bodyArea: input.bodyArea,
        // @db.Date columns: Prisma stores the calendar day of these UTC-midnight dates.
        onsetDate: new Date(input.onsetDate),
        returnDate: input.returnDate ? new Date(input.returnDate) : null,
        notes: input.notes || null,
      },
      select: INJURY_FIELDS,
    });
    return toInjuryRecord(injury);
  }

  /** #21 AC2: the athlete's active restrictions in this squad, newest first. Ended ones are kept but not listed. */
  async activeRestrictions(squadId: string, athleteId: string): Promise<TrainingRestriction[]> {
    const restrictions = await this.prisma.restriction.findMany({
      where: { athleteId, squadId, endedAt: null },
      orderBy: { createdAt: 'desc' },
      select: RESTRICTION_FIELDS,
    });
    return restrictions.map(toRestriction);
  }

  async addRestriction(
    squadId: string,
    athleteId: string,
    recordedById: string,
    input: RecordRestriction,
  ): Promise<TrainingRestriction> {
    const restriction = await this.prisma.restriction.create({
      data: {
        athleteId,
        squadId,
        recordedById,
        description: input.description,
        reviewOn: input.reviewOn ? new Date(input.reviewOn) : null,
      },
      select: RESTRICTION_FIELDS,
    });
    return toRestriction(restriction);
  }

  /**
   * Ends a restriction. 404 unless it belongs to this athlete in this squad, so an id from another
   * squad cannot be ended or probed. Ending one that has already ended changes nothing, so a
   * repeated tap or retry is safe and the original end time is kept.
   */
  async endRestriction(
    squadId: string,
    athleteId: string,
    restrictionId: string,
  ): Promise<TrainingRestriction> {
    const existing = await this.prisma.restriction.findFirst({
      where: { id: restrictionId, athleteId, squadId },
      select: RESTRICTION_FIELDS,
    });
    if (!existing) throw new NotFoundException(RESTRICTION_NOT_FOUND);
    if (existing.endedAt) return toRestriction(existing);

    const ended = await this.prisma.restriction.update({
      where: { id: restrictionId },
      data: { endedAt: new Date() },
      select: RESTRICTION_FIELDS,
    });
    return toRestriction(ended);
  }
}
