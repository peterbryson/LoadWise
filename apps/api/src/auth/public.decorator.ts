import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without signing in. Every other route needs a valid token, so
 * forgetting to protect a new endpoint is impossible: the default is locked (NFR 2).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
