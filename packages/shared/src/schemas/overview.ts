import type { StaffRole } from './squad';

/**
 * #10: the response of `GET /squads/:squadId/overview`, for staff of that squad. A response type,
 * not a request schema, so there is no Zod schema to validate against.
 */

/** flagged: a rule fired today. clear: both rules ran, nothing fired. incomplete: a rule could not run. */
export type OverviewStatus = 'flagged' | 'clear' | 'incomplete';

export interface OverviewFlag {
  rule: 'ACWR_HIGH' | 'WELLNESS_LOW';
  metric: 'acwr' | 'sleep' | 'soreness' | 'fatigue' | 'stress';
  /**
   * The measured value and the guide it crossed. For a wellness flag these are individual scores,
   * so they are null for a role without WELLNESS_SCORES (a coach, DL-022); the reason then gives the
   * status only.
   */
  value: number | null;
  threshold: number | null;
  /** Third-person reason from the deterministic engine, never from an LLM. */
  reason: string;
}

export interface OverviewChecks {
  acwr: 'checked' | 'unavailable';
  wellness: 'checked' | 'no-baseline' | 'no-check-in';
}

/** An athlete who does not share data with this squad: their name only, no data (#3 AC2). */
export interface NotSharingAthlete {
  athleteId: string;
  displayName: string;
  sharing: false;
}

/** An athlete who shares data with this squad, with today's status, flags and combined load (#8). */
export interface SharingAthlete {
  athleteId: string;
  displayName: string;
  sharing: true;
  status: OverviewStatus;
  flags: OverviewFlag[];
  checks: OverviewChecks;
  /**
   * #50: whether they have logged. A yes/no and a date, never scores, so every staff role sees it
   * (a coach gets wellness status only, DL-022). Never sent for an athlete who does not share.
   */
  logging: {
    /** A wellness check-in is dated today (the overview's Europe/London date). */
    checkedInToday: boolean;
    /** Latest session on or before today, YYYY-MM-DD, from any of their squads (#8); null if none. */
    lastSessionDate: string | null;
  };
  load: {
    /** This Monday-to-Sunday week so far, in AU. */
    thisWeek: number;
    usualWeek: number | null;
    /** EWMA ACWR; null in the first 28 days (DL-007). */
    acwr: number | null;
  };
}

export type OverviewAthlete = NotSharingAthlete | SharingAthlete;

export interface SquadOverview {
  squadId: string;
  squadName: string;
  /** The Europe/London calendar day the statuses are for, YYYY-MM-DD. */
  date: string;
  viewerRole: StaffRole;
  /** #50 AC3: when the API built this overview, as an ISO 8601 timestamp. */
  generatedAt: string;
  /** Every athlete in the squad, problems first: flagged, incomplete, clear, then not sharing. */
  athletes: OverviewAthlete[];
}
