---
name: typescript-dev
description: >
  ALWAYS call this skill BEFORE writing or modifying ANY TypeScript code (.ts/.tsx files).
  Covers strict mode rules (exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature),
  zero-any policy, type casting rules, import organization, and commit checklist.
  MANDATORY for all TypeScript development in this project.
invocation: auto
---

# TypeScript Development Standards

## Before Writing Any Code

1. Read existing code in the module to understand patterns
2. Check `tsconfig.json` — project uses **maximum strict** mode
3. Check Reuse Map in CLAUDE.md — does shared code already exist?
4. Run `npx tsc --noEmit` before AND after changes

## Strict Mode Rules

This project enforces `exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature`.
These catch real bugs but require specific patterns:

### Optional Properties MUST Include `| undefined`

```typescript
// ✅ CORRECT — explicit undefined
interface PaginationMeta {
  total: number;
  page: number;
  nextCursor?: string | undefined;
}

class User {
  id: string;
  email: string;
  profilePicture?: string | undefined;
  lastLogin?: Date | undefined;
}

// ❌ WRONG — fails with exactOptionalPropertyTypes
interface PaginationMeta {
  total: number;
  page: number;
  nextCursor?: string;  // Error: must include | undefined
}

class User {
  id: string;
  email: string;
  profilePicture?: string;  // Error: must include | undefined
}
```

### Index Signatures Use Bracket Notation

```typescript
// ✅ CORRECT — bracket notation for index signatures
const port = process.env["PORT"];
const value = record["dynamicKey"];
const headers = requestObject["headers"];

function getConfigValue(key: string): string | undefined {
  const config: Record<string, string> = getConfig();
  return config[key];
}

// ❌ WRONG — dot notation on index signatures fails noPropertyAccessFromIndexSignature
const port = process.env.PORT;  // Error
const value = record.dynamicKey;  // Error
const headers = requestObject.headers;  // Error if requestObject is Record<string, unknown>
```

## Type Safety — Zero Tolerance for `any`

```typescript
// ✅ CORRECT — explicit types with runtime validation
import { z } from "zod";

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

function parseUser(data: unknown): User {
  return UserSchema.parse(data);  // Zod validates at runtime
}

// ✅ CORRECT — generic functions with constraints
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// ❌ WRONG — any defeats the type system
function parseUser(data: any): User {
  return data as User;  // No runtime validation, silent failure
}

// ❌ WRONG — implicit any in callback
function process(callback) {  // Error: implicit any
  callback(42);
}
```

### When You Think You Need `any`

| Situation | Use instead |
|-----------|-------------|
| Unknown API response | `unknown` + Zod schema validation |
| Generic function | Proper generics `<T extends Base>` |
| Third-party lib without types | Write a `.d.ts` declaration file |
| Complex union | Discriminated union with `type` field |
| Temporary bypass | NEVER — fix the type properly |
| Function parameters | Use generics or union types |

### `as` Cast — Only with Explanatory Comment

```typescript
// ✅ ACCEPTABLE — with explanation
// DOM element is guaranteed to exist by our app shell initialization
const root = document.getElementById("root") as HTMLDivElement;

// Event type is narrowed by guard condition above
const target = event.target as HTMLInputElement;

// ❌ WRONG — silent cast without justification
const user = response.data as User;

// ❌ WRONG — cast hiding type mismatch
const value = userInput as number;  // User input should be validated, not cast
```

## Naming Conventions

### PascalCase
- TypeScript types, interfaces, classes
- React components
- Enums
- Abstract classes

```typescript
interface UserProfile { }
type ApiResponse = { }
class OrderService { }
enum Status { }
function UserCard() { }  // React component
```

### camelCase
- Variables, functions, methods
- Object properties
- Parameters

```typescript
const userName = "Alice";
function calculateTotal() { }
class Service {
  private cache: Map<string, unknown>;
  setUserPreference(key: string) { }
}
```

### SCREAMING_SNAKE_CASE
- Constants
- Environment variables

```typescript
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
const API_KEY = process.env["API_KEY"];
```

### kebab-case
- File names (except index files)
- Directory names

```
frontend/src/features/user-profile/
api/src/modules/order-management/
components/user-card.tsx
services/api-client.ts
dtos/create-order.dto.ts
```

## Implementation Checklist

### Each New Function

```typescript
// ✅ CORRECT — typed params, typed return, JSDoc for public
/**
 * Calculate total order amount including tax.
 * @param items - Array of order items with prices
 * @param taxRate - Tax rate as decimal (0.1 = 10%)
 * @returns Total amount including tax
 */
export function calculateTotal(
  items: OrderItem[],
  taxRate: number
): Decimal {
  // implementation
}

// ✅ CORRECT — explicit return type
async function fetchUser(id: string): Promise<User | null> {
  // implementation
}

// ❌ WRONG — implicit any return type
function processData(items: any[]) {  // Returns any implicitly
  return items.map(x => x.value);
}

// ❌ WRONG — no type annotations
function calculate(a, b) {  // a, b are implicitly any
  return a + b;
}
```

### Each New Interface/Type

```typescript
// ✅ CORRECT — explicit undefined on optionals, Zod schema for API boundaries
import { z } from "zod";

export const CreateOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

// ✅ CORRECT — discriminated union for complex types
export type ApiResponse<T> =
  | { status: "success"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: string };

// ❌ WRONG — optional without undefined
export interface CreateOrderDto {
  productId: string;
  quantity: number;
  notes?: string;  // Error: must be notes?: string | undefined
}
```

### Each New File

```typescript
// ✅ CORRECT — import order: external → shared → relative
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@shared/types";

import { UserCard } from "./user-card";
import type { UserFilterProps } from "../types";

// ✅ CORRECT — type imports separate from value imports
import type { BaseResponse } from "@/types/api";
import { BaseResponse as BaseResponseFactory } from "@/utils/response";

// ❌ WRONG — mixed import order
import { api } from "@/lib/api-client";
import { useState } from "react";
import { User } from "@shared/types";

// ❌ WRONG — no type keyword for type-only imports
import { BaseResponse } from "@/types/api";  // Should use "import type"
```

## After Writing Code

### Before Commit Checklist

1. **`npx tsc --noEmit`** — zero errors (not just in your editor)
2. **`npx @biomejs/biome check . --write`** — format and lint
3. **No `any` types** — search: `grep -r ": any" --include="*.ts" --include="*.tsx"`
4. **No `as` casts without comment** — verify each cast has explanatory comment
5. **No `console.log` in production** — remove all debug logging
6. **No floating promises** — all async calls awaited or explicitly `void`-marked
7. **All optional properties include `| undefined`** — check all interfaces/types
8. **All index signature access uses bracket notation** — no dot notation
9. **Type imports use `import type`** — verify with `import type { X }`

## Common Patterns

### API DTOs with Zod

```typescript
// ✅ CORRECT — single source of truth
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
  lastLogin: z.string().datetime().optional(),
});

export type UserDto = z.infer<typeof UserSchema>;

// Use in backend endpoint:
const validated = UserSchema.parse(req.body);

// Use in frontend form:
const form = useForm<UserDto>({
  resolver: zodResolver(UserSchema),
});
```

### React Component Props

```typescript
// ✅ CORRECT — separate interface, destructured
interface UserCardProps {
  user: User;
  onDelete: (id: string) => void;
  isLoading?: boolean | undefined;
}

export function UserCard({ user, onDelete, isLoading }: UserCardProps) {
  return (
    <div>
      {/* JSX */}
    </div>
  );
}

// ❌ WRONG — inline types, implicit any
export function UserCard(props: { user: any; onDelete: any }) {
  // ...
}
```

### Error Handling — NestJS

```typescript
// ✅ CORRECT — specific HTTP exceptions
import { NotFoundException, BadRequestException } from "@nestjs/common";

async findUser(id: string): Promise<User> {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundException(`User ${id} not found`);
  }
  return user;
}

// ❌ WRONG — generic errors
throw new Error("not found");  // Returns 500 instead of 404
```

### Error Handling — React

```typescript
// ✅ CORRECT — error boundaries + toast
const { mutate, isPending } = useMutation({
  mutationFn: (data: CreateOrderDto) => api.post("/orders", data),
  onSuccess: (response) => {
    toast.success("Order created");
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  },
  onError: (error) => {
    const message = error instanceof Error ? error.message : "Failed to create order";
    toast.error(message);
  },
});

// ❌ WRONG — unhandled promise, no feedback
const handleSubmit = async () => {
  await api.post("/orders", data);  // No error handling, no toast
};
```

### Async Patterns

```typescript
// ✅ CORRECT — parallel when independent
const [users, products, orders] = await Promise.all([
  this.userService.findAll(),
  this.productService.findAll(),
  this.orderService.findRecent(),
]);

// ✅ CORRECT — Promise.allSettled for partial failure tolerance
const results = await Promise.allSettled([
  sendEmail(user),
  sendSms(user),
  logAnalytics(event),
]);

const failures = results.filter(
  (r): r is PromiseRejectedResult => r.status === "rejected"
);
if (failures.length > 0) {
  this.logger.warn(`${failures.length} notifications failed`);
}

// ✅ CORRECT — void-marked fire-and-forget
void this.analytics.track("order_created", { orderId: order.id });

// ❌ WRONG — sequential when parallel is possible
const users = await this.userService.findAll();
const products = await this.productService.findAll();  // Waits for users unnecessarily

// ❌ WRONG — floating promise, errors swallowed
this.eventBus.emit("order.created", order);  // Not awaited!
```

## Related Skills

- **Read CLAUDE.md Reuse Map** — shared components, hooks, queries (don't duplicate)
- **Read frontend-ui/SKILL.md** — Tailwind conventions, component decisions (for React work)
- **Read postgres/SKILL.md** — schema design, migration patterns (for database work)
