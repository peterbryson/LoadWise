import {
  addDays,
  DEFAULT_FLAG_THRESHOLDS,
  evaluateFlags,
  loadSummary,
  loggingStatus,
  wellnessBaseline,
} from '@loadwise/analytics';
import { DEMO_ATHLETES, DEMO_EMAIL_DOMAIN, DemoData, demoSquad } from './demo-squad';

// The demo must show the right flags whatever day it is seeded, so every weekday is checked.
const MONDAY = '2027-01-11';
const WEEK = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i));

/** Runs the real engine over one athlete's demo data, as GET /me/flags does. */
function flagsFor(data: DemoData, athleteKey: string) {
  const sessions = data.sessions.filter((s) => s.athleteKey === athleteKey);
  const checkIns = data.checkIns.filter((c) => c.athleteKey === athleteKey);
  const acwr = loadSummary(sessions, data.today).acwr.value;
  const wellnessToday = checkIns.find((c) => c.date === data.today) ?? null;
  const rules = evaluateFlags(
    { acwr, wellnessToday, baseline: wellnessBaseline(checkIns, data.today) },
    DEFAULT_FLAG_THRESHOLDS,
  ).map((flag) => flag.rule);
  return { acwr, rules: [...new Set(rules)] };
}

describe('#56 synthetic demo squad', () => {
  describe.each(WEEK)('seeded on %s', (today) => {
    const data = demoSquad(today);

    it('raises an ACWR flag (from the engine) for the load-spike athlete only', () => {
      const flagged = data.users
        .map((u) => u.key)
        .filter((key) => flagsFor(data, key).rules.includes('ACWR_HIGH'));
      expect(flagged).toEqual([DEMO_ATHLETES.loadSpike]);
    });

    it('raises a wellness flag for the wellness-dip athlete only', () => {
      const flagged = data.users
        .map((u) => u.key)
        .filter((key) => flagsFor(data, key).rules.includes('WELLNESS_LOW'));
      expect(flagged).toEqual([DEMO_ATHLETES.wellnessDip]);
    });

    it('has one athlete who has not checked in today and whose last session was 3 days ago', () => {
      const notIn = data.users
        .filter((u) => u.healthConsentFrom !== null)
        .filter((u) => {
          const status = loggingStatus(
            data.sessions.filter((s) => s.athleteKey === u.key),
            data.checkIns.filter((c) => c.athleteKey === u.key),
            today,
          );
          return !status.checkedInToday;
        })
        .map((u) => u.key);
      expect(notIn).toEqual([DEMO_ATHLETES.notCheckedIn]);
      const last = loggingStatus(data.sessions.filter((s) => s.athleteKey === DEMO_ATHLETES.notCheckedIn), [], today);
      expect(last.lastSessionDate === null || last.lastSessionDate <= addDays(today, -3)).toBe(true);
    });

    it("keeps the newcomer's ACWR unavailable while their history builds", () => {
      expect(flagsFor(data, DEMO_ATHLETES.newcomer).acwr).toBeNull();
    });
  });

  const data = demoSquad(MONDAY);

  it('is synthetic: every email is on the reserved example domain and every name is marked', () => {
    expect(data.users.every((u) => u.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`))).toBe(true);
    expect(new Set(data.users.map((u) => u.email)).size).toBe(data.users.length);
  });

  it('has a coach, S&C coach and physio, and 20 athletes, in the main squad', () => {
    const rovers = data.memberships.filter((m) => m.squadKey === 'rovers');
    expect(rovers.filter((m) => m.role === 'ATHLETE')).toHaveLength(20);
    expect(rovers.filter((m) => m.role !== 'ATHLETE').map((m) => m.role).sort()).toEqual(['COACH', 'PHYSIO', 'SC_COACH']);
  });

  it('has one athlete sharing with two squads, one who never shared and one who withdrew', () => {
    const current = (key: string, squad: string) =>
      data.memberships.find((m) => m.userKey === key && m.squadKey === squad)?.consent.at(-1)?.action ?? null;
    expect(current(DEMO_ATHLETES.multiSquad, 'rovers')).toBe('GRANTED');
    expect(current(DEMO_ATHLETES.multiSquad, 'harriers')).toBe('GRANTED');
    expect(current(DEMO_ATHLETES.neverShared, 'rovers')).toBeNull();
    expect(current(DEMO_ATHLETES.withdrew, 'rovers')).toBe('WITHDRAWN');
  });

  it('only ever has valid scores, RPEs and durations, and nothing after today', () => {
    for (const c of data.checkIns) {
      for (const score of [c.sleep, c.soreness, c.fatigue, c.stress]) expect(score >= 1 && score <= 5).toBe(true);
      expect(c.date <= MONDAY).toBe(true);
    }
    for (const s of data.sessions) {
      expect(s.rpe >= 1 && s.rpe <= 10).toBe(true);
      expect(s.durationMinutes > 0).toBe(true);
      expect(s.date <= MONDAY).toBe(true);
    }
  });

  it('rates each team session at most once per athlete (the database unique index)', () => {
    const pairs = data.sessions.filter((s) => s.teamSessionKey).map((s) => `${s.athleteKey}|${s.teamSessionKey}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('has at most one check-in per athlete per day (the database unique index)', () => {
    const pairs = data.checkIns.map((c) => `${c.athleteKey}|${c.date}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('is the same every time for the same day', () => {
    expect(demoSquad(MONDAY)).toEqual(data);
  });
});
