import { ConflictException, Injectable } from '@nestjs/common';
import type { WellnessCheck } from '@loadwise/shared';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';

/** A saved check-in, as returned by POST /wellness. */
export interface SavedWellness {
  id: string;
  /** The calendar day the check-in is for, YYYY-MM-DD. */
  date: string;
  sleep: number;
  soreness: number;
  fatigue: number;
  stress: number;
}

@Injectable()
export class WellnessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR 1, #5: saves the athlete's daily check-in. The athlete is always the signed-in user, never
   * an id from the request body. AC2 (one entry per day) is enforced by @@unique([athleteId, date])
   * in the schema, so two check-ins sent at once still store only one.
   */
  async create(athleteId: string, input: WellnessCheck): Promise<SavedWellness> {
    try {
      const entry = await this.prisma.wellnessEntry.create({
        data: {
          athleteId,
          // A @db.Date column: Prisma stores the calendar day of this UTC-midnight date.
          date: new Date(input.date),
          sleep: input.sleep,
          soreness: input.soreness,
          fatigue: input.fatigue,
          stress: input.stress,
        },
      });
      return {
        id: entry.id,
        date: entry.date.toISOString().slice(0, 10),
        sleep: entry.sleep,
        soreness: entry.soreness,
        fatigue: entry.fatigue,
        stress: entry.stress,
      };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('You have already checked in today');
      throw error;
    }
  }
}
