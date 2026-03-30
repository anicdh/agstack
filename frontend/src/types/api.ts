/**
 * Shared API types — MUST match with backend BaseResponseDto.
 *
 * DO NOT create separate response types per feature.
 * Import from @/types/api instead of defining again.
 */

export interface BaseResponse<T> {
  data: T;
  meta?: PageMeta | undefined;
  error?: string | undefined;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  sortBy: string;
  sortOrder: "asc" | "desc";
}
