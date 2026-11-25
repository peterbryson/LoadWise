import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { FlagsModule } from '../flags/flags.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SquadOverviewController } from './squad-overview.controller';
import { SquadOverviewService } from './squad-overview.service';

@Module({
  imports: [AccessModule, FlagsModule, MetricsModule],
  controllers: [SquadOverviewController],
  providers: [SquadOverviewService],
})
export class SquadOverviewModule {}
