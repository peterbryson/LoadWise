import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SquadConsentService } from './squad-consent.service';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';

@Module({
  imports: [AccessModule],
  controllers: [SquadsController],
  providers: [SquadsService, SquadConsentService],
})
export class SquadsModule {}
