import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { WellnessController } from './wellness.controller';
import { WellnessService } from './wellness.service';

/** MetricsModule provides CLOCK, so "today" matches GET /me/load (#45). */
@Module({
  imports: [MetricsModule],
  controllers: [WellnessController],
  providers: [WellnessService],
})
export class WellnessModule {}
