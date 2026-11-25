import { z } from 'zod';

/**
 * #6 offline sync: a UUID the app generates when an entry is first saved, before it knows whether
 * the API can be reached. Sending the same entry again with the same id never creates a second row,
 * so a retry after a lost response is safe (idempotency key).
 */
export const ClientIdSchema = z.uuid();
