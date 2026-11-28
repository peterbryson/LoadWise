import { Inject, Injectable } from '@nestjs/common';
import {
  addDays,
  athleteStatus,
  BASELINE_WINDOW_DAYS,
  compareOverviewRows,
  evaluateFlags,
  flagChecks,
  loadSummary,
  loggingStatus,
  staffFlagReason,
  wellnessBaseline,
} from '@loadwise/analytics';
import type { Flag, FlagInputs, FlagThresholds, LoggedSession, WellnessEntry } from '@loadwise/analytics';
import type { OverviewAthlete, OverviewFlag, SharingAthlete, SquadOverview } from '@loadwise/shared';
import { canView } from '../access/staff-access.policy';
import { StaffAccessService } from '../access/staff-access.service';
import { FLAG_THRESHOLDS } from '../flags/flags.service';
import { CLOCK, Clock, londonDate } from '../metrics/clock';
import { PrismaService } from '../prisma/prisma.service';

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function groupByAthlete<T extends { athleteId: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.athleteId);
    if (group) group.push(row);
    else groups.set(row.athleteId, [row]);
  }
  return groups;
}

/**
 * #10: one squad's athletes with today's status, flags and combined load, for its staff.
 *
 * NFR 3.1 (p95 2 s for 40 athletes with a full season): rather than call the per-athlete services
 * 40 times (two queries each), every sharing athlete's sessions and recent check-ins are read in two
 * batched queries and grouped in memory. Each athlete then goes through exactly the same pure
 * functions as GET /me/load and GET /me/flags, so the overview can never disagree with what the
 * athlete sees. Nothing is stored (DL-019).
 */
@Injectable()
export class SquadOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StaffAccessService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FLAG_THRESHOLDS) private readonly thresholds: FlagThresholds,
  ) {}

  async overview(viewerId: string, squadId: string): Promise<SquadOverview> {
    const { role, squadName, athletes } = await this.access.squadAthletes(viewerId, squadId);
    const now = this.clock.now();
    const today = londonDate(now);
    // Only athletes who share data with this squad have any of it read (#3 AC2).
    const sharingIds = athletes.filter((athlete) => athlete.sharing).map((athlete) => athlete.id);
    const [sessions, checkIns] = sharingIds.length > 0 ? await this.read(sharingIds, today) : [new Map(), new Map()];
    const showScores = canView(role, 'WELLNESS_SCORES');

    const rows: OverviewAthlete[] = athletes.map((athlete) =>
      athlete.sharing
        ? this.sharingRow(athlete, today, sessions.get(athlete.id) ?? [], checkIns.get(athlete.id) ?? [], showScores)
        : { athleteId: athlete.id, displayName: athlete.displayName, sharing: false },
    );
    rows.sort((a, b) => compareOverviewRows(sortKey(a), sortKey(b)));

    return { squadId, squadName, date: today, viewerRole: role, generatedAt: now.toISOString(), athletes: rows };
  }

  private sharingRow(
    athlete: { id: string; displayName: string },
    today: string,
    sessions: LoggedSession[],
    checkIns: WellnessEntry[],
    showScores: boolean,
  ): SharingAthlete {
    const summary = loadSummary(sessions, today);
    const inputs: FlagInputs = {
      acwr: summary.acwr.value,
      wellnessToday: checkIns.find((entry) => entry.date === today) ?? null,
      baseline: wellnessBaseline(checkIns, today),
    };
    const flags = evaluateFlags(inputs, this.thresholds);
    const checks = flagChecks(inputs);
    return {
      athleteId: athlete.id,
      displayName: athlete.displayName,
      sharing: true,
      status: athleteStatus(flags, checks),
      flags: flags.map((flag) => this.forStaff(flag, showScores)),
      checks,
      // #50: from the same rows as the metrics, so no extra query (NFR 3.1); yes/no and a date only.
      logging: loggingStatus(sessions, checkIns, today),
      load: {
        thisWeek: summary.weeks[summary.weeks.length - 1]?.load ?? 0,
        usualWeek: summary.usualWeek,
        acwr: summary.acwr.value,
      },
    };
  }

  /** A coach sees a wellness flag's status but not the scores behind it (DL-022). */
  private forStaff(flag: Flag, showScores: boolean): OverviewFlag {
    const hideNumbers = flag.rule === 'WELLNESS_LOW' && !showScores;
    return {
      rule: flag.rule,
      metric: flag.metric,
      value: hideNumbers ? null : flag.value,
      threshold: hideNumbers ? null : flag.threshold,
      reason: staffFlagReason(flag, { showScores, sdBelow: this.thresholds.wellnessSdBelow }),
    };
  }

  /** Two queries for the whole squad; only the fields the calculations need are selected. */
  private async read(
    athleteIds: string[],
    today: string,
  ): Promise<[Map<string, LoggedSession[]>, Map<string, WellnessEntry[]>]> {
    const [sessionRows, wellnessRows] = await Promise.all([
      this.prisma.session.findMany({
        // Every session up to today: the EWMA weights all history since the first session (DL-019).
        where: { athleteId: { in: athleteIds }, date: { lte: new Date(today) } },
        select: { athleteId: true, date: true, rpe: true, durationMinutes: true },
      }),
      this.prisma.wellnessEntry.findMany({
        // The baseline window (previous 28 days) plus today, as for GET /me/flags.
        where: {
          athleteId: { in: athleteIds },
          date: { gte: new Date(addDays(today, -BASELINE_WINDOW_DAYS)), lte: new Date(today) },
        },
        select: { athleteId: true, date: true, sleep: true, soreness: true, fatigue: true, stress: true },
      }),
    ]);
    const sessions = new Map<string, LoggedSession[]>();
    for (const [athleteId, rows] of groupByAthlete(sessionRows)) {
      sessions.set(
        athleteId,
        rows.map((row) => ({ date: day(row.date), rpe: row.rpe, durationMinutes: row.durationMinutes })),
      );
    }
    const checkIns = new Map<string, WellnessEntry[]>();
    for (const [athleteId, rows] of groupByAthlete(wellnessRows)) {
      checkIns.set(
        athleteId,
        rows.map((row) => ({
          date: day(row.date),
          sleep: row.sleep,
          soreness: row.soreness,
          fatigue: row.fatigue,
          stress: row.stress,
        })),
      );
    }
    return [sessions, checkIns];
  }
}

function sortKey(row: OverviewAthlete) {
  return row.sharing
    ? { displayName: row.displayName, status: row.status, flagCount: row.flags.length }
    : { displayName: row.displayName, status: 'not-sharing' as const, flagCount: 0 };
}
