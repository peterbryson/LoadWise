import { STAFF_DATA_ACCESS } from '@loadwise/shared';
import type { DataCategory, StaffRole } from '@loadwise/shared';
import { roleLabels } from './roles';

/** Plain-language names for each data category, as athletes read them before sharing (#3, #11). */
export const dataCategoryLabels: Record<DataCategory, string> = {
  LOAD: 'weekly load and ACWR',
  LOAD_DETAIL: 'monotony and strain',
  FLAGS: 'flags and their reasons',
  WELLNESS_STATUS: 'whether your wellness is below your usual',
  WELLNESS_SCORES: 'your wellness scores',
  RESTRICTIONS: 'training restrictions set by the physio',
  INJURY: 'injury records',
};

const staffRoles: StaffRole[] = ['COACH', 'SC_COACH', 'PHYSIO'];

/**
 * One line per staff role saying what it will see, built from the same matrix the API enforces,
 * so what an athlete is told before sharing cannot drift from what staff can actually see.
 */
export function whatEachRoleSees(): { role: StaffRole; text: string }[] {
  return staffRoles.map((role) => ({
    role,
    text: `${roleLabels[role]}: ${STAFF_DATA_ACCESS[role].map((c) => dataCategoryLabels[c]).join(', ')}`,
  }));
}
