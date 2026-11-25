import { Inject, Injectable } from '@nestjs/common';
import {
  baselineCheckIns,
  BASELINE_WINDOW_DAYS,
  evaluateFlags,
  MIN_BASELINE_CHECK_INS,
  wellnessBaseline,
  wellnessTrend,
} from '@loadwise/analytics';
import type { Flag, FlagThresholds, WellnessEntry, WellnessTrendPoint } from '@loadwise/analytics';
import { PrismaService } from '../prisma/prisma.service';
import { ACWR_SOURCE, AcwrSource } from './acwr-source';
import { CLOCK, Clock, isoDaysBefore, londonDate } from './london-date';

/** The flag rules in use. Configurable because they are hypotheses until the Sprint 4 spike (DL-007). */
export const FLAG_THRESHOLDS = Symbol('FLAG_THRESHOLDS');

/** "Last 6 weeks", as on the Trends tab design. */
export const TREND_WEEKS = 6;

/** `GET /me/flags`. */
export interface CurrentFlags {
  /** The UK calendar day the flags are for, YYYY-MM-DD. */
  date: string;
  flags: Flag[];
}

/** `GET /me/wellness-trend` (#9 AC3). */
export interface WellnessTrendResponse {
  date: string;
  /** Check-ins in the current baseline window, so the app can show "n of 14" while it builds. */
  baselineCheckIns: number;
  minCheckIns: number;
  /** Oldest first; the last week ends today. */
  weeks: WellnessTrendPoint[];
}

/**
 * #9: flags and wellness trends are calculated by @loadwise/analytics on each request rather than
 * stored, so they always match the latest data and a changed threshold applies straight away.
 */
@Injectable()
export class FlagsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACWR_SOURCE) private readonly acwr: AcwrSource,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FLAG_THRESHOLDS) private readonly thresholds: FlagThresholds,
  ) {}

  async currentFlags(athleteId: string): Promise<CurrentFlags> {
    const today = londonDate(this.clock());
    const [entries, acwr] = await Promise.all([
      this.wellnessSince(athleteId, isoDaysBefore(today, BASELINE_WINDOW_DAYS), today),
      this.acwr.acwrFor(athleteId, today),
    ]);
    const todayEntry = entries.find((entry) => entry.date === today) ?? null;
    const flags = evaluateFlags(
      { acwr, wellnessToday: todayEntry, baseline: wellnessBaseline(entries, today) },
      this.thresholds,
    );
    return { date: today, flags };
  }

  async wellnessTrend(athleteId: string): Promise<WellnessTrendResponse> {
    const today = londonDate(this.clock());
    // The oldest week's baseline reaches back 28 days before that week's last day.
    const from = isoDaysBefore(today, (TREND_WEEKS - 1) * 7 + BASELINE_WINDOW_DAYS);
    const entries = await this.wellnessSince(athleteId, from, today);
    return {
      date: today,
      baselineCheckIns: baselineCheckIns(entries, today),
      minCheckIns: MIN_BASELINE_CHECK_INS,
      weeks: wellnessTrend(entries, today, TREND_WEEKS),
    };
  }

  /** Only the four scores and the date are read: nothing else is needed for the calculation. */
  private async wellnessSince(athleteId: string, from: string, to: string): Promise<WellnessEntry[]> {
    const rows = await this.prisma.wellnessEntry.findMany({
      where: { athleteId, date: { gte: new Date(from), lte: new Date(to) } },
      select: { date: true, sleep: true, soreness: true, fatigue: true, stress: true },
      orderBy: { date: 'asc' },
    });
    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      sleep: row.sleep,
      soreness: row.soreness,
      fatigue: row.fatigue,
      stress: row.stress,
    }));
  }
}
