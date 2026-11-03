import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { TokenVerifier } from './token-verifier';

const IDENTITY = { uid: 'fb-1', email: 'aoife@example.com', name: 'Aoife' };
const USER = { id: 'user-1', firebaseUid: 'fb-1' };

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('FR4: sign-in creates or finds the LoadWise user (#1)', () => {
  const verifier = { verify: jest.fn() };
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const service = new AuthService(
    verifier as TokenVerifier,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    verifier.verify.mockResolvedValue(IDENTITY);
  });

  it('returns the existing user without creating another', async () => {
    prisma.user.findUnique.mockResolvedValue(USER);

    await expect(service.authenticate('token')).resolves.toEqual(USER);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates the user on their first signed-in request', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(USER);

    await expect(service.authenticate('token')).resolves.toEqual(USER);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { firebaseUid: 'fb-1', email: 'aoife@example.com', displayName: 'Aoife' },
      }),
    );
  });

  it('uses the start of the email as the display name when the token has no name', async () => {
    verifier.verify.mockResolvedValue({ uid: 'fb-1', email: 'aoife@example.com' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(USER);

    await service.authenticate('token');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: 'aoife' }) }),
    );
  });

  it('returns the user created by a simultaneous first request instead of failing', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(USER);
    prisma.user.create.mockRejectedValue(uniqueViolation());

    await expect(service.authenticate('token')).resolves.toEqual(USER);
  });

  it('rejects with 409, not 500, when the email belongs to another Firebase account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(uniqueViolation());

    const result = service.authenticate('token');
    await expect(result).rejects.toBeInstanceOf(ConflictException);
    // NFR 2: personal data stays out of error messages.
    await expect(result).rejects.not.toThrow(/aoife@example\.com/);
  });

  it('passes other database failures through unchanged', async () => {
    const outage = new Error('database unavailable');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(outage);

    await expect(service.authenticate('token')).rejects.toBe(outage);
  });

  it('never touches the database when the token is rejected', async () => {
    verifier.verify.mockRejectedValue(new UnauthorizedException());

    await expect(service.authenticate('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
