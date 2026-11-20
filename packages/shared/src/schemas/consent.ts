import { z } from 'zod';

/**
 * Version of the privacy notice an athlete agrees to at first-time setup (DL-008). Stored with each
 * consent event so we can show what was agreed to, not only when (UK GDPR Art. 7(1)).
 * Change it whenever the notice wording changes.
 */
export const HEALTH_DATA_NOTICE_VERSION = '2026-11';

/**
 * #1 AC4: explicit consent to LoadWise processing the user's health data. The client must send the
 * current notice version, so an out-of-date app cannot record consent to wording it never showed.
 */
export const GiveHealthConsentSchema = z.object({
  noticeVersion: z.literal(HEALTH_DATA_NOTICE_VERSION, {
    error: 'The privacy notice has changed. Update the app and try again.',
  }),
});

export type GiveHealthConsent = z.infer<typeof GiveHealthConsentSchema>;
