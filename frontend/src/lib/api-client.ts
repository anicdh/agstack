/**
 * API Client — singleton HTTP client for the entire frontend.
 *
 * ALL API calls MUST go through here. DO NOT use fetch() directly.
 * React Query queries use the `api` instance, DO NOT create fetch yourself.
 *
 * @example
 * import { api } from "@/lib/api-client";
 * const users = await api.get<User[]>("/users");
 * await api.post<User>("/users", { name: "An" });
 */

import type { BaseResponse, PageMeta } from "@/types/api";

const API_BASE_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3000/api/v1";

// ─── Error Types ──────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isValidation(): boolean {
    return this.statusCode === 422 || this.statusCode === 400;
  }
}

// ─── Token Management ─────────────────────────────────────────

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ─── Core Request ─────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean | undefined> | undefined;
  body?: unknown;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, body, headers: customHeaders, ...rest } = options;

  // Build URL with query params
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
    ...rest,
  });

  // Handle non-JSON responses
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, "Non-JSON error response");
    }
    return undefined as T;
  }

  const json = (await response.json()) as BaseResponse<T> | { statusCode: number; error: string; message: string };

  if (!response.ok) {
    const errorBody = json as { statusCode: number; error: string; message: string };
    throw new ApiError(
      errorBody.statusCode ?? response.status,
      errorBody.error ?? response.statusText,
      errorBody.message ?? "Unknown error",
    );
  }

  // Unwrap BaseResponse envelope
  return (json as BaseResponse<T>).data;
}

// ─── Public API ───────────────────────────────────────────────

export const api = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, { ...options, body });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PUT", path, { ...options, body });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, { ...options, body });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, options);
  },
};

// ─── Paginated Helper ─────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export async function fetchPaginated<T>(
  path: string,
  page: number,
  limit: number,
  extraParams?: Record<string, unknown>,
): Promise<PaginatedResponse<T>> {
  const url = new URL(`${API_BASE_URL}${path}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url.toString(), { headers });
  const json = (await response.json()) as BaseResponse<T[]>;

  if (!response.ok) {
    const errorBody = json as unknown as { statusCode: number; error: string; message: string };
    throw new ApiError(
      errorBody.statusCode ?? response.status,
      errorBody.error ?? "Error",
      errorBody.message ?? "Unknown error",
    );
  }

  return {
    data: json.data,
    meta: json.meta as PageMeta,
  };
}
