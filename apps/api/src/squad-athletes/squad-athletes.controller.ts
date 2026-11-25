import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RecordInjurySchema } from '@loadwise/shared';
import type { RecordInjury } from '@loadwise/shared';
import { RequiresStaffAccess } from '../access/requires-staff-access.decorator';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InjuryRecord, SquadAthletesService, StaffWellnessEntry } from './squad-athletes.service';

/**
 * #11: staff views of one athlete in one squad. Every route declares its data category, and
 * StaffAccessGuard allows it only for staff of this squad whose role includes that category,
 * and only while the athlete shares data with this squad (#3).
 *
 * A coach's wellness view is status only (below usual or not), which needs the #9 baseline, so it
 * arrives with the flags and squad overview endpoints rather than as a cut-down version of this one.
 */
@Controller('squads/:squadId/athletes/:athleteId')
export class SquadAthletesController {
  constructor(private readonly athletes: SquadAthletesService) {}

  @Get('wellness')
  @RequiresStaffAccess('WELLNESS_SCORES')
  wellness(@Param('athleteId') athleteId: string): Promise<StaffWellnessEntry[]> {
    return this.athletes.recentWellness(athleteId);
  }

  @Get('injuries')
  @RequiresStaffAccess('INJURY')
  injuries(@Param('athleteId') athleteId: string): Promise<InjuryRecord[]> {
    return this.athletes.injuries(athleteId);
  }

  @Post('injuries')
  @RequiresStaffAccess('INJURY')
  recordInjury(
    @CurrentUser() user: AuthUser,
    @Param('athleteId') athleteId: string,
    @Body(new ZodValidationPipe(RecordInjurySchema)) body: RecordInjury,
  ): Promise<InjuryRecord> {
    return this.athletes.recordInjury(athleteId, user.id, body);
  }
}
