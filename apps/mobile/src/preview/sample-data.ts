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
} as const;
