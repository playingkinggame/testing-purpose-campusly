import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/errors';

export interface Paginated<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  moreError: string | null;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
}

/** Loads pages with an offset, cancels stale requests, and keeps existing items while loading more. */
export function usePaginated<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  deps: unknown[],
  pageSize = 30,
): Paginated<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const fetchRef = useRef(fetchPage);
  const offsetRef = useRef(0);
  const requestRef = useRef(0);
  const appendRef = useRef(false);
  fetchRef.current = fetchPage;

  const run = useCallback(async (offset: number, append: boolean) => {
    const request = ++requestRef.current;
    appendRef.current = append;
    if (append) {
      setLoadingMore(true);
      setMoreError(null);
    } else {
      setLoading(true);
      setError(null);
      setMoreError(null);
      setItems([]);
    }
    try {
      const page = await fetchRef.current(offset, pageSize);
      if (request !== requestRef.current) return;
      setItems((prev) => (append ? [...prev, ...page] : page));
      offsetRef.current = offset + page.length;
      setHasMore(page.length === pageSize);
    } catch (e) {
      if (request !== requestRef.current) return;
      if (append) setMoreError(friendlyError(e));
      else setError(friendlyError(e));
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [pageSize]);

  useEffect(() => {
    offsetRef.current = 0;
    setHasMore(true);
    void run(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => {
    offsetRef.current = 0;
    setHasMore(true);
    void run(0, false);
  }, [run]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void run(offsetRef.current, true);
  }, [hasMore, loading, loadingMore, run]);

  return { items, loading, loadingMore, error, moreError, hasMore, reload, loadMore };
}
