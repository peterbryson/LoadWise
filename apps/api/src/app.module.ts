import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SquadsModule } from './squads/squads.module';

/**
 * Root module. Each feature (auth, squads, sessions, wellness, analytics, assistant)
 * gets its own module under src/<feature>/ and is imported here.
 */
@Module({
  imports: [PrismaModule, AuthModule, HealthModule, SquadsModule],
  // APP_FILTER applies the filter to every route, so all errors share one shape (#27).
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
