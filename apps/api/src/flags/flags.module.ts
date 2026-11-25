import { Module } from '@nestjs/common';
import { DEFAULT_FLAG_THRESHOLDS } from '@loadwise/analytics';
import { ACWR_SOURCE, PendingAcwrSource } from './acwr-source';
import { FlagsController } from './flags.controller';
import { FLAG_THRESHOLDS, FlagsService } from './flags.service';
import { CLOCK, Clock } from './london-date';

const systemClock: Clock = () => new Date();

@Module({
  controllers: [FlagsController],
  providers: [
    FlagsService,
    { provide: ACWR_SOURCE, useClass: PendingAcwrSource },
    { provide: CLOCK, useValue: systemClock },
    { provide: FLAG_THRESHOLDS, useValue: { ...DEFAULT_FLAG_THRESHOLDS } },
  ],
})
export class FlagsModule {}
