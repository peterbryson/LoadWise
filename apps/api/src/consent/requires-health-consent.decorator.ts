import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { HealthConsentGuard } from './health-consent.guard';

export const REQUIRES_HEALTH_CONSENT_KEY = 'requiresHealthConsent';

/**
 * Put on every controller that writes health data (sessions #4, wellness #5). Apply it to the
 * controller class, not single methods, so a route added later is covered too; each such
 * controller's tests should assert this metadata is present.
 */
export const RequiresHealthConsent = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(REQUIRES_HEALTH_CONSENT_KEY, true), UseGuards(HealthConsentGuard));
