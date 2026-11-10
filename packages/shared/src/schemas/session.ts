import { z } from 'zod';

/** FR 1: a logged training session or match. One schema validates on the client and the API. */
// Upper case to match the Prisma SessionType enum (and StaffRoleSchema), so values pass between
// client, API and database with no mapping. A test in apps/api checks the two stay in step.
export const SessionTypeSchema = z.enum(['TRAINING', 'MATCH', 'GYM', 'OTHER']);

export const SessionLogSchema = z.object({
  type: SessionTypeSchema,
  /** Calendar date of the session, YYYY-MM-DD. */
  date: z.iso.date(),
  durationMinutes: z.number().int().min(1).max(600),
  /** Session-RPE on the CR-10 scale (Foster et al., 2001). */
  rpe: z.number().int().min(1).max(10),
});

export type SessionType = z.infer<typeof SessionTypeSchema>;
export type SessionLog = z.infer<typeof SessionLogSchema>;
