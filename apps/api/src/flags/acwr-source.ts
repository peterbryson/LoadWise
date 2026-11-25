import { Injectable } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';

export const ACWR_SOURCE = Symbol('ACWR_SOURCE');

/** Where the flags module gets today's EWMA ACWR. An interface so flag tests can supply a value. */
export interface AcwrSource {
  /** Today's ACWR, or null while it is not shown yet (first 28 days, DL-007). */
  acwrFor(athleteId: string, today: string): Promise<number | null>;
}

/**
 * #7's EWMA ACWR from the athlete's sessions, through the same MetricsService code as
 * GET /me/load, so a flag can never disagree with the ratio on the Trends tab.
 */
@Injectable()
export class MetricsAcwrSource implements AcwrSource {
  constructor(private readonly metrics: MetricsService) {}

  async acwrFor(athleteId: string, today: string): Promise<number | null> {
    return (await this.metrics.loadSummaryFor(athleteId, today)).acwr.value;
  }
}
