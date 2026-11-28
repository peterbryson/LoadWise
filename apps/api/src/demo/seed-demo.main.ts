import { PrismaClient } from '@prisma/client';
import { londonDate } from '../metrics/clock';
import { demoSquad } from './demo-squad';
import { NotADemoDatabaseError, seedDemo } from './seed-demo';

/**
 * `pnpm --filter @loadwise/api seed:demo`: fills a demo-only database with the synthetic squad for
 * today (Europe/London). Refuses, writing nothing, if anyone in the database is not a demo user.
 * The README ("Demo data") explains how to make the demo logins first.
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const today = londonDate(new Date());
    const result = await seedDemo(prisma, demoSquad(today));
    console.log(`Demo data for ${today}: ${result.users} users, ${result.sessions} sessions, ${result.checkIns} check-ins.`);
  } catch (error) {
    if (error instanceof NotADemoDatabaseError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
