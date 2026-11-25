import { Module } from '@nestjs/common';
import { CLOCK, systemClock } from './clock';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: CLOCK, useValue: systemClock }],
  exports: [MetricsService],
})
export class MetricsModule {}
