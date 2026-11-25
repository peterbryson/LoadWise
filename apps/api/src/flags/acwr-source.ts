import { Injectable } from '@nestjs/common';

export const ACWR_SOURCE = Symbol('ACWR_SOURCE');

/**
 * Where the flags module gets today's EWMA ACWR. An interface so #9 does not depend on #7's
 * metrics module before it is merged; #7's EWMA ACWR replaces the pending implementation.
 */
export interface AcwrSource {
  /** Today's ACWR, or null while it is not shown yet (first 28 days, DL-007). */
  acwrFor(athleteId: string, today: string): Promise<number | null>;
}

/** Temporary: no ACWR until #7 is wired in, so the ACWR flag never fires yet. */
@Injectable()
export class PendingAcwrSource implements AcwrSource {
  acwrFor(): Promise<number | null> {
    return Promise.resolve(null);
  }
}
