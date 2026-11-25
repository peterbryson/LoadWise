import type { StaffRole } from '@loadwise/shared';

/** How each squad role is named on screen. Values match the API and Prisma Role enum. */
export const roleLabels: Record<'ATHLETE' | StaffRole, string> = {
  ATHLETE: 'Athlete',
  COACH: 'Coach',
  SC_COACH: 'S&C coach',
  PHYSIO: 'Physio',
};
