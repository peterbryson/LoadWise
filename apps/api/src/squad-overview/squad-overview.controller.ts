import { Controller, Get, Param } from '@nestjs/common';
import type { SquadOverview } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { SquadOverviewService } from './squad-overview.service';

/**
 * #10: the squad overview for staff of the squad. Access is decided inside the service by
 * StaffAccessService.squadAthletes (404 for a non-member, 403 for an athlete), because a list route
 * has no single :athleteId for StaffAccessGuard to check.
 */
@Controller('squads/:squadId/overview')
export class SquadOverviewController {
  constructor(private readonly overview: SquadOverviewService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('squadId') squadId: string): Promise<SquadOverview> {
    return this.overview.overview(user.id, squadId);
  }
}
