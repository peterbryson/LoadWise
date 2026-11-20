import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SessionLogSchema } from '@loadwise/shared';
import type { SessionLog } from '@loadwise/shared';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequiresHealthConsent } from '../consent/requires-health-consent.decorator';
import { SavedSession, SessionsService } from './sessions.service';

/** `GET /sessions?limit=`: 20 by default, at most 50, so one request can never return everything. */
export const RecentSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** FR 1, #4: the athlete's own training sessions and matches. Health data, so consent is required. */
@Controller('sessions')
@RequiresHealthConsent()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(SessionLogSchema)) body: SessionLog,
  ): Promise<SavedSession> {
    return this.sessions.create(user.id, body);
  }

  @Get()
  recent(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(RecentSessionsQuerySchema)) query: z.infer<typeof RecentSessionsQuerySchema>,
  ): Promise<SavedSession[]> {
    return this.sessions.recent(user.id, query.limit);
  }
}
