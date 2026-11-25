import { Inject, Injectable } from '@nestjs/common';
import { loadSummary } from '@loadwise/analytics';
import type { LoadSummary } from '@loadwise/analytics';
import type { MyLoad } from '@loadwise/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CLOCK, Clock, londonDate } from './clock';

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * FR 2, #7: the athlete's load metrics, computed on read from their sessions; nothing derived is
   * stored. Every session up to today is read, not just the last 6 weeks, because the EWMA starts
   * from the first session and weights all history after it.
   */
  myLoad(athleteId: string): Promise<MyLoad> {
    return this.loadSummaryFor(athleteId, londonDate(this.clock.now()));
  }

  /** The same summary for a given day, so #9's ACWR flag uses exactly the ACWR GET /me/load shows. */
  async loadSummaryFor(athleteId: string, today: string): Promise<LoadSummary> {
    const rows = await this.prisma.session.findMany({
      where: { athleteId, date: { lte: new Date(today) } },
      select: { date: true, rpe: true, durationMinutes: true },
    });
    const sessions = rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      rpe: row.rpe,
      durationMinutes: row.durationMinutes,
    }));
    return loadSummary(sessions, today);
  }
}
