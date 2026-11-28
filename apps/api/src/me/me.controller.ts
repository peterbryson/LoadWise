import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { GiveHealthConsentSchema } from '@loadwise/shared';
import type { GiveHealthConsent } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Me, MeService } from './me.service';

/** The signed-in user's own account. Only ever returns the caller's own data. */
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Lets the app decide whether to show first-time setup (issue log I-7). */
  @Get()
  get(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.me.get(user.id);
  }

  /** #1 AC4: the athlete ticks the consent box at first-time setup. Repeating it changes nothing. */
  @Post('health-consent')
  @HttpCode(200)
  giveHealthConsent(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(GiveHealthConsentSchema)) body: GiveHealthConsent,
  ): Promise<Me> {
    return this.me.giveHealthConsent(user.id, body.noticeVersion);
  }

  /**
   * #14: deletes the caller's account and all their data. Only ever the caller's own: there is no
   * id in the path, so nobody can delete someone else's account. No health-data consent is needed,
   * because withdrawing from LoadWise entirely must always be possible.
   */
  @Delete()
  @HttpCode(204)
  deleteAccount(@CurrentUser() user: AuthUser): Promise<void> {
    return this.me.deleteAccount(user.id);
  }
}
