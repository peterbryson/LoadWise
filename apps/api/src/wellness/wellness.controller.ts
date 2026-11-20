import { Body, Controller, Post } from '@nestjs/common';
import { WellnessCheckSchema } from '@loadwise/shared';
import type { WellnessCheck } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequiresHealthConsent } from '../consent/requires-health-consent.decorator';
import { SavedWellness, WellnessService } from './wellness.service';

/** FR 1, #5: the athlete's daily wellness check. Health data, so consent is required (#1 AC4). */
@Controller('wellness')
@RequiresHealthConsent()
export class WellnessController {
  constructor(private readonly wellness: WellnessService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(WellnessCheckSchema)) body: WellnessCheck,
  ): Promise<SavedWellness> {
    return this.wellness.create(user.id, body);
  }
}
