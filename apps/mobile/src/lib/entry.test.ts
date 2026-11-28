import { entryModeFor, landingFor, tabRedirect, tabsFor } from '@/lib/entry';

describe('FR4 #48: how a user enters the app', () => {
  describe('entry mode from consent and memberships', () => {
    it.each([
      [false, false, 'setup'],
      [true, false, 'athlete'],
      [false, true, 'staff'],
      [true, true, 'both'],
    ] as const)('consent %s, staff squad %s: %s', (healthConsentGiven, hasStaffSquad, mode) => {
      expect(entryModeFor({ healthConsentGiven, hasStaffSquad })).toBe(mode);
    });
  });

  describe('AC3, AC4: tabs and landing', () => {
    it('gives an athlete Today, Trends and Profile, landing on Today', () => {
      expect(tabsFor('athlete')).toEqual(['index', 'trends', 'profile']);
      expect(landingFor('athlete')).toBe('/');
    });

    it('gives a staff-only user the Squad tab and Profile only, landing on Squad', () => {
      expect(tabsFor('staff')).toEqual(['squad', 'profile']);
      expect(landingFor('staff')).toBe('/squad');
    });

    it('gives a user who is both Today and the Squad tab, landing on Today', () => {
      expect(tabsFor('both')).toEqual(['index', 'trends', 'squad', 'profile']);
      expect(landingFor('both')).toBe('/');
    });
  });

  describe('NFR2 AC2: tab paths a mode may not open', () => {
    it.each(['/', '/trends'])('sends a staff-only user from %s to the Squad tab', (path) => {
      expect(tabRedirect('staff', path)).toBe('/squad');
    });

    it('sends an athlete without a staff squad from the Squad tab to Today', () => {
      expect(tabRedirect('athlete', '/squad')).toBe('/');
    });

    it.each([
      ['staff', '/squad'],
      ['staff', '/profile'],
      ['athlete', '/'],
      ['athlete', '/trends'],
      ['both', '/'],
      ['both', '/squad'],
    ] as const)('lets %s stay on %s', (mode, path) => {
      expect(tabRedirect(mode, path)).toBeNull();
    });

    it('leaves paths that are not tabs alone', () => {
      expect(tabRedirect('staff', '/squad-overview')).toBeNull();
    });
  });
});
