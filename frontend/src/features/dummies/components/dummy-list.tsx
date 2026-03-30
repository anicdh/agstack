/**
 * DummyList — paginated table of dummies with search and category filter.
 *
 * THIS IS A REFERENCE IMPLEMENTATION for the boilerplate.
 * Use this as a pattern when creating new list components.
 * Run `npm run scaffold:clean` to remove all Dummies code.
 *
 * PATTERN for list components:
 * 1. Use usePaginatedQuery (from shared hooks) for data fetching
 * 2. Early return for loading/error states
 * 3. Destructure props with TypeScript interface
 * 4. Tailwind only for styling, mobile-first responsive
 * 5. Extract sub-components for table rows, skeletons, etc.
 */

import { useState } from "react";
import { useDummies, useDeleteDummy } from "../queries/use-dummies";
import { useDebounce } from "@/hooks/use-debounce";
import type { DummyPublic, DummyFilters } from "../types";
import { DummyCategory } from "../types";

interface DummyListProps {
  onEdit: (dummy: DummyPublic) => void;
}

export function DummyList({ onEdit }: DummyListProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);

  const filters: DummyFilters = {
    search: debouncedSearch || undefined,
    category: categoryFilter || undefined,
  };

  const {
    data: dummies,
    meta,
    page,
    nextPage,
    prevPage,
    isLoading,
    isError,
    error,
    hasNextPage,
    hasPrevPage,
  } = useDummies(filters);

  const deleteDummy = useDeleteDummy();

  // ─── Early returns for loading/error ──────────────────────

  if (isLoading) {
    return <DummyListSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
        <p className="text-sm text-red-800">
          Failed to load dummies: {error?.message ?? "Unknown error"}
        </p>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <input
          type="search"
          placeholder="Search dummies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm
                     placeholder:text-gray-400 focus:border-blue-500 focus:outline-none
                     focus:ring-1 focus:ring-blue-500"
          aria-label="Search dummies"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {Object.values(DummyCategory).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {meta && (
          <span className="text-sm text-gray-500">
            {meta.total} item{meta.total !== 1 ? "s" : ""} total
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Name
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Email
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Category
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {dummies.map((dummy) => (
              <DummyRow
                key={dummy.id}
                dummy={dummy}
                onEdit={() => onEdit(dummy)}
                onDelete={() => deleteDummy.mutate(dummy.id)}
                isDeleting={deleteDummy.isPending}
              />
            ))}
            {dummies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No dummies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={prevPage}
              disabled={!hasPrevPage}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={nextPage}
              disabled={!hasNextPage}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

interface DummyRowProps {
  dummy: DummyPublic;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  ARCHIVED: "bg-yellow-100 text-yellow-800",
};

const CATEGORY_STYLES: Record<string, string> = {
  ALPHA: "bg-blue-100 text-blue-800",
  BETA: "bg-purple-100 text-purple-800",
  GAMMA: "bg-orange-100 text-orange-800",
};

function DummyRow({ dummy, onEdit, onDelete, isDeleting }: DummyRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
        {dummy.name}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
        {dummy.email}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLES[dummy.status] ?? "bg-gray-100 text-gray-800"
          }`}
        >
          {dummy.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            CATEGORY_STYLES[dummy.category] ?? "bg-gray-100 text-gray-800"
          }`}
        >
          {dummy.category}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
        <button
          type="button"
          onClick={onEdit}
          className="mr-2 text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────

function DummyListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dummies">
      <div className="flex gap-4">
        <div className="h-10 w-64 animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-40 animate-pulse rounded-md bg-gray-200" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-12 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
