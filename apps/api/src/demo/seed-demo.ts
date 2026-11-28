import { PrismaClient } from '@prisma/client';
import { DEMO_EMAIL_DOMAIN, DemoData } from './demo-squad';

/** Thrown, with nothing written, when the database holds anyone who is not a demo user. */
export class NotADemoDatabaseError extends Error {
  constructor(count: number) {
    super(
      `Refusing to seed: ${count} user(s) in this database are not demo users (@${DEMO_EMAIL_DOMAIN}). ` +
        'The demo seed replaces every user and squad, so it only runs on a demo-only database.',
    );
    this.name = 'NotADemoDatabaseError';
  }
}

/** True for an address the demo owns. Case-insensitive, as email domains are. */
export function isDemoEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

/** Placeholder Firebase UID for a demo person nobody has signed in as. It can never match a token. */
export function unclaimedUid(key: string): string {
  return `demo-unclaimed:${key}`;
}

const asDate = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);
/** A time of day for events that only have a date, so their order is stable and readable. */
const at = (isoDate: string, hour: number) => new Date(`${isoDate}T${String(hour).padStart(2, '0')}:00:00.000Z`);

/**
 * #56: replaces everything in a demo-only database with `data`, in one transaction.
 *
 * Demo logins keep working across re-seeds: anyone already signed up with a demo email (for
 * example coach@example.com, created by signing up in the app) keeps their Firebase UID, so the
 * same login sees the fresh data. Everyone else gets a placeholder UID that no token can match.
 */
export async function seedDemo(prisma: PrismaClient, data: DemoData): Promise<{ users: number; sessions: number; checkIns: number }> {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.user.findMany({ select: { email: true, firebaseUid: true } });
      const others = existing.filter((u) => !isDemoEmail(u.email));
      if (others.length > 0) throw new NotADemoDatabaseError(others.length);
      const uidByEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u.firebaseUid]));

      // Every user is a demo user (checked above), so this removes only demo data. Users first,
      // which cascades to everything they own; then squads, which cascades to team sessions.
      await tx.user.deleteMany({});
      await tx.squad.deleteMany({});

      const userId = (key: string) => `demo-user-${key}`;
      const squadId = (key: string) => `demo-squad-${key}`;
      const membershipId = (userKey: string, squadKey: string) => `demo-m-${userKey}-${squadKey}`;

      await tx.user.createMany({
        data: data.users.map((u) => ({
          id: userId(u.key),
          firebaseUid: uidByEmail.get(u.email) ?? unclaimedUid(u.key),
          email: u.email,
          displayName: u.displayName,
          healthConsentAt: u.healthConsentFrom ? at(u.healthConsentFrom, 8) : null,
        })),
      });
      await tx.healthConsentEvent.createMany({
        data: data.users
          .filter((u) => u.healthConsentFrom)
          .map((u) => ({ userId: userId(u.key), action: 'GRANTED' as const, noticeVersion: 'demo', createdAt: at(u.healthConsentFrom!, 8) })),
      });
      await tx.squad.createMany({
        data: data.squads.map((s) => ({ id: squadId(s.key), name: s.name, inviteCode: s.inviteCode })),
      });
      await tx.membership.createMany({
        data: data.memberships.map((m) => ({
          id: membershipId(m.userKey, m.squadKey),
          userId: userId(m.userKey),
          squadId: squadId(m.squadKey),
          role: m.role,
          consentGiven: m.consent.at(-1)?.action === 'GRANTED',
          joinedAt: at(m.joined, 9),
        })),
      });
      await tx.consentEvent.createMany({
        data: data.memberships.flatMap((m) =>
          m.consent.map((event) => ({
            membershipId: membershipId(m.userKey, m.squadKey),
            action: event.action,
            createdAt: at(event.date, 9),
          })),
        ),
      });
      await tx.teamSession.createMany({
        data: data.teamSessions.map((t) => ({
          id: `demo-team-${t.key}`,
          squadId: squadId(t.squadKey),
          createdById: userId(t.createdByKey),
          type: t.type,
          date: asDate(t.date),
          durationMinutes: t.durationMinutes,
        })),
      });
      await tx.session.createMany({
        data: data.sessions.map((s) => ({
          athleteId: userId(s.athleteKey),
          squadId: s.squadKey ? squadId(s.squadKey) : null,
          teamSessionId: s.teamSessionKey ? `demo-team-${s.teamSessionKey}` : null,
          type: s.type,
          date: asDate(s.date),
          durationMinutes: s.durationMinutes,
          rpe: s.rpe,
        })),
      });
      await tx.wellnessEntry.createMany({
        data: data.checkIns.map((c) => ({
          athleteId: userId(c.athleteKey),
          date: asDate(c.date),
          sleep: c.sleep,
          soreness: c.soreness,
          fatigue: c.fatigue,
          stress: c.stress,
        })),
      });
      await tx.injury.createMany({
        data: data.injuries.map((i) => ({
          athleteId: userId(i.athleteKey),
          squadId: squadId(i.squadKey),
          recordedById: userId(i.recordedByKey),
          bodyArea: i.bodyArea,
          onsetDate: asDate(i.onset),
          notes: i.notes,
        })),
      });
      await tx.restriction.createMany({
        data: data.restrictions.map((r) => ({
          athleteId: userId(r.athleteKey),
          squadId: squadId(r.squadKey),
          recordedById: userId(r.recordedByKey),
          description: r.description,
          reviewOn: asDate(r.reviewOn),
        })),
      });

      return { users: data.users.length, sessions: data.sessions.length, checkIns: data.checkIns.length };
    },
    // About 1,600 rows in a handful of statements; well within this on a laptop or staging.
    { timeout: 30_000 },
  );
}
