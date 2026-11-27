import { z } from 'zod';
import type { StaffRole } from './squad';
import { SessionLogSchema, SessionType } from './session';

/**
 * #17: staff roles that may log a team session for a squad. Coaches and S&C coaches plan and run
 * team training; a physio's role is individual care, so they do not log sessions for everyone.
 * The API enforces this list; the app uses it only to decide whether to show the button.
 */
export const TEAM_SESSION_CREATOR_ROLES: readonly StaffRole[] = ['COACH', 'SC_COACH'];

/**
 * #17: how many days, counting today, an athlete is asked to rate a team session. A team session
 * can be logged for any of these days, so it is never logged too late for anyone to be asked.
 */
export const TEAM_SESSION_RATING_DAYS = 7;

/**
 * #17 AC1: a coach logs a team session once for the whole squad. Same rules as an athlete's own
 * session (#4), without the RPE: each athlete adds their own. Whether the date is in the allowed
 * window depends on "today", so the API checks that, not this schema.
 */
export const CreateTeamSessionSchema = SessionLogSchema.pick({ type: true, date: true, durationMinutes: true });

/**
 * #17 AC2: an athlete adds their RPE to a team session. The clientId makes a retry after a lost
 * response safe, as for #6: the same key returns the stored session instead of a 409.
 */
export const RateTeamSessionSchema = SessionLogSchema.pick({ rpe: true, clientId: true });

export type CreateTeamSession = z.infer<typeof CreateTeamSessionSchema>;
export type RateTeamSession = z.infer<typeof RateTeamSessionSchema>;

/** `POST /squads/:squadId/team-sessions`: the saved team session and how many athletes are asked. */
export interface CreatedTeamSession {
  id: string;
  squadId: string;
  type: SessionType;
  /** YYYY-MM-DD. */
  date: string;
  durationMinutes: number;
  /** The squad's athlete members now, each of whom is asked to add their RPE (AC2). */
  athletesAsked: number;
}

/** `GET /team-sessions/to-rate`: a team session the signed-in athlete has not yet rated. */
export interface TeamSessionToRate {
  id: string;
  squadId: string;
  squadName: string;
  type: SessionType;
  /** YYYY-MM-DD. */
  date: string;
  durationMinutes: number;
}
