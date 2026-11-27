import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { RecordInjurySchema, RecordRestrictionSchema } from '@loadwise/shared';
import type {
  InjuryRecord,
  RecordInjury,
  RecordRestriction,
  TrainingRestriction,
} from '@loadwise/shared';
import { RequiresStaffAccess } from '../access/requires-staff-access.decorator';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InjuriesService } from './injuries.service';

/**
 * #11, #21: injuries (physio only) and training restrictions (every staff role) for one athlete in
 * one squad. StaffAccessGuard allows each route only for staff of this squad whose role includes
 * its category, and only while the athlete shares data with this squad (#3).
 *
 * Writes to restrictions use the INJURY category, not RESTRICTIONS: only the role that may see the
 * injury may set or end the restriction that follows from it. Coaches can read restrictions only.
 */
@Controller('squads/:squadId/athletes/:athleteId')
export class InjuriesController {
  constructor(private readonly injuriesService: InjuriesService) {}

  @Get('injuries')
  @RequiresStaffAccess('INJURY')
  injuries(
    @Param('squadId') squadId: string,
    @Param('athleteId') athleteId: string,
  ): Promise<InjuryRecord[]> {
    return this.injuriesService.injuries(squadId, athleteId);
  }

  @Post('injuries')
  @RequiresStaffAccess('INJURY')
  recordInjury(
    @CurrentUser() user: AuthUser,
    @Param('squadId') squadId: string,
    @Param('athleteId') athleteId: string,
    @Body(new ZodValidationPipe(RecordInjurySchema)) body: RecordInjury,
  ): Promise<InjuryRecord> {
    return this.injuriesService.recordInjury(squadId, athleteId, user.id, body);
  }

  /** #21 AC2: active restrictions, for every staff role in the squad. */
  @Get('restrictions')
  @RequiresStaffAccess('RESTRICTIONS')
  restrictions(
    @Param('squadId') squadId: string,
    @Param('athleteId') athleteId: string,
  ): Promise<TrainingRestriction[]> {
    return this.injuriesService.activeRestrictions(squadId, athleteId);
  }

  @Post('restrictions')
  @RequiresStaffAccess('INJURY')
  addRestriction(
    @CurrentUser() user: AuthUser,
    @Param('squadId') squadId: string,
    @Param('athleteId') athleteId: string,
    @Body(new ZodValidationPipe(RecordRestrictionSchema)) body: RecordRestriction,
  ): Promise<TrainingRestriction> {
    return this.injuriesService.addRestriction(squadId, athleteId, user.id, body);
  }

  @Post('restrictions/:restrictionId/end')
  @HttpCode(200)
  @RequiresStaffAccess('INJURY')
  endRestriction(
    @Param('squadId') squadId: string,
    @Param('athleteId') athleteId: string,
    @Param('restrictionId') restrictionId: string,
  ): Promise<TrainingRestriction> {
    return this.injuriesService.endRestriction(squadId, athleteId, restrictionId);
  }
}
