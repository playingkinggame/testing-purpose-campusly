import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/errors';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (v: T | null | ((prev: T | null) => T | null)) => void;
}

/** Runs an async function, tracks loading / error / data, and lets you reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (quiet: boolean) => {
    if (!quiet) setLoading(true);
    try {
      const v = await fnRef.current();
      if (!alive.current) return;
      setData(v);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(friendlyError(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void run(false);
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => run(true), [run]);
  return { data, error, loading, reload, setData };
}
