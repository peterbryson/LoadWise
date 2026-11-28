import { z } from 'zod';

/**
 * #11, #21: a physio records an injury for an athlete in their squad. Kept minimal on purpose
 * (data minimisation, NFR 2): where, when it started and, once known, when the athlete returned.
 * LoadWise records these; it never diagnoses, predicts or advises on treatment.
 */
export const RecordInjurySchema = z
  .object({
    bodyArea: z
      .string({ error: 'Enter the body area' })
      .trim()
      .min(2, 'Enter the body area, at least 2 characters')
      .max(60, 'Keep the body area to 60 characters or fewer'),
    /** Calendar date the injury started, YYYY-MM-DD. */
    onsetDate: z.iso.date({ error: 'Enter the onset date as YYYY-MM-DD' }),
    /** Calendar date the athlete returned to play, YYYY-MM-DD. Left out while not yet returned. */
    returnDate: z.iso.date({ error: 'Enter the return date as YYYY-MM-DD' }).optional(),
    notes: z.string().trim().max(500, 'Keep notes to 500 characters or fewer').optional(),
  })
  // YYYY-MM-DD strings sort in date order, so a string comparison is a date comparison.
  .refine((injury) => injury.returnDate === undefined || injury.returnDate >= injury.onsetDate, {
    message: 'The return date cannot be before the onset date',
    path: ['returnDate'],
  });

export type RecordInjury = z.infer<typeof RecordInjurySchema>;

/**
 * #21: a training restriction a physio sets for an athlete in one squad, such as "No contact
 * training". Unlike an injury it is shown to the squad's coaches and S&C coaches, so it is a short
 * planning instruction only: no body area, diagnosis or notes (DL-022, NFR 2). The physio decides
 * it and ends it; LoadWise never suggests, sets or ends one, and never decides return to play.
 */
export const RecordRestrictionSchema = z.object({
  description: z
    .string({ error: 'Enter the restriction' })
    .trim()
    .min(3, 'Enter the restriction, at least 3 characters')
    .max(120, 'Keep the restriction to 120 characters or fewer'),
  /** Calendar date the physio plans to review it, YYYY-MM-DD. Shown to staff; LoadWise does nothing on it. */
  reviewOn: z.iso.date({ error: 'Enter the review date as YYYY-MM-DD' }).optional(),
});

export type RecordRestriction = z.infer<typeof RecordRestrictionSchema>;

/** An injury as the squad's physio sees it. Dates are YYYY-MM-DD; returnDate is null until return. */
export interface InjuryRecord {
  id: string;
  bodyArea: string;
  onsetDate: string;
  returnDate: string | null;
  notes: string | null;
}

/** A training restriction as every staff role in the squad sees it. Nothing clinical, no recorder. */
export interface TrainingRestriction {
  id: string;
  description: string;
  /** YYYY-MM-DD, or null if the physio set no review date. */
  reviewOn: string | null;
  /** When the physio set it (ISO timestamp). */
  recordedAt: string;
  /** False once the physio has ended it. Staff lists only ever contain active restrictions. */
  active: boolean;
}
