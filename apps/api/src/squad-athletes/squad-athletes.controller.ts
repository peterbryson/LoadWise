import { Controller, Get, Param } from '@nestjs/common';
import type { LoadDetail, LoadTotals } from '@loadwise/shared';
import { RequiresStaffAccess } from '../access/requires-staff-access.decorator';
import { SquadAthletesService, StaffWellnessEntry } from './squad-athletes.service';

/**
 * #11: staff views of one athlete in one squad. Every route declares its data category, and
 * StaffAccessGuard allows it only for staff of this squad whose role includes that category,
 * and only while the athlete shares data with this squad (#3).
 *
 * A coach's wellness view is status only (below usual or not), which needs the #9 baseline, so it
 * arrives with the flags and squad overview endpoints rather than as a cut-down version of this one.
 * Injuries and restrictions are in InjuriesController (#21).
 */
@Controller('squads/:squadId/athletes/:athleteId')
export class SquadAthletesController {
  constructor(private readonly athletes: SquadAthletesService) {}

  /** #8 AC2: combined weekly load and ACWR from all the athlete's squads. Every staff role. */
  @Get('load')
  @RequiresStaffAccess('LOAD')
  load(@Param('athleteId') athleteId: string): Promise<LoadTotals> {
    return this.athletes.combinedLoad(athleteId);
  }

  /**
   * #8 with #11: monotony and strain. A separate route rather than extra fields on /load, so each
   * route has one category and one shape, and a coach can never receive them through a role check
   * that branches inside a handler.
   */
  @Get('load-detail')
  @RequiresStaffAccess('LOAD_DETAIL')
  loadDetail(@Param('athleteId') athleteId: string): Promise<LoadDetail> {
    return this.athletes.combinedLoadDetail(athleteId);
  }

  @Get('wellness')
  @RequiresStaffAccess('WELLNESS_SCORES')
  wellness(@Param('athleteId') athleteId: string): Promise<StaffWellnessEntry[]> {
    return this.athletes.recentWellness(athleteId);
  }
}
