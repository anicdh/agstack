/**
 * usePaginatedQuery — shared hook for all paginated lists.
 *
 * USE this hook instead of writing pagination logic yourself.
 * Handles: page state, prefetch next page, loading states.
 *
 * @example
 * const { data, meta, page, setPage, isLoading } = usePaginatedQuery({
 *   queryKey: ["users", "list"],
 *   path: "/users",
 *   limit: 20,
 * });
 */

import { useState } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { fetchPaginated, type PaginatedResponse } from "@/lib/api-client";
import type { PageMeta } from "@/types/api";

interface UsePaginatedQueryOptions<T> {
  queryKey: readonly unknown[];
  path: string;
  limit?: number | undefined;
  initialPage?: number | undefined;
  extraParams?: Record<string, unknown> | undefined;
  queryOptions?: Omit<UseQueryOptions<PaginatedResponse<T>>, "queryKey" | "queryFn"> | undefined;
}

export interface UsePaginatedQueryResult<T> {
  data: T[];
  meta: PageMeta | undefined;
  page: number;
  limit: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function usePaginatedQuery<T>({
  queryKey,
  path,
  limit = 20,
  initialPage = 1,
  extraParams,
  queryOptions,
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryResult<T> {
  const [page, setPage] = useState(initialPage);
  const queryClient = useQueryClient();

  const fullQueryKey = [...queryKey, { page, limit, ...extraParams }] as const;

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => fetchPaginated<T>(path, page, limit, extraParams),
    ...queryOptions,
  });

  // Prefetch next page
  const hasNextPage = response ? page < response.meta.totalPages : false;
  if (hasNextPage) {
    const nextPageKey = [...queryKey, { page: page + 1, limit, ...extraParams }];
    queryClient.prefetchQuery({
      queryKey: nextPageKey,
      queryFn: () => fetchPaginated<T>(path, page + 1, limit, extraParams),
    });
  }

  return {
    data: response?.data ?? [],
    meta: response?.meta,
    page,
    limit,
    setPage,
    nextPage: () => { if (hasNextPage) setPage((p) => p + 1); },
    prevPage: () => { if (page > 1) setPage((p) => p - 1); },
    isLoading,
    isError,
    error: error as Error | null,
    hasNextPage,
    hasPrevPage: page > 1,
  };
}
