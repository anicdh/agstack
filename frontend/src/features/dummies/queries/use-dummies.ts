/**
 * Dummy queries — React Query hooks for dummy API calls.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating queries for new features.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN:
 * - Use queryKeys from @/lib/query-keys.ts (never hardcode keys)
 * - Use usePaginatedQuery for list endpoints
 * - Use useApiMutation for create/update/delete
 * - Use api client for raw fetch (never use fetch() directly)
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useApiMutation } from "@/hooks/use-api-mutation";
import type { DummyPublic, CreateDummyDto, UpdateDummyDto, DummyFilters } from "../types";

// ─── List (paginated) ─────────────────────────────────────────

export function useDummies(filters?: DummyFilters) {
  return usePaginatedQuery<DummyPublic>({
    queryKey: queryKeys.dummies.list(filters),
    path: "/dummies",
    limit: 20,
    extraParams: filters,
  });
}

// ─── Detail ───────────────────────────────────────────────────

export function useDummy(id: string) {
  return useQuery({
    queryKey: queryKeys.dummies.detail(id),
    queryFn: () => api.get<DummyPublic>(`/dummies/${id}`),
    enabled: Boolean(id),
  });
}

// ─── Create ───────────────────────────────────────────────────

export function useCreateDummy() {
  return useApiMutation<DummyPublic, CreateDummyDto>({
    mutationFn: (data) => api.post<DummyPublic>("/dummies", data),
    invalidateKeys: [queryKeys.dummies.all],
    successMessage: "Dummy created successfully",
  });
}

// ─── Update ───────────────────────────────────────────────────

export function useUpdateDummy(id: string) {
  return useApiMutation<DummyPublic, UpdateDummyDto>({
    mutationFn: (data) => api.patch<DummyPublic>(`/dummies/${id}`, data),
    invalidateKeys: [queryKeys.dummies.all, queryKeys.dummies.detail(id)],
    successMessage: "Dummy updated successfully",
  });
}

// ─── Delete ───────────────────────────────────────────────────

export function useDeleteDummy() {
  return useApiMutation<DummyPublic, string>({
    mutationFn: (id) => api.delete<DummyPublic>(`/dummies/${id}`),
    invalidateKeys: [queryKeys.dummies.all],
    successMessage: "Dummy deleted successfully",
  });
}
