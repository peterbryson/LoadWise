import { Injectable } from '@nestjs/common';
import { sessionLoad } from '@loadwise/analytics';
import type { SessionLog, SessionType } from '@loadwise/shared';
import { clientIdTaken, IdempotentResult } from '../common/idempotent-write';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';

/** A saved session, as returned by POST /sessions and GET /sessions. */
export interface SavedSession {
  id: string;
  type: SessionType;
  /** The calendar day of the session, YYYY-MM-DD. */
  date: string;
  durationMinutes: number;
  rpe: number;
  /** Session load in arbitrary units: RPE × minutes (Foster et al., 2001). */
  load: number;
  /** #6: the app's idempotency key, so it can tell a synced copy from one still in its queue. */
  clientId: string | null;
}

interface SessionRow {
  id: string;
  athleteId: string;
  type: SessionType;
  date: Date;
  durationMinutes: number;
  rpe: number;
  clientId: string | null;
}

function toSaved(row: SessionRow): SavedSession {
  return {
    id: row.id,
    type: row.type,
    date: row.date.toISOString().slice(0, 10),
    durationMinutes: row.durationMinutes,
    rpe: row.rpe,
    load: sessionLoad(row.rpe, row.durationMinutes),
    clientId: row.clientId,
  };
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR 1, #4 AC1: saves a session for the signed-in athlete. The athlete is always the caller, never
   * an id from the request body. Sessions are personal for now; linking one to a squad comes later.
   *
   * #6 AC3: if the app sends a clientId that is already stored for this athlete, the stored session
   * is returned and nothing new is written, so syncing the same entry twice stores it once.
   */
  async create(athleteId: string, input: SessionLog): Promise<IdempotentResult<SavedSession>> {
    if (input.clientId) {
      const existing = await this.findByClientId(athleteId, input.clientId);
      if (existing) return { saved: existing, replayed: true };
    }
    try {
      const row = await this.prisma.session.create({
        data: {
          athleteId,
          type: input.type,
          // A @db.Date column: Prisma stores the calendar day of this UTC-midnight date.
          date: new Date(input.date),
          durationMinutes: input.durationMinutes,
          rpe: input.rpe,
          clientId: input.clientId,
        },
      });
      return { saved: toSaved(row), replayed: false };
    } catch (error) {
      // Two copies of one entry arrived together and both passed the lookup above; the unique
      // index stored only the first, so this copy is a replay of it.
      if (input.clientId && isUniqueViolation(error)) {
        const existing = await this.findByClientId(athleteId, input.clientId);
        if (existing) return { saved: existing, replayed: true };
      }
      throw error;
    }
  }

  /**
   * #4 AC3 and AC4: the caller's own sessions, newest first. Two sessions on the same day are
   * ordered by when they were logged, so the order never changes between calls.
   */
  async recent(athleteId: string, limit: number): Promise<SavedSession[]> {
    const rows = await this.prisma.session.findMany({
      where: { athleteId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return rows.map(toSaved);
  }

  /** The caller's session with this key, or null. A key stored for another athlete is a 409. */
  private async findByClientId(athleteId: string, clientId: string): Promise<SavedSession | null> {
    const row = await this.prisma.session.findUnique({ where: { clientId } });
    if (!row) return null;
    if (row.athleteId !== athleteId) throw clientIdTaken();
    return toSaved(row);
  }
}
