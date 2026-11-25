import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SquadAthletesController } from './squad-athletes.controller';
import { SquadAthletesService } from './squad-athletes.service';

@Module({
  imports: [AccessModule],
  controllers: [SquadAthletesController],
  providers: [SquadAthletesService],
})
export class SquadAthletesModule {}
