import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SquadsModule } from './squads/squads.module';

/**
 * Root module. Each feature (auth, squads, sessions, wellness, analytics, assistant)
 * gets its own module under src/<feature>/ and is imported here.
 */
@Module({
  imports: [PrismaModule, AuthModule, HealthModule, SquadsModule],
})
export class AppModule {}
