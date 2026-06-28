/** Tiny async-state hook: { loading, error, data, reload }. */

import { useCallback, useEffect, useState } from "react";

export interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
  reload: () => void;
}

export function useAsync<T>(factory: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<{ loading: boolean; error: Error | null; data: T | null }>({
    loading: true,
    error: null,
    data: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, data: null });
    factory()
      .then((data) => alive && setState({ loading: false, error: null, data }))
      .catch((error: Error) => alive && setState({ loading: false, error, data: null }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload };
}
