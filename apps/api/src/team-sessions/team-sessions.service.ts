import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays } from '@loadwise/analytics';
import { TEAM_SESSION_CREATOR_ROLES, TEAM_SESSION_RATING_DAYS } from '@loadwise/shared';
import type {
  CreatedTeamSession,
  CreateTeamSession,
  RateTeamSession,
  TeamSessionToRate,
} from '@loadwise/shared';
import { StaffAccessService } from '../access/staff-access.service';
import { clientIdTaken, IdempotentResult } from '../common/idempotent-write';
import { isUniqueViolation } from '../common/prisma-errors';
import { CLOCK, Clock, londonDate } from '../metrics/clock';
import { PrismaService } from '../prisma/prisma.service';
import { SavedSession, toSaved } from '../sessions/sessions.service';

// Messages name no athlete, squad or value, like StaffAccessService's.
export const CREATOR_ROLE_ONLY = 'Only a coach or S&C coach in this squad can log a team session';
export const TEAM_SESSION_NOT_FOUND = 'Team session not found';
export const ATHLETES_ONLY = 'Only athletes in this squad can add an RPE to a team session';
export const ALREADY_RATED = 'You have already added your RPE to this team session';
export const DATE_IN_FUTURE = 'A team session cannot be in the future';
export const DATE_TOO_OLD = `Team sessions can only be logged for the last ${TEAM_SESSION_RATING_DAYS} days`;

/** The same body shape as ZodValidationPipe, so the app shows this message like any other 400. */
function invalidDate(message: string): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: 'Validation failed',
    issues: [{ path: 'date', message }],
  });
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * #17: a coach logs a team session once, and each athlete adds their own RPE to it.
 *
 * The team session holds only what the coach knows (squad, type, date, duration). An athlete's
 * session row is created only when that athlete adds their RPE, so the health data is theirs
 * (DL-002), nothing is stored for athletes who did not train, and load is still calculated from
 * the Session row by @loadwise/analytics like any other session.
 */
@Injectable()
export class TeamSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StaffAccessService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * AC1: one request logs the session for the whole squad. 404 for a non-member, 403 for an
   * athlete or a physio (TEAM_SESSION_CREATOR_ROLES), 400 for a date outside the rating window.
   */
  async create(viewerId: string, squadId: string, input: CreateTeamSession): Promise<CreatedTeamSession> {
    const role = await this.access.requireStaff(viewerId, squadId);
    if (!TEAM_SESSION_CREATOR_ROLES.includes(role)) throw new ForbiddenException(CREATOR_ROLE_ONLY);

    const { today, earliest } = this.ratingWindow();
    if (input.date > today) throw invalidDate(DATE_IN_FUTURE);
    if (input.date < earliest) throw invalidDate(DATE_TOO_OLD);

    const row = await this.prisma.teamSession.create({
      data: {
        squadId,
        createdById: viewerId,
        type: input.type,
        date: new Date(input.date),
        durationMinutes: input.durationMinutes,
      },
    });
    const athletesAsked = await this.prisma.membership.count({ where: { squadId, role: 'ATHLETE' } });
    return {
      id: row.id,
      squadId: row.squadId,
      type: row.type,
      date: isoDay(row.date),
      durationMinutes: row.durationMinutes,
      athletesAsked,
    };
  }

  /**
   * AC2: the team sessions the athlete is asked to rate. That is every team session, from the last
   * TEAM_SESSION_RATING_DAYS days, in a squad where they are an athlete, that they have not rated.
   * Sessions dated before they joined the squad are left out, as they were not part of it then.
   * Sharing consent does not matter here: the athlete is reading their own squad's schedule.
   */
  async toRate(athleteId: string): Promise<TeamSessionToRate[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: athleteId, role: 'ATHLETE' },
      select: { squadId: true, joinedAt: true },
    });
    if (memberships.length === 0) return [];
    const joinedOn = new Map(memberships.map((m) => [m.squadId, londonDate(m.joinedAt)]));

    const { today, earliest } = this.ratingWindow();
    const rows = await this.prisma.teamSession.findMany({
      where: {
        squadId: { in: [...joinedOn.keys()] },
        date: { gte: new Date(earliest), lte: new Date(today) },
        sessions: { none: { athleteId } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        squadId: true,
        type: true,
        date: true,
        durationMinutes: true,
        squad: { select: { name: true } },
      },
    });
    return rows
      .filter((row) => isoDay(row.date) >= (joinedOn.get(row.squadId) ?? today))
      .map((row) => ({
        id: row.id,
        squadId: row.squadId,
        squadName: row.squad.name,
        type: row.type,
        date: isoDay(row.date),
        durationMinutes: row.durationMinutes,
      }));
  }

  /**
   * AC2: saves the athlete's RPE as their own session, with the team session's type, date and
   * duration, linked to it. 404 if the team session does not exist or the caller is not in its
   * squad (the same message, so ids cannot be probed); 403 for staff of the squad; 409 if the
   * athlete has already rated it. A repeated clientId returns the stored session (#6, DL-023).
   */
  async rate(
    athleteId: string,
    teamSessionId: string,
    input: RateTeamSession,
  ): Promise<IdempotentResult<SavedSession>> {
    const team = await this.prisma.teamSession.findUnique({ where: { id: teamSessionId } });
    if (!team) throw new NotFoundException(TEAM_SESSION_NOT_FOUND);
    const membership = await this.prisma.membership.findUnique({
      where: { userId_squadId: { userId: athleteId, squadId: team.squadId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException(TEAM_SESSION_NOT_FOUND);
    if (membership.role !== 'ATHLETE') throw new ForbiddenException(ATHLETES_ONLY);

    if (input.clientId) {
      const existing = await this.findReplay(athleteId, teamSessionId, input.clientId);
      if (existing) return { saved: existing, replayed: true };
    }
    try {
      const row = await this.prisma.session.create({
        data: {
          athleteId,
          squadId: team.squadId,
          teamSessionId,
          type: team.type,
          date: team.date,
          durationMinutes: team.durationMinutes,
          rpe: input.rpe,
          clientId: input.clientId,
        },
      });
      return { saved: toSaved(row), replayed: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Either this athlete has rated it already (athleteId + teamSessionId), or two copies of
      // the same request arrived together and the other one was stored first (clientId).
      if (input.clientId) {
        const existing = await this.findReplay(athleteId, teamSessionId, input.clientId);
        if (existing) return { saved: existing, replayed: true };
      }
      throw new ConflictException(ALREADY_RATED);
    }
  }

  /** Today and the first day of the rating window, as Europe/London calendar days. */
  private ratingWindow(): { today: string; earliest: string } {
    const today = londonDate(this.clock.now());
    return { today, earliest: addDays(today, -(TEAM_SESSION_RATING_DAYS - 1)) };
  }

  /**
   * The stored rating with this key, or null. A key already used for another athlete, or for a
   * different session of this athlete's, is a 409: it is not a replay of this request.
   */
  private async findReplay(athleteId: string, teamSessionId: string, clientId: string): Promise<SavedSession | null> {
    const row = await this.prisma.session.findUnique({ where: { clientId } });
    if (!row) return null;
    if (row.athleteId !== athleteId || row.teamSessionId !== teamSessionId) throw clientIdTaken();
    return toSaved(row);
  }
}
