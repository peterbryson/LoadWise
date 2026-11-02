import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';
import type { AuthUser } from './auth.service';

/** Injects the signed-in user into a controller method: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    // Only reachable on a public route, which should never use this decorator.
    if (!user) throw new Error('CurrentUser used on a route without AuthGuard');
    return user;
  },
);
