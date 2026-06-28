/** Tiny async-state hook: { loading, error, data } for a promise factory. */

import { useEffect, useState } from "react";

export interface AsyncState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}

export function useAsync<T>(factory: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    loading: true,
    error: null,
    data: null,
  });

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
  }, deps);

  return state;
}
