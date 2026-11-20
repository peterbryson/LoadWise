import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/**
 * #1 AC4, DL-008: refuses a request with 403 unless the signed-in user has agreed to health-data
 * processing. Applied with @RequiresHealthConsent(); runs after the global AuthGuard, so the user
 * is always known here.
 */
@Injectable()
export class HealthConsentGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest<AuthenticatedRequest>().user?.id;
    if (!userId) throw new Error('HealthConsentGuard used on a route without AuthGuard');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { healthConsentAt: true },
    });
    if (!user?.healthConsentAt) {
      throw new ForbiddenException('Agree to health-data processing in first-time setup first');
    }
    return true;
  }
}
