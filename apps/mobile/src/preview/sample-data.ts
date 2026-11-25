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
    thisWeek: '3,240',
    usualWeek: '2,000',
    ratio: '1.62',
    guide: '1.5',
    title: 'Your load has increased faster than usual',
  },
  wellnessInsight: 'Sleep is lower than your recent average.',
  wellnessTrend: [
    { label: 'Sleep', value: '3.2', usual: 'below usual 3.9', belowUsual: true },
    { label: 'Soreness', value: '3.8', usual: 'usual 3.7', belowUsual: false },
    { label: 'Fatigue', value: '3.4', usual: 'usual 3.6', belowUsual: false },
    { label: 'Stress', value: '3.9', usual: 'usual 3.8', belowUsual: false },
  ],
} as const;
