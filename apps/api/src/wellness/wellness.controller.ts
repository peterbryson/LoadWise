import { Body, Controller, Get, HttpStatus, Post, Res } from '@nestjs/common';
import { WellnessCheckSchema } from '@loadwise/shared';
import type { WellnessCheck } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { StatusSetter } from '../common/idempotent-write';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequiresHealthConsent } from '../consent/requires-health-consent.decorator';
import { SavedWellness, TodayWellness, WellnessService } from './wellness.service';

/** FR 1, #5: the athlete's daily wellness check. Health data, so consent is required (#1 AC4). */
@Controller('wellness')
@RequiresHealthConsent()
export class WellnessController {
  constructor(private readonly wellness: WellnessService) {}

  /** #45: today's check-in for the signed-in athlete, or `entry: null` if there is none yet. */
  @Get('today')
  today(@CurrentUser() user: AuthUser): Promise<TodayWellness> {
    return this.wellness.today(user.id);
  }

  /** 201 for a new check-in; 200 when the clientId was already stored, as nothing new was created (#6). */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(WellnessCheckSchema)) body: WellnessCheck,
    @Res({ passthrough: true }) response: StatusSetter,
  ): Promise<SavedWellness> {
    const { saved, replayed } = await this.wellness.create(user.id, body);
    if (replayed) response.status(HttpStatus.OK);
    return saved;
  }
}
