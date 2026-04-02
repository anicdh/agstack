---
name: typescript-dev
description: >
  ALWAYS read this BEFORE writing or modifying any TypeScript (.ts/.tsx) files.
  Covers strict mode rules, zero-any policy, Zod patterns, React hooks,
  async patterns. MANDATORY for agent-api and agent-frontend.
invocation: auto
---

# TypeScript Development Standards

> **MANDATORY:** agent-api and agent-frontend MUST read this file before writing or modifying any `.ts` / `.tsx` file.

## Before Writing Any Code

1. Read existing code in the module to understand patterns
2. Check `tsconfig.json` — project uses **maximum strict** mode
3. Check Reuse Map in CLAUDE.md — does shared code already exist?
4. Run `npx tsc --noEmit` before AND after changes

## Strict TypeScript Rules

This project uses `exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature`.
These catch real bugs but require specific patterns:

### Optional Properties MUST include `| undefined`

```typescript
// ✅ CORRECT — explicit undefined
interface PaginationMeta {
  total: number;
  page: number;
  nextCursor?: string | undefined;
}

// ❌ WRONG — fails with exactOptionalPropertyTypes
interface PaginationMeta {
  total: number;
  page: number;
  nextCursor?: string;  // Error: must include | undefined
}
```

### Index Signatures Use Bracket Notation

```typescript
// ✅ CORRECT — bracket notation for index signatures
const port = process.env["PORT"];
const value = record["dynamicKey"];

// ❌ WRONG — dot notation on index signatures
const port = process.env.PORT;  // Error with noPropertyAccessFromIndexSignature
const value = record.dynamicKey;
```

## Type Safety — Zero Tolerance for `any`

```typescript
// ✅ CORRECT — explicit types
function parseResponse(data: unknown): UserDto {
  const parsed = UserSchema.parse(data);  // Zod validates at runtime
  return parsed;
}

// ❌ WRONG — any defeats the type system
function parseResponse(data: any): UserDto {
  return data as UserDto;  // No runtime validation
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

### `as` Cast — Only with Comment

```typescript
// ✅ ACCEPTABLE — with explanation
// DOM element is guaranteed to exist by our app shell
const root = document.getElementById("root") as HTMLDivElement;

// ❌ WRONG — silent cast without justification
const user = response.data as User;
```

## Error Handling Patterns

### Backend (NestJS)

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

### Frontend (React)

```typescript
// ✅ CORRECT — error boundaries + toast
const { mutate, isPending } = useApiMutation({
  mutationFn: (data: CreateOrderDto) => api.post("/orders", data),
  onSuccess: () => {
    toast.success("Order created");
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  },
  onError: (error) => {
    toast.error(error.message || "Failed to create order");
  },
});

// ❌ WRONG — unhandled promise, no feedback
const handleSubmit = async () => {
  await api.post("/orders", data);  // No error handling, no toast
};
```

## Zod Schema Patterns

```typescript
// ✅ CORRECT — single source of truth for types
import { z } from "zod";

export const CreateOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

// Use in API endpoint:
const validated = CreateOrderSchema.parse(req.body);

// Use in frontend form:
const form = useForm<CreateOrderDto>({
  resolver: zodResolver(CreateOrderSchema),
});
```

```typescript
// ❌ WRONG — separate type and validation = drift
interface CreateOrderDto {
  productId: string;
  quantity: number;
}
// Validation logic somewhere else, easily gets out of sync
```

## Async Patterns

### Parallel When Independent

```typescript
// ✅ CORRECT — parallel fetch for independent data
const [users, products, orders] = await Promise.all([
  this.userService.findAll(),
  this.productService.findAll(),
  this.orderService.findRecent(),
]);

// ❌ WRONG — sequential when parallel is possible
const users = await this.userService.findAll();
const products = await this.productService.findAll();  // Waits for users unnecessarily
const orders = await this.orderService.findRecent();
```

### Error Handling in Parallel

```typescript
// ✅ CORRECT — Promise.allSettled when partial failure is OK
const results = await Promise.allSettled([
  sendEmail(user),
  sendSms(user),
  logAnalytics(event),
]);

const failures = results.filter(
  (r): r is PromiseRejectedResult => r.status === "rejected"
);
if (failures.length > 0) {
  this.logger.warn(`${failures.length} notifications failed`, failures);
}
```

### Avoid Floating Promises

```typescript
// ✅ CORRECT — awaited or void-marked
await this.eventBus.emit("order.created", order);

// Fire-and-forget with explicit void
void this.analytics.track("order_created", { orderId: order.id });

// ❌ WRONG — floating promise, errors swallowed silently
this.eventBus.emit("order.created", order);  // Not awaited!
```

## React-Specific Patterns

### Hooks Rules

```typescript
// ✅ CORRECT — derived state computed directly
const filteredItems = useMemo(
  () => items.filter((item) => item.status === filter),
  [items, filter],
);

// ❌ WRONG — useEffect for derived state
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
useEffect(() => {
  setFilteredItems(items.filter((item) => item.status === filter));
}, [items, filter]);  // Extra render, stale state risk
```

### Component Props

```typescript
// ✅ CORRECT — separate interface, destructured
interface OrderCardProps {
  order: Order;
  onCancel: (id: string) => void;
  isLoading?: boolean | undefined;
}

function OrderCard({ order, onCancel, isLoading }: OrderCardProps) {
  // ...
}

// ❌ WRONG — inline types, not destructured
function OrderCard(props: { order: any; onCancel: any }) {
  // ...
}
```

### Custom Hooks for Logic

```typescript
// ✅ CORRECT — extract logic into custom hook
function useOrderActions(orderId: string) {
  const queryClient = useQueryClient();

  const cancel = useApiMutation({
    mutationFn: () => api.patch(`/orders/${orderId}/cancel`),
    onSuccess: () => {
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });

  return { cancel };
}

// ❌ WRONG — mutation logic duplicated across components
```

## Import Organization

```typescript
// 1. External libraries
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

// 2. Shared/lib imports (path alias @/)
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

// 3. Feature-local imports (relative)
import { OrderCard } from "./order-card";
import type { Order } from "../types";
```

## Before Commit Checklist

1. `npx tsc --noEmit` — zero errors
2. `npx @biomejs/biome check .` — zero errors
3. No `any` types (search: `grep -r ': any' --include='*.ts' --include='*.tsx'`)
4. No `as` casts without explanatory comment
5. No `console.log` in production code
6. No floating promises (all async calls awaited or explicitly voided)
7. All optional properties include `| undefined`
8. All index signature access uses bracket notation
