import { addDays } from '@loadwise/analytics';
import type { Role, SessionType } from '@prisma/client';

/**
 * #56: the synthetic squad for the interim video and live demos. Pure and deterministic: the same
 * `today` always gives the same data, with no clock or randomness, so demo-squad.spec.ts can run the
 * real analytics engine over it. Nothing here is real athlete data (CLAUDE.md); every person is
 * invented and every email address is on example.com, which is reserved for examples (RFC 2606).
 *
 * The squad is built so each feature has something to show:
 * - a load spike (ACWR flag) and a wellness dip (wellness flag), from the engine, not stored;
 * - an athlete in two squads, for combined load (#8);
 * - an athlete who has not checked in today, one who never shared, one who withdrew (#3, #10);
 * - a current injury and restriction recorded by the physio (#21);
 * - a new athlete whose baseline is still building (DL-007);
 * - team sessions the coach logged, which each athlete rated (#17).
 */

export const DEMO_EMAIL_DOMAIN = 'example.com';
/** Eight weeks: enough for ACWR (28 days) and a full wellness baseline window. */
export const DEMO_DAYS = 56;

export interface DemoUser {
  key: string;
  email: string;
  displayName: string;
  /** Set for athletes, who agreed to health-data processing at setup (DL-008). */
  healthConsentFrom: string | null;
}

export interface DemoMembership {
  userKey: string;
  squadKey: string;
  role: Role;
  /** Sharing history for athletes, oldest first. The last action is the current state. */
  consent: { action: 'GRANTED' | 'WITHDRAWN'; date: string }[];
  joined: string;
}

export interface DemoSession {
  athleteKey: string;
  squadKey: string | null;
  teamSessionKey: string | null;
  type: SessionType;
  date: string;
  durationMinutes: number;
  rpe: number;
}

export interface DemoTeamSession {
  key: string;
  squadKey: string;
  createdByKey: string;
  type: SessionType;
  date: string;
  durationMinutes: number;
}

export interface DemoCheckIn {
  athleteKey: string;
  date: string;
  sleep: number;
  soreness: number;
  fatigue: number;
  stress: number;
}

export interface DemoData {
  today: string;
  users: DemoUser[];
  squads: { key: string; name: string; inviteCode: string }[];
  memberships: DemoMembership[];
  teamSessions: DemoTeamSession[];
  sessions: DemoSession[];
  checkIns: DemoCheckIn[];
  injuries: { athleteKey: string; squadKey: string; recordedByKey: string; bodyArea: string; onset: string; notes: string }[];
  restrictions: { athleteKey: string; squadKey: string; recordedByKey: string; description: string; reviewOn: string }[];
}

/** Who is who, by scenario, so the spec and the README can refer to them. */
export const DEMO_ATHLETES = {
  /** Plays for both squads and shares with both; the athlete demo login. */
  multiSquad: 'athlete',
  loadSpike: 'athlete02',
  wellnessDip: 'athlete03',
  notCheckedIn: 'athlete04',
  neverShared: 'athlete05',
  withdrew: 'athlete06',
  injured: 'athlete07',
  /** Joined 10 days ago, so ACWR and the wellness baseline are still building. */
  newcomer: 'athlete08',
} as const;

const ROVERS = 'rovers';
const HARRIERS = 'harriers';

const FIRST_NAMES = [
  'Aoife', 'Ben', 'Ciara', 'Dan', 'Erin', 'Finn', 'Grace', 'Harry', 'Isla', 'Jack',
  'Kate', 'Liam', 'Molly', 'Niall', 'Orla', 'Paddy', 'Roisin', 'Sean', 'Tara', 'Owen',
];
const ATHLETE_COUNT = FIRST_NAMES.length;

function athleteKey(n: number): string {
  return n === 1 ? DEMO_ATHLETES.multiSquad : `athlete${String(n).padStart(2, '0')}`;
}

function user(key: string, displayName: string, healthConsentFrom: string | null): DemoUser {
  return { key, email: `${key}@${DEMO_EMAIL_DOMAIN}`, displayName, healthConsentFrom };
}

/** A small, repeatable wobble from 0 to `range - 1`, so athletes and days differ without randomness. */
function wobble(n: number, day: number, range: number): number {
  return (n * 7 + day * 3) % range;
}

/** Monday = 0 ... Sunday = 6, for a YYYY-MM-DD day. */
function weekday(isoDate: string): number {
  return (new Date(`${isoDate}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

export function demoSquad(today: string): DemoData {
  const start = addDays(today, 1 - DEMO_DAYS);
  const days = Array.from({ length: DEMO_DAYS }, (_, i) => addDays(start, i));

  const users: DemoUser[] = [
    user('coach', 'Coach Morgan', null),
    user('sc', 'Alex (S&C)', null),
    user('physio', 'Jordan (Physio)', null),
    user('harriers-coach', 'Coach Riley', null),
    ...FIRST_NAMES.map((name, i) => user(athleteKey(i + 1), `${name} (demo)`, start)),
  ];

  const squads = [
    { key: ROVERS, name: 'Demo Rovers FC', inviteCode: 'DEMO-ROVERS' },
    { key: HARRIERS, name: 'Demo Harriers AC', inviteCode: 'DEMO-HARRIERS' },
  ];

  const memberships: DemoMembership[] = [
    { userKey: 'coach', squadKey: ROVERS, role: 'COACH', consent: [], joined: start },
    { userKey: 'sc', squadKey: ROVERS, role: 'SC_COACH', consent: [], joined: start },
    { userKey: 'physio', squadKey: ROVERS, role: 'PHYSIO', consent: [], joined: start },
    { userKey: 'harriers-coach', squadKey: HARRIERS, role: 'COACH', consent: [], joined: start },
  ];
  for (let n = 1; n <= ATHLETE_COUNT; n++) {
    const key = athleteKey(n);
    const joined = key === DEMO_ATHLETES.newcomer ? addDays(today, -9) : start;
    let consent: DemoMembership['consent'] = [{ action: 'GRANTED', date: joined }];
    if (key === DEMO_ATHLETES.neverShared) consent = [];
    if (key === DEMO_ATHLETES.withdrew) consent = [...consent, { action: 'WITHDRAWN', date: addDays(today, -2) }];
    memberships.push({ userKey: key, squadKey: ROVERS, role: 'ATHLETE', consent, joined });
  }
  memberships.push({
    userKey: DEMO_ATHLETES.multiSquad,
    squadKey: HARRIERS,
    role: 'ATHLETE',
    consent: [{ action: 'GRANTED', date: start }],
    joined: start,
  });

  // The Rovers week: team training Tuesday and Thursday, a match on Saturday.
  const teamSessions: DemoTeamSession[] = [];
  for (const date of days) {
    const day = weekday(date);
    if (day === 1 || day === 3) {
      teamSessions.push({ key: `team-${date}`, squadKey: ROVERS, createdByKey: 'coach', type: 'TRAINING', date, durationMinutes: 75 });
    } else if (day === 5) {
      teamSessions.push({ key: `team-${date}`, squadKey: ROVERS, createdByKey: 'coach', type: 'MATCH', date, durationMinutes: 80 });
    }
  }
  const teamSessionOn = new Map(teamSessions.map((team) => [team.date, team]));

  const sessions: DemoSession[] = [];
  const checkIns: DemoCheckIn[] = [];
  const spikeFrom = addDays(today, -6);

  for (let n = 1; n <= ATHLETE_COUNT; n++) {
    const key = athleteKey(n);
    const joined = memberships.find((m) => m.userKey === key && m.squadKey === ROVERS)?.joined ?? start;

    days.forEach((date, i) => {
      if (date < joined) return;
      const day = weekday(date);
      const team = teamSessionOn.get(date);
      // The injured athlete has sat out team sessions since the injury, 12 days ago.
      const injuredOut = key === DEMO_ATHLETES.injured && date >= addDays(today, -11);

      if (team && !injuredOut) {
        sessions.push({
          athleteKey: key,
          squadKey: ROVERS,
          teamSessionKey: team.key,
          type: team.type,
          date,
          durationMinutes: team.durationMinutes,
          rpe: (team.type === 'MATCH' ? 7 : 5) + wobble(n, i, 2),
        });
      }
      if (day === 0) {
        sessions.push({ athleteKey: key, squadKey: null, teamSessionKey: null, type: 'GYM', date, durationMinutes: 45, rpe: 5 + wobble(n, i, 2) });
      }
      if (injuredOut && (day === 1 || day === 3)) {
        sessions.push({ athleteKey: key, squadKey: null, teamSessionKey: null, type: 'OTHER', date, durationMinutes: 30, rpe: 3 });
      }
      // The multi-squad athlete also runs with the Harriers on Wednesdays.
      if (key === DEMO_ATHLETES.multiSquad && day === 2) {
        sessions.push({ athleteKey: key, squadKey: HARRIERS, teamSessionKey: null, type: 'TRAINING', date, durationMinutes: 50, rpe: 6 });
      }
      // The load spike: a hard extra session every day for the last week.
      if (key === DEMO_ATHLETES.loadSpike && date >= spikeFrom) {
        sessions.push({ athleteKey: key, squadKey: null, teamSessionKey: null, type: 'GYM', date, durationMinutes: 90, rpe: 8 });
      }

      const missed =
        (key === DEMO_ATHLETES.notCheckedIn && date === today) ||
        // An occasional missed morning, as in real use; never today, so today's flags are clear.
        (date !== today && (n + i) % 11 === 0);
      if (!missed) checkIns.push(checkIn(key, n, i, date, date === today && key === DEMO_ATHLETES.wellnessDip));
    });
  }

  // The not-checked-in athlete's last session was three days ago, so "Not logged" is visible too.
  const notCheckedInFrom = addDays(today, -2);
  const keep = sessions.filter((s) => !(s.athleteKey === DEMO_ATHLETES.notCheckedIn && s.date >= notCheckedInFrom));

  return {
    today,
    users,
    squads,
    memberships,
    teamSessions,
    sessions: keep,
    checkIns,
    injuries: [
      {
        athleteKey: DEMO_ATHLETES.injured,
        squadKey: ROVERS,
        recordedByKey: 'physio',
        bodyArea: 'Hamstring',
        onset: addDays(today, -11),
        notes: 'Synthetic demo record.',
      },
    ],
    restrictions: [
      {
        athleteKey: DEMO_ATHLETES.injured,
        squadKey: ROVERS,
        recordedByKey: 'physio',
        description: 'No max-speed running',
        reviewOn: addDays(today, 5),
      },
    ],
  };
}

/** Scores between 3 and 5 most days (5 is best), or all 1s for the wellness dip. */
function checkIn(athleteKey: string, n: number, i: number, date: string, dip: boolean): DemoCheckIn {
  const score = (offset: number) => (dip ? 1 : 3 + wobble(n + offset, i, 3));
  return { athleteKey, date, sleep: score(0), soreness: score(1), fatigue: score(2), stress: score(3) };
}
