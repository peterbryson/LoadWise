import { z } from 'zod';

/** 1 (worst) to 5 (best). Scale to be confirmed in the Sprint 2 wellness-check design. */
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
