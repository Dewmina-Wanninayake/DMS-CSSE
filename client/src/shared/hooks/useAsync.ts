import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  /** Runs the loader again (the "Retry" button of `ErrorState`). */
  reload: () => void;
}

/**
 * Loads data when `deps` change and exposes loading / error / data, so every screen handles the
 * three states the same way (the team plan §3.9). Late responses from superseded requests are ignored.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [state, setState] = useState<Omit<AsyncState<T>, 'reload'>>({
    data: undefined,
    error: undefined,
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    loader().then(
      (data) => {
        if (id === latest.current) setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        if (id === latest.current) {
          setState({
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
            loading: false,
          });
        }
      },
    );
    return () => {
      latest.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller controls when to reload via `deps`
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
