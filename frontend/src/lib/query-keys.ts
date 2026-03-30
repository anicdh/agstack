/**
 * Query Key Factory — centralized query keys for React Query.
 *
 * ALL query keys MUST be defined here. DO NOT hardcode string keys in components.
 * Pattern: [feature, action, params?]
 *
 * @example
 * import { queryKeys } from "@/lib/query-keys";
 * useQuery({ queryKey: queryKeys.users.list({ page: 1 }), ... });
 * useQuery({ queryKey: queryKeys.users.detail(userId), ... });
 */

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => ["auth", "me"] as const,
    session: () => ["auth", "session"] as const,
  },

  // ─── Reference feature (Dummies) ─────────────────────────────
  // Run `npm run scaffold:clean` to remove. Use as pattern for new features.
  dummies: {
    all: ["dummies"] as const,
    list: (params?: Record<string, unknown>) => ["dummies", "list", params] as const,
    detail: (id: string) => ["dummies", "detail", id] as const,
  },

  // Add new features following this pattern:
  // [feature]: {
  //   all: ["feature"] as const,
  //   list: (params?) => ["feature", "list", params] as const,
  //   detail: (id) => ["feature", "detail", id] as const,
  // },
} as const;
