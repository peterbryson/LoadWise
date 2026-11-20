import { Injectable } from '@nestjs/common';
import { sessionLoad } from '@loadwise/analytics';
import type { SessionLog, SessionType } from '@loadwise/shared';
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
}

interface SessionRow {
  id: string;
  type: SessionType;
  date: Date;
  durationMinutes: number;
  rpe: number;
}

function toSaved(row: SessionRow): SavedSession {
  return {
    id: row.id,
    type: row.type,
    date: row.date.toISOString().slice(0, 10),
    durationMinutes: row.durationMinutes,
    rpe: row.rpe,
    load: sessionLoad(row.rpe, row.durationMinutes),
  };
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR 1, #4 AC1: saves a session for the signed-in athlete. The athlete is always the caller, never
   * an id from the request body. Sessions are personal for now; linking one to a squad comes later.
   */
  async create(athleteId: string, input: SessionLog): Promise<SavedSession> {
    const row = await this.prisma.session.create({
      data: {
        athleteId,
        type: input.type,
        // A @db.Date column: Prisma stores the calendar day of this UTC-midnight date.
        date: new Date(input.date),
        durationMinutes: input.durationMinutes,
        rpe: input.rpe,
      },
    });
    return toSaved(row);
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
}
