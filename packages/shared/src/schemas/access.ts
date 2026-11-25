import type { StaffRole } from './squad';

/**
 * #11: the kinds of athlete data a staff endpoint can return. Every staff endpoint declares exactly
 * one category, and the API checks it against the viewer's role in that squad.
 */
export const DATA_CATEGORIES = [
  'LOAD',
  'LOAD_DETAIL',
  'FLAGS',
  'WELLNESS_STATUS',
  'WELLNESS_SCORES',
  'INJURY',
] as const;

export type DataCategory = (typeof DATA_CATEGORIES)[number];

/** Every role a user can hold in a squad. Values match the Prisma Role enum. */
export type SquadRole = 'ATHLETE' | StaffRole;

/**
 * #11, need-to-know matrix (Peter's decision): what each role in a squad may see about a
 * consenting athlete in that same squad. Enforced by the API; the app shows the same matrix to
 * athletes before they turn sharing on, so what they are told always matches what is enforced.
 *
 * - LOAD: weekly load and ACWR. LOAD_DETAIL: monotony and strain.
 * - WELLNESS_STATUS: only whether wellness is below the athlete's usual, no individual scores.
 * - An athlete sees nothing about other athletes through a squad.
 */
export const STAFF_DATA_ACCESS: Readonly<Record<SquadRole, readonly DataCategory[]>> = Object.freeze({
  ATHLETE: Object.freeze([]),
  COACH: Object.freeze(['LOAD', 'FLAGS', 'WELLNESS_STATUS'] as const),
  SC_COACH: Object.freeze(['LOAD', 'LOAD_DETAIL', 'FLAGS', 'WELLNESS_STATUS', 'WELLNESS_SCORES'] as const),
  PHYSIO: Object.freeze(DATA_CATEGORIES),
});
