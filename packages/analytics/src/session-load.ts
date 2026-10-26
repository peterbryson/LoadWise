/**
 * Session load in arbitrary units (AU): session-RPE multiplied by duration in minutes
 * (Foster et al., 2001). The building block for weekly load, EWMA ACWR, monotony and strain.
 *
 * @throws RangeError if RPE is not an integer from 1 to 10, or duration is not positive.
 */
export function sessionLoad(rpe: number, durationMinutes: number): number {
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) {
    throw new RangeError(`RPE must be an integer from 1 to 10, got ${rpe}`);
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError(`Duration must be a positive number of minutes, got ${durationMinutes}`);
  }
  return rpe * durationMinutes;
}
