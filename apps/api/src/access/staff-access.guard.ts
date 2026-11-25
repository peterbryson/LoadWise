import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DataCategory } from '@loadwise/shared';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { StaffAccessService } from './staff-access.service';

/** Metadata key set by @RequiresStaffAccess. Defined here so the decorator imports the guard, not the reverse. */
export const STAFF_ACCESS_CATEGORY_KEY = 'staffAccessCategory';

interface StaffDataRequest extends AuthenticatedRequest {
  params: Record<string, string | undefined>;
}

/**
 * #11: runs StaffAccessService.assertCanView for routes marked with @RequiresStaffAccess. It runs
 * after the global AuthGuard and before any validation pipe, so a viewer without access gets 403
 * even for a malformed body and never learns which fields the route expects.
 */
@Injectable()
export class StaffAccessGuard implements CanActivate {
  constructor(
    private readonly access: StaffAccessService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const category = this.reflector.get<DataCategory | undefined>(
      STAFF_ACCESS_CATEGORY_KEY,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<StaffDataRequest>();
    const viewerId = request.user?.id;
    const { squadId, athleteId } = request.params;
    // Programming errors, not user errors: the route is missing the decorator, auth or a path param.
    if (!category || !viewerId || !squadId || !athleteId) {
      throw new Error('StaffAccessGuard needs @RequiresStaffAccess, AuthGuard, :squadId and :athleteId');
    }

    await this.access.assertCanView(viewerId, squadId, athleteId, category);
    return true;
  }
}
