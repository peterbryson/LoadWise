import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ApiClient, ApiError, apiBaseUrl, createApiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export type RequestState<T> =
  | { kind: 'loading' }
  /** The API could not be reached at all, which on a phone usually means no signal. */
  | { kind: 'offline' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; data: T };

/**
 * Loads one API resource each time the screen comes into view, so it reflects anything just
 * logged, and keeps a failure inside the component that asked for it.
 */
export function useApiRequest<T>(load: (api: ApiClient) => Promise<T>): {
  state: RequestState<T>;
  retry: () => void;
} {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, getIdToken }), [getIdToken]);
  const [state, setState] = useState<RequestState<T>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      load(api)
        .then((data) => {
          if (!cancelled) setState({ kind: 'loaded', data });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (error instanceof ApiError && error.status === 0) setState({ kind: 'offline' });
          else setState({ kind: 'error', message: error instanceof ApiError ? error.message : 'Something went wrong. Try again.' });
        });
      return () => {
        cancelled = true;
      };
      // attempt is a dependency so that Try again loads once more.
    }, [api, load, attempt]),
  );

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
