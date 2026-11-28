import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { firebaseAuth, isFirebaseConfigured } from './firebase';

interface AuthValue {
  user: User | null;
  /** True until Firebase reports whether someone is already signed in. */
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** #14: checks the password again, as Firebase requires a recent sign-in to delete one. */
  confirmPassword: (password: string) => Promise<void>;
  /**
   * #14: removes the Firebase sign-in itself, which also signs the user out. Firebase may refuse
   * with auth/requires-recent-login if they signed in long ago.
   */
  deleteSignIn: () => Promise<void>;
  /** A fresh Firebase ID token for the API's Authorization header. */
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(firebaseAuth(), (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(firebaseAuth(), email, password);
      },
      createAccount: async (email, password) => {
        await createUserWithEmailAndPassword(firebaseAuth(), email, password);
      },
      resetPassword: (email) => sendPasswordResetEmail(firebaseAuth(), email),
      signOut: () => firebaseSignOut(firebaseAuth()),
      confirmPassword: async (password) => {
        if (!user?.email) throw new Error('Not signed in');
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      },
      deleteSignIn: async () => {
        if (!user) throw new Error('Not signed in');
        await deleteUser(user);
      },
      getIdToken: async () => {
        if (!user) throw new Error('Not signed in');
        return user.getIdToken();
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
