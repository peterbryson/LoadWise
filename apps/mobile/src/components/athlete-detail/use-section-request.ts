import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';

export type SectionState<T> =
  | { kind: 'loading' }
  /** The API could not be reached at all. */
  | { kind: 'offline' }
  /** 403: the API refused, most often because the athlete stopped sharing with this squad. */
  | { kind: 'refused'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; data: T };

/**
 * #51: loads one section of the athlete detail screen, so each section has its own loading,
 * refused and error states and one failing section never hides another. `load` must be stable
 * (wrap it in useCallback), because a new function starts a new request.
 */
export function useSectionRequest<T>(load: () => Promise<T>): { state: SectionState<T>; retry: () => void } {
  const [state, setState] = useState<SectionState<T>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ kind: 'loaded', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState(failure(error));
      });
    return () => {
      cancelled = true;
    };
    // attempt is a dependency so that Try again loads once more.
  }, [load, attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}

function failure(error: unknown): SectionState<never> {
  if (!(error instanceof ApiError)) return { kind: 'error', message: 'Something went wrong. Try again.' };
  if (error.status === 0) return { kind: 'offline' };
  // The API's refusal messages name no athlete, squad or value, so they are safe to show.
  if (error.status === 403) return { kind: 'refused', message: error.message };
  return { kind: 'error', message: error.message };
}
