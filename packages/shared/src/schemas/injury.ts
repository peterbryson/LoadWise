import { z } from 'zod';

/**
 * #11, #21: a physio records an injury for an athlete in their squad. Kept minimal on purpose
 * (data minimisation, NFR 2): where, when it started and, once known, when the athlete returned.
 * LoadWise records these; it never diagnoses, predicts or advises on treatment.
 */
export const RecordInjurySchema = z
  .object({
    bodyArea: z.string().trim().min(2).max(60),
    /** Calendar date the injury started, YYYY-MM-DD. */
    onsetDate: z.iso.date(),
    /** Calendar date the athlete returned to play, YYYY-MM-DD. Left out while not yet returned. */
    returnDate: z.iso.date().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  // YYYY-MM-DD strings sort in date order, so a string comparison is a date comparison.
  .refine((injury) => injury.returnDate === undefined || injury.returnDate >= injury.onsetDate, {
    message: 'The return date cannot be before the onset date',
    path: ['returnDate'],
  });

export type RecordInjury = z.infer<typeof RecordInjurySchema>;
