import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Whether the signed-in user has given health-data consent (#1 AC4, DL-008), and whether they
 * support any squad as staff (#48). Together these decide the entry mode (`lib/entry.ts`).
 * - loading: no answer from the API yet (or nobody is signed in)
 * - needed: no consent recorded, so health screens stay closed (staff screens may still open)
 * - given: consent recorded, so health screens can be shown
 * - error: the API could not be asked; the user can retry
 */
export type ConsentStatus = 'loading' | 'needed' | 'given' | 'error';

interface ConsentState {
  status: ConsentStatus;
  /** True once the user holds at least one staff membership. False while loading. */
  hasStaffSquad: boolean;
  retry: () => void;
  markGiven: () => void;
  /** Call after the user creates a squad as staff, so the Squad tab appears without a reload. */
  markStaffSquad: () => void;
}

type Answer = { uid: string; status: Exclude<ConsentStatus, 'loading'>; hasStaffSquad: boolean };

const ConsentContext = createContext<ConsentState | null>(null);

/**
 * Asks the API whether the signed-in user has consented (`GET /me`) and which squads they are in
 * (`GET /squads`). The answer is stored with the user's id, so a different user signing in on the
 * same phone never sees the previous answer.
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
    Promise.all([api.me(), api.mySquads()])
      .then(([me, squads]) => {
        if (cancelled) return;
        setAnswer({
          uid,
          status: me.healthConsentGiven ? 'given' : 'needed',
          hasStaffSquad: squads.some((squad) => squad.role !== 'ATHLETE'),
        });
      })
      .catch(() => {
        if (!cancelled) setAnswer({ uid, status: 'error', hasStaffSquad: false });
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
    if (uid) setAnswer((current) => ({ uid, status: 'given', hasStaffSquad: current?.uid === uid && current.hasStaffSquad }));
  }, [uid]);

  const markStaffSquad = useCallback(() => {
    setAnswer((current) => (current && current.uid === uid ? { ...current, hasStaffSquad: true } : current));
  }, [uid]);

  const current = uid && answer?.uid === uid ? answer : null;
  const status: ConsentStatus = current ? current.status : 'loading';
  const hasStaffSquad = current?.hasStaffSquad ?? false;
  const value = useMemo(
    () => ({ status, hasStaffSquad, retry, markGiven, markStaffSquad }),
    [status, hasStaffSquad, retry, markGiven, markStaffSquad],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentState {
  const state = useContext(ConsentContext);
  if (!state) throw new Error('useConsent must be used inside ConsentProvider');
  return state;
}
