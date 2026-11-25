import { Controller, Get } from '@nestjs/common';
import type { MyLoad } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequiresHealthConsent } from '../consent/requires-health-consent.decorator';
import { MetricsService } from './metrics.service';

/** FR 2, #7: the signed-in athlete's own load metrics. Health data, so consent is required. */
@Controller('me/load')
@RequiresHealthConsent()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  myLoad(@CurrentUser() user: AuthUser): Promise<MyLoad> {
    return this.metrics.myLoad(user.id);
  }
}
