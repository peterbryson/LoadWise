import { SessionTypeSchema } from '@loadwise/shared';
import { SessionType } from '@prisma/client';

// The API passes a validated session type straight to Prisma with no mapping, so the shared Zod
// schema and the database enum must hold exactly the same values. This fails if either changes alone.
describe('FR1: session types match the database (#36)', () => {
  it('has the same values in the shared schema and the Prisma enum', () => {
    expect([...SessionTypeSchema.options].sort()).toEqual(Object.values(SessionType).sort());
  });

  it('rejects the old lower-case values', () => {
    expect(SessionTypeSchema.safeParse('training').success).toBe(false);
  });
});
