import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Whether the signed-in user has given health-data consent (#1 AC4, DL-008).
 * - loading: no answer from the API yet (or nobody is signed in)
 * - needed: no consent recorded, so the app must show first-time setup
 * - given: consent recorded, so health screens can be shown
 * - error: the API could not be asked; the user can retry
 */
export type ConsentStatus = 'loading' | 'needed' | 'given' | 'error';

interface ConsentState {
  status: ConsentStatus;
  retry: () => void;
  markGiven: () => void;
}

type Answer = { uid: string; status: Exclude<ConsentStatus, 'loading'> };

const ConsentContext = createContext<ConsentState | null>(null);

/**
 * Asks the API (`GET /me`) whether the signed-in user has consented. The answer is stored with the
 * user's id, so a different user signing in on the same phone never sees the previous answer.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const { user, getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const uid = user?.uid ?? null;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (!cancelled) setAnswer({ uid, status: me.healthConsentGiven ? 'given' : 'needed' });
      })
      .catch(() => {
        if (!cancelled) setAnswer({ uid, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [api, uid, attempt]);

  const retry = useCallback(() => {
    setAnswer(null);
    setAttempt((value) => value + 1);
  }, []);

  const markGiven = useCallback(() => {
    if (uid) setAnswer({ uid, status: 'given' });
  }, [uid]);

  const status: ConsentStatus = uid && answer?.uid === uid ? answer.status : 'loading';
  const value = useMemo(() => ({ status, retry, markGiven }), [status, retry, markGiven]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentState {
  const state = useContext(ConsentContext);
  if (!state) throw new Error('useConsent must be used inside ConsentProvider');
  return state;
}
