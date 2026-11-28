import { ApiError } from './api';
import { AccountDeletionSteps, deleteAccountAndData, offlineQueueKey } from './account-deletion';

function steps(overrides: Partial<AccountDeletionSteps> = {}) {
  const calls: string[] = [];
  const record = (name: string) => jest.fn(() => {
    calls.push(name);
    return Promise.resolve();
  });
  const all: AccountDeletionSteps = {
    confirmPassword: record('confirmPassword'),
    deleteAccount: record('deleteAccount'),
    removeItem: jest.fn((key: string) => {
      calls.push(`removeItem ${key}`);
      return Promise.resolve();
    }),
    deleteSignIn: record('deleteSignIn'),
    ...overrides,
  };
  return { all, calls };
}

describe('NFR2 #14: deleting the account from the app', () => {
  it('checks the password, deletes the data, clears the phone queue, then the sign-in', async () => {
    const { all, calls } = steps();

    await expect(deleteAccountAndData('fb-1', all)).resolves.toBe('deleted');

    expect(calls).toEqual([
      'confirmPassword',
      'deleteAccount',
      'removeItem loadwise.offline-queue.v1.fb-1',
      'deleteSignIn',
    ]);
  });

  it('deletes nothing when the password is wrong', async () => {
    const wrong = Object.assign(new Error('wrong'), { code: 'auth/invalid-credential' });
    const { all } = steps({ confirmPassword: jest.fn().mockRejectedValue(wrong) });

    await expect(deleteAccountAndData('fb-1', all)).rejects.toBe(wrong);

    expect(all.deleteAccount).not.toHaveBeenCalled();
    expect(all.removeItem).not.toHaveBeenCalled();
    expect(all.deleteSignIn).not.toHaveBeenCalled();
  });

  it('keeps the sign-in and the phone queue when the API fails, so the user can try again', async () => {
    const failure = new ApiError(0, "Can't reach the LoadWise API.");
    const { all } = steps({ deleteAccount: jest.fn().mockRejectedValue(failure) });

    await expect(deleteAccountAndData('fb-1', all)).rejects.toBe(failure);

    expect(all.removeItem).not.toHaveBeenCalled();
    expect(all.deleteSignIn).not.toHaveBeenCalled();
  });

  it('reports that only the sign-in is left when Firebase will not delete it', async () => {
    const { all } = steps({ deleteSignIn: jest.fn().mockRejectedValue(new Error('auth/network-request-failed')) });

    await expect(deleteAccountAndData('fb-1', all)).resolves.toBe('sign-in-kept');

    expect(all.deleteAccount).toHaveBeenCalled();
    expect(all.removeItem).toHaveBeenCalledWith(offlineQueueKey('fb-1'));
  });
});
