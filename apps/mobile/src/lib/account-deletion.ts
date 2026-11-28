/** Where the offline queue (#6) keeps one user's unsynced entries on this device. */
export function offlineQueueKey(uid: string): string {
  return `loadwise.offline-queue.v1.${uid}`;
}

export interface AccountDeletionSteps {
  /** Checks the password, which Firebase needs to have been entered recently to delete a sign-in. */
  confirmPassword: () => Promise<void>;
  /** `DELETE /me`: removes the account and all its data from LoadWise. */
  deleteAccount: () => Promise<void>;
  /** Removes one key from the device's storage. */
  removeItem: (key: string) => Promise<void>;
  /** Removes the Firebase sign-in, which also signs the user out. */
  deleteSignIn: () => Promise<void>;
}

/** `deleted`: nothing is left. `sign-in-kept`: all data is gone, but Firebase kept the email login. */
export type AccountDeletionResult = 'deleted' | 'sign-in-kept';

/**
 * #14: deletes the account in an order that never leaves health data behind.
 * 1. The password is checked. A wrong one throws and nothing is deleted.
 * 2. The API deletes everything in LoadWise. If that fails, it throws and nothing else happens, so
 *    the user can try again with their account intact.
 * 3. Entries still waiting to sync on this phone are health data too, and their account no longer
 *    exists, so they are removed.
 * 4. The Firebase sign-in, which holds only the email address and name, is removed last. If that
 *    fails, the data is already gone; the screen says so and offers to sign out.
 *
 * The other order (Firebase first) was rejected: if the API call then failed, the health data
 * would stay in LoadWise with no way left to sign in and delete it.
 */
export async function deleteAccountAndData(uid: string, steps: AccountDeletionSteps): Promise<AccountDeletionResult> {
  await steps.confirmPassword();
  await steps.deleteAccount();
  await steps.removeItem(offlineQueueKey(uid));
  try {
    await steps.deleteSignIn();
    return 'deleted';
  } catch {
    return 'sign-in-kept';
  }
}
