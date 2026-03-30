/**
 * API mocking utilities — use for testing components that call the API.
 *
 * Pattern: mock the api-client module, not fetch.
 * This keeps tests focused on component behavior, not HTTP details.
 *
 * @example
 * import { mockApi, mockPaginatedResponse } from "@/test/mock-api";
 *
 * beforeEach(() => { mockApi(); });
 *
 * vi.mocked(api.get).mockResolvedValue(mockPaginatedResponse([user1, user2]));
 */

import { vi } from "vitest";
import type { PageMeta } from "@/types/api";

// Mock the api-client module
export function mockApi() {
  vi.mock("@/lib/api-client", () => ({
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    ApiError: class ApiError extends Error {
      constructor(
        public statusCode: number,
        public error: string,
        message: string,
      ) {
        super(message);
      }
    },
  }));
}

export function mockPaginatedResponse<T>(
  data: T[],
  meta?: Partial<PageMeta>,
): { data: T[]; meta: PageMeta } {
  return {
    data,
    meta: {
      total: data.length,
      page: 1,
      limit: 20,
      totalPages: 1,
      ...meta,
    },
  };
}
