import { z } from 'zod';

/**
 * 1 (worst) to 5 (best) for every item, confirmed 3 Nov 2026 (#5 AC3). The app labels each end of
 * the scale in plain language, e.g. Sleep: 1 Poor, 5 Great.
 */
const score = z.number().int().min(1).max(5);

/** FR 1: the daily wellness check. One entry per athlete per day. */
export const WellnessCheckSchema = z.object({
  date: z.iso.date(),
  sleep: score,
  soreness: score,
  fatigue: score,
  stress: score,
});

export type WellnessCheck = z.infer<typeof WellnessCheckSchema>;
