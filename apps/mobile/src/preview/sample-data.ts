/**
 * Illustrative figures copied from the Figma LoadWise V1 screens. Nothing here comes from the
 * analytics engine: every screen that uses this file shows a PreviewBanner. The 28-day baseline
 * and 1.5 guide are placeholders until the Sprint 4 flag spike (DL-007).
 */
export const sample = {
  baseline: { day: 9, of: 28 },
  newUser: { thisWeek: '1,240', sessions: '3' },
  usual: { thisWeek: '2,150', usualWeek: '2,000' },
  flagged: {
    ratio: '1.62',
    guide: '1.5',
  },
  wellnessInsight: 'Sleep is lower than your recent average.',
  weeklyLoad: [
    { label: 'Wk 1', height: 43 },
    { label: 'Wk 2', height: 48 },
    { label: 'Wk 3', height: 46 },
    { label: 'Wk 4', height: 49 },
    { label: 'Wk 5', height: 47 },
  ],
  nowBar: { label: 'Now', value: '3,240', height: 76 },
  firstWeeks: [
    { label: 'Last wk', value: '980', height: 60 },
    { label: 'Now', value: '1,240', height: 76 },
  ],
  loggedSoFar: '8 check-ins and 5 sessions. Keep logging for a fuller picture.',
} as const;
