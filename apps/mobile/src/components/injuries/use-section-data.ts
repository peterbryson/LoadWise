import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';

export type SectionState<T> =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'loaded'; data: T };

/** A failure message that is safe to show: the API's refusals name no one (#11). */
export function sectionErrorMessage(error: unknown, what: string): string {
  if (error instanceof ApiError && error.status === 0) {
    return `Can't reach LoadWise, so ${what} can't load. Check your connection, then try again.`;
  }
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Loads one list for a section of a screen, so a failure stays inside that section and the rest of
 * the screen still shows. `load` must be stable (wrap it in useCallback). `update` changes the
 * loaded list in place after a save, without another request.
 */
export function useSectionData<T>(load: () => Promise<T>, what: string) {
  const [state, setState] = useState<SectionState<T>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ kind: 'loaded', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: sectionErrorMessage(error, what) });
      });
    return () => {
      cancelled = true;
    };
  }, [load, what, attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  const update = useCallback((change: (data: T) => T) => {
    setState((current) =>
      current.kind === 'loaded' ? { kind: 'loaded', data: change(current.data) } : current,
    );
  }, []);

  return { state, retry, update };
}
