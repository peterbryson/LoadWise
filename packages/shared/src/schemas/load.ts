/**
 * FR 2, #7 and #8: load response shapes, shared so the mobile app reads the same shape the API
 * sends. Dates are YYYY-MM-DD calendar days; loads are in arbitrary units (AU, RPE × minutes).
 * Response types, not request schemas, so there is no Zod schema to validate against.
 */

/**
 * Weekly load and ACWR. Staff with the LOAD category see exactly this for a consenting athlete
 * (#8 AC2, `GET /squads/:squadId/athletes/:athleteId/load`): totals only, never the sessions behind
 * them, so a squad learns nothing about which other squad a session was logged for (DL-022).
 */
export interface LoadTotals {
  /** The Europe/London calendar day the metrics were calculated for. */
  today: string;
  /** The last 6 Monday-to-Sunday weeks, oldest first; the last one is this week so far. */
  weeks: { weekStart: string; load: number; partial: boolean }[];
  /** Mean of the last 4 completed weeks (DL-007); null until 4 weeks have passed since the first session. */
  usualWeek: number | null;
  acwr: {
    model: 'EWMA' | 'ROLLING';
    /** Null before `availableFrom`, or when there is no chronic load to compare against. */
    value: number | null;
    /** First session + 28 days (DL-007); null when nothing has been logged yet. */
    availableFrom: string | null;
  };
}

/**
 * Monotony and strain, the LOAD_DETAIL category: S&C coaches and physios only
 * (`GET /squads/:squadId/athletes/:athleteId/load-detail`).
 */
export interface LoadDetail {
  today: string;
  monotony: number | null;
  strain: number | null;
}

/** The athlete's own view, `GET /me/load`: the totals and the detail together. */
export interface MyLoad extends LoadTotals {
  monotony: number | null;
  strain: number | null;
}
