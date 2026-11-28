import { Body, Controller, Get, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { CreateTeamSessionSchema, RateTeamSessionSchema } from '@loadwise/shared';
import type { CreatedTeamSession, CreateTeamSession, RateTeamSession, TeamSessionToRate } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { StatusSetter } from '../common/idempotent-write';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequiresHealthConsent } from '../consent/requires-health-consent.decorator';
import type { SavedSession } from '../sessions/sessions.service';
import { TeamSessionsService } from './team-sessions.service';

/**
 * #17 AC1: a coach or S&C coach logs a team session for their squad. Access is checked in the
 * service (404 for a non-member, 403 for other roles), after the body is validated, as for #2's
 * member list. No health data is written, so health-data consent is not required.
 */
@Controller('squads/:squadId/team-sessions')
export class SquadTeamSessionsController {
  constructor(private readonly teamSessions: TeamSessionsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('squadId') squadId: string,
    @Body(new ZodValidationPipe(CreateTeamSessionSchema)) body: CreateTeamSession,
  ): Promise<CreatedTeamSession> {
    return this.teamSessions.create(user.id, squadId, body);
  }
}

/**
 * #17 AC2: the athlete's side. Adding an RPE writes health data, so the whole controller needs
 * health-data consent, like POST /sessions.
 */
@Controller('team-sessions')
@RequiresHealthConsent()
export class TeamSessionsController {
  constructor(private readonly teamSessions: TeamSessionsService) {}

  @Get('to-rate')
  toRate(@CurrentUser() user: AuthUser): Promise<TeamSessionToRate[]> {
    return this.teamSessions.toRate(user.id);
  }

  /** 201 for a new rating; 200 when the clientId was already stored, as nothing new was created (#6). */
  @Post(':teamSessionId/rating')
  async rate(
    @CurrentUser() user: AuthUser,
    @Param('teamSessionId') teamSessionId: string,
    @Body(new ZodValidationPipe(RateTeamSessionSchema)) body: RateTeamSession,
    @Res({ passthrough: true }) response: StatusSetter,
  ): Promise<SavedSession> {
    const { saved, replayed } = await this.teamSessions.rate(user.id, teamSessionId, body);
    if (replayed) response.status(HttpStatus.OK);
    return saved;
  }
}
