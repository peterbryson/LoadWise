import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Root module. Each feature (auth, squads, sessions, wellness, analytics, assistant)
 * gets its own module under src/<feature>/ and is imported here.
 */
@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
