import { Inject, Injectable } from '@nestjs/common';
import { loadSummary } from '@loadwise/analytics';
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
  async myLoad(athleteId: string): Promise<MyLoad> {
    const today = londonDate(this.clock.now());
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
