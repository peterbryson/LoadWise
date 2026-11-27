import { Injectable } from '@nestjs/common';
import type { LoadDetail, LoadTotals } from '@loadwise/shared';
import { MetricsService } from '../metrics/metrics.service';
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

/** The DL-007 baseline window, so staff see the same span of check-ins the baseline uses. */
const WELLNESS_DAYS_SHOWN = 28;

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * #11: reads one athlete's data for staff. It never checks access itself: every
 * caller must sit behind @RequiresStaffAccess, which has already allowed the request.
 */
@Injectable()
export class SquadAthletesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * #8: the athlete's combined load, the same totals the athlete sees on Trends. MetricsService reads
   * every session the athlete logged, whichever squad it was for, so each session counts once
   * (AC1), and staff of every squad the athlete shares with see the same totals (AC2). Only the
   * totals are returned, never the sessions behind them (DL-022).
   */
  async combinedLoad(athleteId: string): Promise<LoadTotals> {
    const { today, weeks, usualWeek, acwr } = await this.metrics.myLoad(athleteId);
    return { today, weeks, usualWeek, acwr };
  }

  /** #8 with #11: monotony and strain from the same combined sessions, for the LOAD_DETAIL category. */
  async combinedLoadDetail(athleteId: string): Promise<LoadDetail> {
    const { today, monotony, strain } = await this.metrics.myLoad(athleteId);
    return { today, monotony, strain };
  }

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
}
