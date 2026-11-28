import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SquadTeamSessionsController, TeamSessionsController } from './team-sessions.controller';
import { TeamSessionsService } from './team-sessions.service';

/** #17: team sessions. MetricsModule provides CLOCK, so "today" matches GET /me/load. */
@Module({
  imports: [AccessModule, MetricsModule],
  controllers: [SquadTeamSessionsController, TeamSessionsController],
  providers: [TeamSessionsService],
})
export class TeamSessionsModule {}
