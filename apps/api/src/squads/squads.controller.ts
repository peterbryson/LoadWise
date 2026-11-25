import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateSquadSchema, JoinSquadSchema } from '@loadwise/shared';
import type { CreateSquad, JoinSquad } from '@loadwise/shared';
import type { AuthUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CreatedSquad, JoinedSquad, MySquad, SquadMember, SquadsService } from './squads.service';

/** FR 4, #2: create, join and list squads. All routes need a signed-in user. */
@Controller('squads')
export class SquadsController {
  constructor(private readonly squads: SquadsService) {}

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
}
