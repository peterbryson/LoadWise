import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { DEMO_ATHLETES, demoSquad } from '../src/demo/demo-squad';
import { NotADemoDatabaseError, seedDemo, unclaimedUid } from '../src/demo/seed-demo';

/**
 * #56: the demo seed against a real PostgreSQL. The seed replaces every user, so this never uses
 * the development database: it creates (once) and migrates a separate `loadwise_seed_test`
 * database on the same server, and works only there.
 */

process.loadEnvFile?.('.env');

const TODAY = '2027-01-11';
const SCRATCH = 'loadwise_seed_test';

function scratchUrl(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.pathname = `/${SCRATCH}`;
  return url.toString();
}

let prisma: PrismaClient;

beforeAll(async () => {
  const admin = new PrismaClient();
  const exists = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${SCRATCH}`;
  if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE ${SCRATCH}`);
  await admin.$disconnect();

  execSync('pnpm exec prisma migrate deploy', { env: { ...process.env, DATABASE_URL: scratchUrl() }, stdio: 'ignore' });
  prisma = new PrismaClient({ datasources: { db: { url: scratchUrl() } } });
  await prisma.user.deleteMany({});
  await prisma.squad.deleteMany({});
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('#56 demo seed (real PostgreSQL, scratch database)', () => {
  it('refuses, writing nothing, when the database holds a non-demo user', async () => {
    await prisma.user.create({ data: { firebaseUid: 'real-fb', email: 'someone@gmail.test', displayName: 'Someone' } });

    await expect(seedDemo(prisma, demoSquad(TODAY))).rejects.toBeInstanceOf(NotADemoDatabaseError);

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.squad.count()).toBe(0);
    await prisma.user.deleteMany({});
  });

  it('writes the whole squad, every row passing the real constraints', async () => {
    const data = demoSquad(TODAY);
    const result = await seedDemo(prisma, data);

    expect(result.users).toBe(24);
    expect(await prisma.user.count()).toBe(24);
    expect(await prisma.membership.count()).toBe(data.memberships.length);
    expect(await prisma.session.count()).toBe(data.sessions.length);
    expect(await prisma.wellnessEntry.count()).toBe(data.checkIns.length);
    expect(await prisma.teamSession.count()).toBe(data.teamSessions.length);
    expect(await prisma.injury.count()).toBe(1);
    expect(await prisma.restriction.count()).toBe(1);
  });

  it('stores each consent state with its history', async () => {
    const membership = (key: string) =>
      prisma.membership.findFirstOrThrow({
        where: { user: { email: `${key}@example.com` }, squad: { inviteCode: 'DEMO-ROVERS' } },
        include: { consentEvents: { orderBy: { createdAt: 'asc' } } },
      });

    const withdrew = await membership(DEMO_ATHLETES.withdrew);
    expect(withdrew.consentGiven).toBe(false);
    expect(withdrew.consentEvents.map((e) => e.action)).toEqual(['GRANTED', 'WITHDRAWN']);
    const never = await membership(DEMO_ATHLETES.neverShared);
    expect(never.consentGiven).toBe(false);
    expect(never.consentEvents).toHaveLength(0);
    expect((await membership(DEMO_ATHLETES.loadSpike)).consentGiven).toBe(true);
  });

  it('keeps the Firebase UID of a demo login when re-seeded, so it can still sign in', async () => {
    await prisma.user.update({ where: { email: 'coach@example.com' }, data: { firebaseUid: 'fb-coach-login' } });

    await seedDemo(prisma, demoSquad(TODAY));

    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'coach@example.com' } })).firebaseUid).toBe('fb-coach-login');
    expect((await prisma.user.findUniqueOrThrow({ where: { email: 'physio@example.com' } })).firebaseUid).toBe(unclaimedUid('physio'));
    expect(await prisma.user.count()).toBe(24);
  });
});
