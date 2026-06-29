import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { DEFAULT_PAGE_SIZE } from '../types/pagination';

type FetchPage<T, F> = (params: ListQuery & F) => Promise<PaginatedResult<T>>;

type Options<F> = {
  pageSize?: number;
  filters?: F;
  debounceMs?: number;
};

export function usePaginatedList<T, F extends object = Record<string, never>>(
  fetchPage: FetchPage<T, F>,
  options: Options<F> = {},
) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const filters = options.filters ?? ({} as F);
  const debounceMs = options.debounceMs ?? 300;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const result = await fetchPage({
        offset,
        limit: pageSize,
        search: debouncedSearch.trim() || undefined,
        ...filtersRef.current,
      });
      setTotal(result.total);
      setHasMore(result.hasMore);
      setItems((prev) => (append ? [...prev, ...result.items] : result.items));
      return result;
    },
    [fetchPage, pageSize, debouncedSearch],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await loadPage(0, false);
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    void reload();
  }, [debouncedSearch, reload, JSON.stringify(filters)]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await loadPage(items.length, true);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, loadPage, items.length]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPage(0, false);
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  return {
    items,
    total,
    hasMore,
    loading,
    loadingMore,
    refreshing,
    search,
    setSearch,
    loadMore,
    refresh,
    reload,
  };
}
