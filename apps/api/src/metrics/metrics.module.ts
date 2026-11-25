import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from './clock';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: CLOCK, useValue: systemClock }],
  // CLOCK is exported so the squad overview (#10) uses the same "today" as GET /me/load.
  exports: [MetricsService, CLOCK],
})
export class MetricsModule {}
