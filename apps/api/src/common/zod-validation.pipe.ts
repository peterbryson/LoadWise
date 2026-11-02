import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/**
 * Validates a request body against a schema from @loadwise/shared, so the API and the app reject
 * exactly the same input. Returns the parsed value (trimmed, upper-cased, etc.), not the raw body.
 *
 * Usage: `@Body(new ZodValidationPipe(CreateSquadSchema)) body: CreateSquad`
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // Same shape as Nest's own errors, plus a list of which fields failed and why.
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
