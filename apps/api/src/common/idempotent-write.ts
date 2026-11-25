import { ConflictException } from '@nestjs/common';

/**
 * #6 AC3: the result of a write that carries a client idempotency key. `replayed` is true when the
 * entry was already stored by an earlier attempt, so the controller answers 200 instead of 201.
 */
export interface IdempotentResult<T> {
  saved: T;
  replayed: boolean;
}

/** The part of the Express response a controller needs to change the status code. */
export interface StatusSetter {
  status(code: number): unknown;
}

/**
 * A key that is already stored for a different athlete. The message says nothing about that row,
 * or that another athlete exists, so the key cannot be used to probe other people's data.
 */
export function clientIdTaken(): ConflictException {
  return new ConflictException('This entry could not be saved. Log it again.');
}
