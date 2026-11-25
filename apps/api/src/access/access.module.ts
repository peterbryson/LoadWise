import { Module } from '@nestjs/common';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessService } from './staff-access.service';

/**
 * #11: staff access checks. Import this module into any feature module whose routes return
 * athlete data to staff (#7, #9, #10), then use @RequiresStaffAccess on those routes.
 */
@Module({
  providers: [StaffAccessService, StaffAccessGuard],
  exports: [StaffAccessService, StaffAccessGuard],
})
export class AccessModule {}
