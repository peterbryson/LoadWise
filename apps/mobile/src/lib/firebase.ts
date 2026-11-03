import { getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';

/**
 * Firebase web config from apps/mobile/.env (EXPO_PUBLIC_* values are bundled into the app, which
 * is expected: they identify the project and are not secrets). Firebase holds identity only.
 */
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);

let auth: Auth | undefined;

/**
 * getAuth keeps the user signed in on web. On a phone it falls back to memory only, so sign-in
 * does not yet survive an app restart; native persistence is added when the app runs on devices.
 */
export function firebaseAuth(): Auth {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
  auth ??= getAuth(getApps()[0] ?? initializeApp(config));
  return auth;
}
