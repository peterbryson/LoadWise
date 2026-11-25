/**
 * FR 2, #7: the response of `GET /me/load`, shared so the mobile app reads the same shape the API
 * sends. Dates are YYYY-MM-DD calendar days; loads are in arbitrary units (AU, RPE × minutes).
 * A response type, not a request schema, so there is no Zod schema to validate against.
 */
export interface MyLoad {
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
  monotony: number | null;
  strain: number | null;
}
