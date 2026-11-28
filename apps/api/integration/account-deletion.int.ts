import { MeService } from '../src/me/me.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * NFR 2 #14 AC2: after an account is deleted, none of that person's data is left in a real
 * PostgreSQL database, and other people's records survive. The fake-database spec only shows that
 * the right row is deleted; this proves the foreign-key cascades that remove everything else.
 *
 * Opt-in, like the NFR 3.1 measurement: run `pnpm --filter @loadwise/api test:db` with the local
 * database up (`docker compose up -d db`) and migrations applied. Synthetic data only, under a unique
 * `del-` id prefix, and only those rows are cleaned up afterwards.
 */

process.loadEnvFile?.('.env');

const RUN = `del-${Date.now().toString(36)}`;
const id = (name: string) => `${RUN}-${name}`;
const DAY = new Date('2026-11-20T00:00:00.000Z');

const LEAVER = id('leaver'); // a player-coach: athlete in squad A, coach of squad B
const COACH_A = id('coach-a');
const TEAMMATE = id('teammate'); // athlete in squad B
const SQUAD_A = id('squad-a');
const SQUAD_B = id('squad-b');

const prisma = new PrismaService();
const me = new MeService(prisma);

function user(userId: string) {
  return { id: userId, firebaseUid: `${userId}-fb`, email: `${userId}@example.test`, displayName: userId };
}

async function seed() {
  await prisma.user.createMany({ data: [user(LEAVER), user(COACH_A), user(TEAMMATE)] });
  await prisma.squad.createMany({
    data: [
      { id: SQUAD_A, name: 'Squad A', inviteCode: `${RUN}-A` },
      { id: SQUAD_B, name: 'Squad B', inviteCode: `${RUN}-B` },
    ],
  });
  await prisma.membership.createMany({
    data: [
      { id: id('m-leaver-a'), userId: LEAVER, squadId: SQUAD_A, role: 'ATHLETE', consentGiven: true },
      { id: id('m-leaver-b'), userId: LEAVER, squadId: SQUAD_B, role: 'COACH' },
      { id: id('m-coach-a'), userId: COACH_A, squadId: SQUAD_A, role: 'COACH' },
      { id: id('m-teammate-b'), userId: TEAMMATE, squadId: SQUAD_B, role: 'ATHLETE', consentGiven: true },
    ],
  });
  await prisma.consentEvent.createMany({
    data: [
      { id: id('ce-leaver'), membershipId: id('m-leaver-a'), action: 'GRANTED' },
      { id: id('ce-teammate'), membershipId: id('m-teammate-b'), action: 'GRANTED' },
    ],
  });
  await prisma.healthConsentEvent.create({
    data: { id: id('hce-leaver'), userId: LEAVER, action: 'GRANTED', noticeVersion: 'test' },
  });
  // A team session the leaver created as coach of squad B, rated by both of them.
  await prisma.teamSession.create({
    data: { id: id('team'), squadId: SQUAD_B, createdById: LEAVER, type: 'TRAINING', date: DAY, durationMinutes: 60 },
  });
  await prisma.session.createMany({
    data: [
      { id: id('s-leaver'), athleteId: LEAVER, squadId: SQUAD_A, type: 'MATCH', date: DAY, durationMinutes: 80, rpe: 8 },
      { id: id('s-leaver-team'), athleteId: LEAVER, squadId: SQUAD_B, teamSessionId: id('team'), type: 'TRAINING', date: DAY, durationMinutes: 60, rpe: 5 },
      { id: id('s-teammate-team'), athleteId: TEAMMATE, squadId: SQUAD_B, teamSessionId: id('team'), type: 'TRAINING', date: DAY, durationMinutes: 60, rpe: 6 },
    ],
  });
  await prisma.wellnessEntry.createMany({
    data: [
      { id: id('w-leaver'), athleteId: LEAVER, date: DAY, sleep: 2, soreness: 4, fatigue: 4, stress: 3 },
      { id: id('w-teammate'), athleteId: TEAMMATE, date: DAY, sleep: 4, soreness: 2, fatigue: 2, stress: 2 },
    ],
  });
  await prisma.injury.createMany({
    data: [
      // The leaver's own injury, recorded by their coach in squad A.
      { id: id('i-leaver'), athleteId: LEAVER, squadId: SQUAD_A, recordedById: COACH_A, bodyArea: 'Ankle', onsetDate: DAY },
      // The teammate's injury, recorded by the leaver as coach of squad B.
      { id: id('i-teammate'), athleteId: TEAMMATE, squadId: SQUAD_B, recordedById: LEAVER, bodyArea: 'Knee', onsetDate: DAY },
    ],
  });
  await prisma.restriction.createMany({
    data: [
      { id: id('r-leaver'), athleteId: LEAVER, squadId: SQUAD_A, recordedById: COACH_A, description: 'No sprinting' },
      { id: id('r-teammate'), athleteId: TEAMMATE, squadId: SQUAD_B, recordedById: LEAVER, description: 'No contact' },
    ],
  });
  await prisma.flag.create({
    data: { id: id('f-leaver'), athleteId: LEAVER, rule: 'ACWR_HIGH', date: DAY, value: 1.7, threshold: 1.5, reason: 'test' },
  });
}

async function cleanUp() {
  // Deleting the users and squads cascades to every other row this run created.
  await prisma.user.deleteMany({ where: { id: { startsWith: RUN } } });
  await prisma.squad.deleteMany({ where: { id: { startsWith: RUN } } });
}

describe('NFR2 #14 AC2: deleting an account leaves none of that person’s data (real PostgreSQL)', () => {
  beforeAll(async () => {
    await seed();
    await me.deleteAccount(LEAVER);
  });

  afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
  });

  it('removes the user row, including their email address and name', async () => {
    expect(await prisma.user.findUnique({ where: { id: LEAVER } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { email: `${LEAVER}@example.test` } })).toBeNull();
  });

  it('removes every record that is theirs, in every table that refers to a user', async () => {
    const left = {
      memberships: await prisma.membership.count({ where: { userId: LEAVER } }),
      squadConsentEvents: await prisma.consentEvent.count({ where: { id: id('ce-leaver') } }),
      healthConsentEvents: await prisma.healthConsentEvent.count({ where: { userId: LEAVER } }),
      sessions: await prisma.session.count({ where: { athleteId: LEAVER } }),
      wellnessEntries: await prisma.wellnessEntry.count({ where: { athleteId: LEAVER } }),
      injuries: await prisma.injury.count({ where: { athleteId: LEAVER } }),
      restrictions: await prisma.restriction.count({ where: { athleteId: LEAVER } }),
      flags: await prisma.flag.count({ where: { athleteId: LEAVER } }),
      recordedByThem: {
        injuries: await prisma.injury.count({ where: { recordedById: LEAVER } }),
        restrictions: await prisma.restriction.count({ where: { recordedById: LEAVER } }),
        teamSessions: await prisma.teamSession.count({ where: { createdById: LEAVER } }),
      },
    };

    expect(left).toEqual({
      memberships: 0,
      squadConsentEvents: 0,
      healthConsentEvents: 0,
      sessions: 0,
      wellnessEntries: 0,
      injuries: 0,
      restrictions: 0,
      flags: 0,
      recordedByThem: { injuries: 0, restrictions: 0, teamSessions: 0 },
    });
  });

  it("keeps other people's records, unlinked from the deleted user where they recorded them", async () => {
    expect(await prisma.user.count({ where: { id: { in: [COACH_A, TEAMMATE] } } })).toBe(2);
    expect(await prisma.squad.count({ where: { id: { in: [SQUAD_A, SQUAD_B] } } })).toBe(2);
    expect(await prisma.membership.count({ where: { userId: { in: [COACH_A, TEAMMATE] } } })).toBe(2);
    expect(await prisma.consentEvent.count({ where: { id: id('ce-teammate') } })).toBe(1);
    expect(await prisma.wellnessEntry.count({ where: { athleteId: TEAMMATE } })).toBe(1);

    const teamSession = await prisma.teamSession.findUnique({ where: { id: id('team') } });
    expect(teamSession?.createdById).toBeNull();
    const rating = await prisma.session.findUnique({ where: { id: id('s-teammate-team') } });
    expect(rating?.teamSessionId).toBe(id('team'));

    const injury = await prisma.injury.findUnique({ where: { id: id('i-teammate') } });
    expect(injury).toMatchObject({ athleteId: TEAMMATE, recordedById: null, bodyArea: 'Knee' });
    const restriction = await prisma.restriction.findUnique({ where: { id: id('r-teammate') } });
    expect(restriction).toMatchObject({ athleteId: TEAMMATE, recordedById: null });
  });
});
