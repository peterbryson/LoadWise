/**
 * Plain-language messages for Firebase Authentication error codes. Wrong email and wrong password
 * share one message, so the screen does not reveal which accounts exist.
 */
const messages: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect. Try again.',
  'auth/wrong-password': 'Email or password is incorrect. Try again.',
  'auth/user-not-found': 'Email or password is incorrect. Try again.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your signal and try again.',
  'auth/user-disabled': 'This account has been disabled.',
};

const fallback = 'Something went wrong signing in. Try again.';

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? (messages[code] ?? fallback) : fallback;
}
