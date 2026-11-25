import { ConflictException, Injectable } from '@nestjs/common';
import type { WellnessCheck } from '@loadwise/shared';
import { clientIdTaken, IdempotentResult } from '../common/idempotent-write';
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
  /** #6: the app's idempotency key, or null if it was saved without one. */
  clientId: string | null;
}

interface WellnessRow {
  id: string;
  athleteId: string;
  date: Date;
  sleep: number;
  soreness: number;
  fatigue: number;
  stress: number;
  clientId: string | null;
}

function toSaved(entry: WellnessRow): SavedWellness {
  return {
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    sleep: entry.sleep,
    soreness: entry.soreness,
    fatigue: entry.fatigue,
    stress: entry.stress,
    clientId: entry.clientId,
  };
}

@Injectable()
export class WellnessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR 1, #5: saves the athlete's daily check-in. The athlete is always the signed-in user, never
   * an id from the request body. AC2 (one entry per day) is enforced by @@unique([athleteId, date])
   * in the schema, so two check-ins sent at once still store only one.
   *
   * #6 AC3: a clientId already stored for this athlete returns that check-in and writes nothing.
   * A different clientId for a day that already has a check-in is still a 409 (#5 AC2), for
   * example a second phone that checked in offline on the same day.
   */
  async create(athleteId: string, input: WellnessCheck): Promise<IdempotentResult<SavedWellness>> {
    if (input.clientId) {
      const existing = await this.findByClientId(athleteId, input.clientId);
      if (existing) return { saved: existing, replayed: true };
    }
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
          clientId: input.clientId,
        },
      });
      return { saved: toSaved(entry), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Either unique index can fail. If this key is now stored, a copy of this same entry won a
      // race and this one is a replay; otherwise the day already had a check-in.
      if (input.clientId) {
        const existing = await this.findByClientId(athleteId, input.clientId);
        if (existing) return { saved: existing, replayed: true };
      }
      throw new ConflictException('You have already checked in today');
    }
  }

  /** The caller's check-in with this key, or null. A key stored for another athlete is a 409. */
  private async findByClientId(athleteId: string, clientId: string): Promise<SavedWellness | null> {
    const entry = await this.prisma.wellnessEntry.findUnique({ where: { clientId } });
    if (!entry) return null;
    if (entry.athleteId !== athleteId) throw clientIdTaken();
    return toSaved(entry);
  }
}
