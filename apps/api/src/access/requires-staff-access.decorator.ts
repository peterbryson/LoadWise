import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { DataCategory } from '@loadwise/shared';
import { STAFF_ACCESS_CATEGORY_KEY, StaffAccessGuard } from './staff-access.guard';

/**
 * #11: put on every route that returns one athlete's data to staff. The route path must contain
 * :squadId and :athleteId. Each route names the one data category it returns, and
 * StaffAccessGuard refuses the request unless the viewer may see that category for that athlete.
 *
 * Usage: `@Get('wellness') @RequiresStaffAccess('WELLNESS_SCORES')`. Controllers using it should
 * test that every route carries this metadata, so a route added later cannot skip the check.
 */
export const RequiresStaffAccess = (category: DataCategory): MethodDecorator =>
  applyDecorators(SetMetadata(STAFF_ACCESS_CATEGORY_KEY, category), UseGuards(StaffAccessGuard));
