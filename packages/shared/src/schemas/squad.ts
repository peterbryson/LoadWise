import { z } from 'zod';

/**
 * FR 4: roles a staff member can hold in a squad. Values match the Prisma Role enum.
 * ATHLETE is deliberately excluded: athletes join squads with an invite code, they never create them.
 */
export const StaffRoleSchema = z.enum(['COACH', 'PHYSIO', 'SC_COACH']);

/** #2: a staff member creates a squad and takes one of the staff roles in it. */
export const CreateSquadSchema = z.object({
  name: z.string().trim().min(2).max(60),
  role: StaffRoleSchema,
});

/**
 * Invite codes are 8 characters from an alphabet without look-alikes (0/O, 1/I/L), so they can be
 * read out at training. Matches INVITE_CODE_ALPHABET in the API.
 */
export const INVITE_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{8}$/;

/** #2: an athlete joins a squad with its invite code. Case and surrounding spaces are ignored. */
export const JoinSquadSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().regex(INVITE_CODE_PATTERN, 'Invalid invite code'),
});

export type StaffRole = z.infer<typeof StaffRoleSchema>;
export type CreateSquad = z.infer<typeof CreateSquadSchema>;
export type JoinSquad = z.infer<typeof JoinSquadSchema>;
