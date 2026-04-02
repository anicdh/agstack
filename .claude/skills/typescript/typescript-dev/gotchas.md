# TypeScript Development Gotchas

Common TypeScript mistakes in full-stack projects (React + NestJS) and how to avoid them.

## Strict Mode Violations

### Missing `| undefined` on Optional Properties

```typescript
// WRONG: Compiles in loose mode but fails in strict
interface User {
  id: string;
  email: string;
  phone?: string;  // Error: exactOptionalPropertyTypes
}

// CORRECT: Explicit undefined
interface User {
  id: string;
  email: string;
  phone?: string | undefined;
}

// Why it matters:
const user: User = { id: "1", email: "a@b.com" };
// In loose mode: user.phone could be undefined (implicit)
// In strict mode: you MUST handle undefined explicitly
const displayPhone = user.phone?.toUpperCase();  // Safe
```

---

### Dot Notation on Index Signatures

```typescript
// WRONG: Fails with noPropertyAccessFromIndexSignature
const port = process.env.PORT;  // Error
const value = record.dynamicKey;  // Error if Record<string, T>

function getHeader(headers: Record<string, string>, name: string) {
  return headers.name;  // Error: use bracket notation
}

// CORRECT: Bracket notation
const port = process.env["PORT"];
const value = record["dynamicKey"];

function getHeader(headers: Record<string, string>, name: string) {
  return headers[name];
}

// Why it matters:
// TypeScript cannot guarantee a dot-notation property exists on index signatures
// Bracket notation is the only safe way to access dynamic keys
```

---

## Type Safety Issues

### Using `any` Instead of `unknown`

```typescript
// WRONG: Silent failure, no type safety
function processData(data: any) {
  return data.toUpperCase();  // Might crash at runtime if data is a number
}

function parseJson(json: any): User {
  return json;  // No validation, could return garbage
}

// CORRECT: Validate unknown data
import { z } from "zod";

function processData(data: unknown): string {
  if (typeof data !== "string") {
    throw new Error("Expected string");
  }
  return data.toUpperCase();
}

const UserSchema = z.object({ id: z.string(), name: z.string() });
function parseJson(json: unknown): User {
  return UserSchema.parse(json);  // Runtime validation
}

// Why it matters:
// 'any' disables type checking. 'unknown' requires validation.
// This catches bugs at runtime instead of in production.
```

---

### Silent Type Casts

```typescript
// WRONG: No explanation, hides type issues
const user = response.data as User;
const count = userInput as number;
const items = (apiResponse as any).items;

// CORRECT: Cast with justification
// API returns type { data: Record<string, unknown> }, schema validation happens at parse time
const user = (apiResponse["data"] as User);  // Type narrowed by Zod.parse above

// Guaranteed by API contract: response.status === 200 means data is present
const count = Number(userInput);  // Explicit conversion with validation

// Event type is narrowed by guard, safe to cast
const button = event.currentTarget as HTMLButtonElement;

// Why it matters:
// Silent casts hide bugs. A comment forces you to think about whether it's safe.
// If you can't justify the cast, you probably shouldn't do it.
```

---

### Implicit `any` in Callbacks

```typescript
// WRONG: Parameters are implicitly any
function useQuery(key: string, fn) {  // fn is any
  // ...
}

const data = useQuery("users", (page) => {  // page is any
  return fetch(`/api/users?page=${page}`);
});

// CORRECT: Explicit parameter types
function useQuery<T>(
  key: string,
  fn: (page: number) => Promise<T>
): Query<T> {
  // ...
}

const data = useQuery<User[]>("users", (page: number) => {
  return fetch(`/api/users?page=${page}`);
});

// Why it matters:
// Implicit any in callbacks defeats type safety silently
// You won't get errors until runtime
```

---

### Unvalidated Type Assertions

```typescript
// WRONG: Assumes API response has expected shape
async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();  // data is unknown
  return data as User;  // No validation!
}

// CORRECT: Validate before asserting
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();  // data is unknown
  return UserSchema.parse(data);  // Validates schema, typed as User
}

// Why it matters:
// API contracts change. Validation ensures your code adapts gracefully.
// Silent assertion will crash when API adds/removes fields.
```

---

## Import Issues

### Non-Type Imports of Type-Only Exports

```typescript
// WRONG: Increases bundle size unnecessarily
import { User, getUserById } from "@/services/user";
const name: User["name"] = "John";  // User only used as type

// Also wrong: Type-only import, value used at runtime
import type { BaseResponse } from "@/utils/response";
const response = new BaseResponse(200, data);  // Error: BaseResponse not available

// CORRECT: Separate type and value imports
import type { User } from "@/services/user";
import { getUserById } from "@/services/user";

import { BaseResponse } from "@/utils/response";
import type { ApiConfig } from "@/utils/response";

// Why it matters:
// Type-only imports are erased at compile time, reduce bundle size
// Mixing them causes either bloat or runtime errors
```

---

### Import Order Chaos

```typescript
// WRONG: Random import order is hard to maintain
import { OrderCard } from "./order-card";
import type { User } from "@shared/types";
import { api } from "@/lib/api-client";
import React from "react";

// CORRECT: 1) External 2) Shared/lib 3) Relative
import React from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@shared/types";

import { OrderCard } from "./order-card";
import type { OrderCardProps } from "../types";

// Why it matters:
// Consistent ordering prevents accidental circular imports
// Makes diffs cleaner in version control
```

---

## Mutable Exports

### Exporting `let` or `var` Instead of `const`

```typescript
// WRONG: Mutable export can be changed elsewhere
export let currentUser: User | null = null;  // Anywhere can mutate this

function setUser(user: User) {
  currentUser = user;  // Global mutation
}

// CORRECT: Immutable export with getter/setter
let currentUserInternal: User | null = null;

export function getCurrentUser(): User | null {
  return currentUserInternal;
}

export function setCurrentUser(user: User | null): void {
  currentUserInternal = user;
}

// Why it matters:
// Mutable exports are hard to track and cause unexpected behavior
// Getter/setter pattern provides a clear API and control point
```

---

## Non-Exhaustive Switch Statements

### Missing `never` Check

```typescript
// WRONG: New status added to enum, but code doesn't handle it
type OrderStatus = "pending" | "completed" | "failed";

function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "yellow";
    case "completed":
      return "green";
    default:
      return "gray";  // Silent fallthrough when new status added
  }
}

// CORRECT: Use never type to catch missing cases
function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "yellow";
    case "completed":
      return "green";
    case "failed":
      return "red";
    default:
      const exhaustive: never = status;  // Error if case missing
      return exhaustive;
  }
}

// Why it matters:
// TypeScript will error if a new case is added but not handled
// Prevents silent bugs when enums change
```

---

## Floating Promises

### Unhandled Async Operations

```typescript
// WRONG: Promise result ignored, errors swallowed
function handleSave() {
  this.api.post("/data", data);  // Not awaited!
  console.log("Saved");  // Logs before save completes
}

// WRONG: Event handler with unhandled promise
button.addEventListener("click", async () => {
  await fetch("/api/action");  // Errors not handled, button doesn't show loading
});

// CORRECT: Awaited with error handling
async function handleSave() {
  try {
    await this.api.post("/data", data);
    toast.success("Saved");
  } catch (error) {
    toast.error("Save failed");
  }
}

// CORRECT: Fire-and-forget explicitly marked
async function trackEvent() {
  void this.analytics.track("event");  // Intentionally unawaited
}

// Why it matters:
// Floating promises hide errors and break timing guarantees
// Explicit 'void' shows fire-and-forget is intentional
```

---

## Enum Gotchas

### Using String Enums Instead of Const Objects

```typescript
// WRONG: Enum generates runtime code, not tree-shakeable
enum Role {
  Admin = "admin",
  User = "user",
}

const userRole: Role = Role.Admin;

// CORRECT: Const object with 'as const' for type inference
const ROLES = {
  Admin: "admin",
  User: "user",
} as const;

type Role = (typeof ROLES)[keyof typeof ROLES];
const userRole: Role = ROLES.Admin;

// Why it matters:
// Enums can be tree-shaken away, reducing bundle size
// const objects work identically with better performance
```

---

## Class Property Issues

### Accessing Uninitialized Properties

```typescript
// WRONG: Property might be undefined but typed as required
class OrderService {
  private cache: Map<string, Order>;  // Error or undefined at runtime

  get(id: string): Order {
    return this.cache.get(id);  // Could be undefined!
  }
}

// CORRECT: Initialize in constructor or mark as optional
class OrderService {
  private cache: Map<string, Order>;

  constructor() {
    this.cache = new Map();  // Initialize
  }

  get(id: string): Order | undefined {
    return this.cache.get(id);  // Return type is correct
  }
}

// Why it matters:
// Property initialization order matters in TypeScript classes
// Uninitialized properties cause runtime errors
```

---

## Async Function Return Types

### Implicit Promise Return

```typescript
// WRONG: Forgot to mark as async, doesn't compile as expected
function fetchUser(id: string) {  // Returns Promise<unknown> implicitly
  return await userService.getById(id);  // Error: await in non-async
}

// CORRECT: Mark as async or return Promise explicitly
async function fetchUser(id: string): Promise<User> {
  return await userService.getById(id);
}

// Or return Promise directly
function fetchUser(id: string): Promise<User> {
  return userService.getById(id);
}

// Why it matters:
// Missing async keyword causes compilation errors
// Explicit return type prevents type inference surprises
```

---

## Object Spread Issues

### Spreading with Optional Properties

```typescript
// WRONG: Optional properties not narrowed properly
interface Config {
  timeout?: number | undefined;
  retries?: number | undefined;
}

const defaultConfig: Config = { timeout: 5000, retries: 3 };
const userConfig: Config = { timeout: 10000 };
const merged = { ...defaultConfig, ...userConfig };

// merged.retries could be undefined even though defaultConfig has it
const actualRetries: number = merged.retries;  // Error: possibly undefined

// CORRECT: Explicit defaults with nullish coalescing
const actualTimeout = merged.timeout ?? 5000;
const actualRetries = merged.retries ?? 3;

// Or use Object.assign with explicit type
const merged: Config = Object.assign({}, defaultConfig, userConfig);

// Why it matters:
// Spreading doesn't preserve required properties from defaults
// You must explicitly handle undefined values
```

---

## Before Commit Checklist

1. **tsc --noEmit** - No type errors
2. **No `any` types** - Grep for `: any`
3. **Type imports use `import type`** - Verify syntax
4. **All optional properties have `| undefined`** - Check interfaces
5. **Index signature access uses brackets** - No dot notation
6. **All `as` casts have comments** - Explain why
7. **No floating promises** - All awaited or void-marked
8. **Biome formatting** - `npx @biomejs/biome check --write`
