/** The signed-in tabs, named after their route files in `app/(tabs)`. */
export type TabRoute = 'index' | 'trends' | 'squad' | 'profile';

/**
 * How someone uses LoadWise (#48), worked out from two facts the API already holds rather than a
 * stored preference:
 * - logging their own training needs health-data consent (DL-008), so consent means "athlete";
 * - supporting a squad means holding at least one staff membership.
 *
 * - setup: neither yet, so first-time setup asks which it is
 * - athlete: logs their own training only
 * - staff: supports a squad without logging their own training (no health-data consent)
 * - both: a player-coach, for example
 */
export type EntryMode = 'setup' | 'athlete' | 'staff' | 'both';

export interface AccountFacts {
  healthConsentGiven: boolean;
  hasStaffSquad: boolean;
}

export function entryModeFor({ healthConsentGiven, hasStaffSquad }: AccountFacts): EntryMode {
  if (healthConsentGiven) return hasStaffSquad ? 'both' : 'athlete';
  return hasStaffSquad ? 'staff' : 'setup';
}

/** The tabs each mode sees, in tab-bar order. Today and Trends show health data, so need consent. */
export function tabsFor(mode: Exclude<EntryMode, 'setup'>): TabRoute[] {
  switch (mode) {
    case 'athlete':
      return ['index', 'trends', 'profile'];
    case 'staff':
      return ['squad', 'profile'];
    case 'both':
      return ['index', 'trends', 'squad', 'profile'];
  }
}

/** #48 AC4: staff-only users land on the Squad tab; anyone who logs their own training on Today. */
export function landingFor(mode: Exclude<EntryMode, 'setup'>): '/' | '/squad' {
  return mode === 'staff' ? '/squad' : '/';
}

const tabPaths: Record<TabRoute, string> = {
  index: '/',
  trends: '/trends',
  squad: '/squad',
  profile: '/profile',
};

/**
 * Where a signed-in user on a tab's path must be sent instead, or null if they may stay. Used for
 * the landing and for deep links, so a staff-only user never opens Today or Trends.
 */
export function tabRedirect(mode: Exclude<EntryMode, 'setup'>, pathname: string): '/' | '/squad' | null {
  const tab = (Object.keys(tabPaths) as TabRoute[]).find((route) => tabPaths[route] === pathname);
  if (!tab || tabsFor(mode).includes(tab)) return null;
  return landingFor(mode);
}
