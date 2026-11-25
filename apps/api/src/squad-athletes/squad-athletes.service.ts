import { Injectable } from '@nestjs/common';
import type { RecordInjury } from '@loadwise/shared';
import { PrismaService } from '../prisma/prisma.service';

/** One wellness check-in as staff see it. Scores are 1 (worst) to 5 (best). */
export interface StaffWellnessEntry {
  /** YYYY-MM-DD. */
  date: string;
  sleep: number;
  soreness: number;
  fatigue: number;
  stress: number;
}

/** An injury record. Dates are YYYY-MM-DD; returnDate is null until the athlete has returned. */
export interface InjuryRecord {
  id: string;
  bodyArea: string;
  onsetDate: string;
  returnDate: string | null;
  notes: string | null;
}

/** The DL-007 baseline window, so staff see the same span of check-ins the baseline uses. */
const WELLNESS_DAYS_SHOWN = 28;

const INJURY_FIELDS = {
  id: true,
  bodyArea: true,
  onsetDate: true,
  returnDate: true,
  notes: true,
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

/**
 * #11: reads and writes one athlete's data for staff. It never checks access itself: every
 * caller must sit behind @RequiresStaffAccess, which has already allowed the request.
 */
@Injectable()
export class SquadAthletesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The athlete's most recent check-ins, newest first. Selected fields only, no ids or timestamps. */
  async recentWellness(athleteId: string): Promise<StaffWellnessEntry[]> {
    const entries = await this.prisma.wellnessEntry.findMany({
      where: { athleteId },
      orderBy: { date: 'desc' },
      take: WELLNESS_DAYS_SHOWN,
      select: { date: true, sleep: true, soreness: true, fatigue: true, stress: true },
    });
    return entries.map((entry) => ({ ...entry, date: day(entry.date) }));
  }

  /** Every injury recorded for the athlete, most recent onset first. */
  async injuries(athleteId: string): Promise<InjuryRecord[]> {
    const injuries = await this.prisma.injury.findMany({
      where: { athleteId },
      orderBy: { onsetDate: 'desc' },
      select: INJURY_FIELDS,
    });
    return injuries.map(toInjuryRecord);
  }

  /** Records an injury; the recorder is always the signed-in physio, never a value from the body. */
  async recordInjury(athleteId: string, recordedById: string, input: RecordInjury): Promise<InjuryRecord> {
    const injury = await this.prisma.injury.create({
      data: {
        athleteId,
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
}
