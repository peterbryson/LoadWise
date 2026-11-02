import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

/** Liveness check used by the staging deploy and uptime monitoring (NFR 3 availability). */
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
