import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequiresHealthConsent } from '../consent/requires-health-consent.decorator';
import { CurrentFlags, FlagsService, WellnessTrendResponse } from './flags.service';

/**
 * FR 2, #9: the signed-in athlete's own flags and wellness trend. Health data, so consent is
 * required. Staff access to an athlete's flags comes with #10 and #11.
 */
@Controller('me')
@RequiresHealthConsent()
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Get('flags')
  current(@CurrentUser() user: AuthUser): Promise<CurrentFlags> {
    return this.flags.currentFlags(user.id);
  }

  @Get('wellness-trend')
  wellnessTrend(@CurrentUser() user: AuthUser): Promise<WellnessTrendResponse> {
    return this.flags.wellnessTrend(user.id);
  }
}
