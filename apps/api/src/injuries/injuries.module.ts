import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { InjuriesController } from './injuries.controller';
import { InjuriesService } from './injuries.service';

/** #11, #21: injury records and training restrictions for one athlete in one squad. */
@Module({
  imports: [AccessModule],
  controllers: [InjuriesController],
  providers: [InjuriesService],
})
export class InjuriesModule {}
