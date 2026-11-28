import { DATA_CATEGORIES, STAFF_DATA_ACCESS } from '@loadwise/shared';
import type { DataCategory, SquadRole } from '@loadwise/shared';
import { Role } from '@prisma/client';
import { allowedCategories, canView } from './staff-access.policy';

// The full need-to-know matrix, written out by hand (Peter's decision for #11) rather than derived
// from the code, so any change to the rule must change this table too.
const EXPECTED: Record<SquadRole, Record<DataCategory, boolean>> = {
  ATHLETE: {
    LOAD: false,
    LOAD_DETAIL: false,
    FLAGS: false,
    WELLNESS_STATUS: false,
    WELLNESS_SCORES: false,
    RESTRICTIONS: false,
    INJURY: false,
  },
  COACH: {
    LOAD: true,
    LOAD_DETAIL: false,
    FLAGS: true,
    WELLNESS_STATUS: true,
    WELLNESS_SCORES: false,
    RESTRICTIONS: true,
    INJURY: false,
  },
  SC_COACH: {
    LOAD: true,
    LOAD_DETAIL: true,
    FLAGS: true,
    WELLNESS_STATUS: true,
    WELLNESS_SCORES: true,
    RESTRICTIONS: true,
    INJURY: false,
  },
  PHYSIO: {
    LOAD: true,
    LOAD_DETAIL: true,
    FLAGS: true,
    WELLNESS_STATUS: true,
    WELLNESS_SCORES: true,
    RESTRICTIONS: true,
    INJURY: true,
  },
};

const cells = (Object.keys(EXPECTED) as SquadRole[]).flatMap((role) =>
  DATA_CATEGORIES.map((category) => [role, category, EXPECTED[role][category]] as const),
);

describe('NFR2: role-to-data access matrix (#11 AC1, AC2)', () => {
  it('covers every role in the database, and no others', () => {
    expect(Object.keys(STAFF_DATA_ACCESS).sort()).toEqual(Object.values(Role).sort());
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.values(Role).sort());
  });

  it.each(cells)('%s viewing %s → %s', (role, category, allowed) => {
    expect(canView(role, category)).toBe(allowed);
    expect(allowedCategories(role).has(category)).toBe(allowed);
  });

  it('never lets a coach or S&C coach see injury data (AC1)', () => {
    expect(canView('COACH', 'INJURY')).toBe(false);
    expect(canView('SC_COACH', 'INJURY')).toBe(false);
  });

  it('lets every staff role see training restrictions, but only a physio the injury behind them (#21)', () => {
    expect(canView('COACH', 'RESTRICTIONS')).toBe(true);
    expect(canView('SC_COACH', 'RESTRICTIONS')).toBe(true);
    expect(canView('PHYSIO', 'RESTRICTIONS')).toBe(true);
    expect(canView('ATHLETE', 'RESTRICTIONS')).toBe(false);
  });

  it('gives a coach wellness status but not individual scores', () => {
    expect(canView('COACH', 'WELLNESS_STATUS')).toBe(true);
    expect(canView('COACH', 'WELLNESS_SCORES')).toBe(false);
  });

  it('gives an athlete nothing about other athletes', () => {
    expect(allowedCategories('ATHLETE').size).toBe(0);
  });

  it('cannot be changed by a caller mutating the returned set', () => {
    (allowedCategories('COACH') as Set<DataCategory>).add('INJURY');

    expect(canView('COACH', 'INJURY')).toBe(false);
    expect(allowedCategories('COACH').has('INJURY')).toBe(false);
  });

  it('cannot be changed at run time, because the shared matrix is frozen', () => {
    expect(Object.isFrozen(STAFF_DATA_ACCESS)).toBe(true);
    for (const categories of Object.values(STAFF_DATA_ACCESS)) {
      expect(Object.isFrozen(categories)).toBe(true);
    }
  });
});
