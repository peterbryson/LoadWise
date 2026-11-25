import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CreateSquadSchema, JoinSquadSchema, SetSquadConsentSchema } from '@loadwise/shared';
import type { CreateSquad, JoinSquad, SetSquadConsent } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SquadConsentService, SquadConsentState } from './squad-consent.service';
import { CreatedSquad, JoinedSquad, MySquad, SquadMember, SquadsService } from './squads.service';

/** FR 4, #2, #3: create, join and list squads, and choose what to share. All routes need sign-in. */
@Controller('squads')
export class SquadsController {
  constructor(
    private readonly squads: SquadsService,
    private readonly consent: SquadConsentService,
  ) {}

  @Get()
  listMine(@CurrentUser() user: AuthUser): Promise<MySquad[]> {
    return this.squads.listMine(user.id);
  }

  @Get(':squadId/members')
  listMembers(
    @CurrentUser() user: AuthUser,
    @Param('squadId') squadId: string,
  ): Promise<SquadMember[]> {
    return this.squads.listMembers(user.id, squadId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateSquadSchema)) body: CreateSquad,
  ): Promise<CreatedSquad> {
    return this.squads.create(user.id, body);
  }

  @Post('join')
  join(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(JoinSquadSchema)) body: JoinSquad,
  ): Promise<JoinedSquad> {
    return this.squads.join(user.id, body.inviteCode);
  }

  /** #3: the signed-in athlete starts or stops sharing their data with this squad. */
  @Put(':squadId/consent')
  setConsent(
    @CurrentUser() user: AuthUser,
    @Param('squadId') squadId: string,
    @Body(new ZodValidationPipe(SetSquadConsentSchema)) body: SetSquadConsent,
  ): Promise<SquadConsentState> {
    return this.consent.setConsent(user.id, squadId, body.share);
  }
}
