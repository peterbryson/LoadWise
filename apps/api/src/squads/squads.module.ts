import { Module } from '@nestjs/common';
import { SquadConsentService } from './squad-consent.service';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';

@Module({
  controllers: [SquadsController],
  providers: [SquadsService, SquadConsentService],
})
export class SquadsModule {}
