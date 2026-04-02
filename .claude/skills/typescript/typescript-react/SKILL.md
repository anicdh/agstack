---
name: typescript-react
description: >
  Call this skill when building or modifying React frontend code: components, hooks,
  pages, state management, forms, or routing. Covers React 18 patterns, React Query
  for server state, Zustand for client state, form handling with react-hook-form + Zod,
  and component design patterns with Shadcn/ui.
invocation: auto
---

# React 18 + TypeScript Development Patterns

This skill covers React-specific patterns for the frontend stack:
- React 18 + TypeScript + Vite
- TailwindCSS + Shadcn/ui for components
- React Query (TanStack Query) for server state
- Zustand for client state
- react-hook-form + Zod for forms
- React Router v6 for routing

## Before Writing Any React Code

1. Read `typescript/SKILL.md` — TypeScript strict mode rules apply to all `.tsx` files
2. Read `frontend-ui/SKILL.md` — Tailwind and Shadcn/ui conventions
3. Read `docs/ux-guide.md` — UX principles and mandatory patterns
4. Check the Reuse Map in CLAUDE.md — use existing shared hooks and utilities

---

## Component Structure

### Feature-Based Organization

```
src/features/[name]/
├── components/        # UI components for this feature
│   ├── feature-card.tsx
│   ├── feature-list.tsx
│   └── feature-form.tsx
├── hooks/            # Custom hooks for this feature
│   ├── use-feature-actions.ts
│   └── use-feature-filters.ts
├── queries/          # React Query hooks (data fetching)
│   └── use-features.ts
├── stores/           # Zustand stores for this feature
│   └── feature-store.ts
├── types/            # Feature-local types
│   └── index.ts
└── index.ts          # Public API (exports)
```

### Component File Naming

- **Components**: kebab-case (e.g., `order-card.tsx`, `product-list.tsx`)
- **Hooks**: kebab-case starting with `use-` (e.g., `use-order-filters.ts`)
- **Stores**: kebab-case (e.g., `auth-store.ts`, `ui-store.ts`)

### Component Pattern

```typescript
// ✅ CORRECT — separated interface, destructured props, optional props include | undefined
interface OrderCardProps {
  order: Order;
  onCancel: (id: string) => void;
  isLoading?: boolean | undefined;
}

function OrderCard({ order, onCancel, isLoading }: OrderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{order.id}</CardTitle>
      </CardHeader>
      <CardContent>{order.total}</CardContent>
      <CardFooter>
        <Button onClick={() => onCancel(order.id)} disabled={isLoading}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

export default OrderCard;  // Pages use default export
export { OrderCard };      // Components use named export
```

### Props Rules

- **Separate interface**: Always define props in a separate `PropsInterface`
- **Destructure**: Always destructure props in function signature
- **Optional props**: Must include `| undefined` (TypeScript `exactOptionalPropertyTypes`)
- **Don't use `any`**: Explicit types only
- **Keep props small**: >5 props = consider composition or context

---

## State Management Decision Table

| Need | Use | NOT |
|------|-----|-----|
| **Server data** (API responses, user lists) | React Query (`useQuery`) | useState + useEffect |
| **Server mutations** (create, update, delete) | React Query (`useMutation`) | useState + useEffect |
| **UI state** (modal open, sidebar collapsed) | useState or Zustand | React Query |
| **Form state** (input values, touched) | react-hook-form | useState |
| **Global client state** (auth session, theme) | Zustand | Context API |
| **URL state** (filters, pagination, sort) | React Router searchParams | useState |
| **Dependency injection** (services, config) | Context Provider | Zustand / props |
| **Compound component** (Tabs, Accordion) | Context Provider | Zustand / props drilling |
| **Library wiring** (QueryClient, Theme) | Context Provider | — |

### Decision Flowchart

```
Need to manage state?
├── Is it data from the server?
│   └── YES → React Query (useQuery/useMutation)
│
├── Is it dependency injection or library wiring?
│   └── YES → Context Provider (rarely changes, no re-render concern)
│
├── Is it compound component communication? (parent ↔ children)
│   └── YES → Context Provider (scoped to component subtree)
│
├── Is it global client state? (auth, theme, sidebar)
│   ├── Changes frequently + many consumers → Zustand (selector-based, no re-render)
│   └── Changes rarely + few consumers → Context Provider is OK
│
├── Is it form input?
│   └── YES → react-hook-form
│
├── Is it URL state? (filters, pagination)
│   └── YES → React Router searchParams
│
├── Is it local UI state? (modal open, toggle)
│   └── YES → useState
│
└── None of the above → props / composition
```

### Context Provider vs Zustand — When to Use Which

**Use Context Provider when:**

```typescript
// 1. DEPENDENCY INJECTION — providing services/config down the tree
//    Value rarely changes, context exists to avoid prop drilling of "infrastructure"
const ApiClientContext = createContext<ApiClient | null>(null);

function ApiClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new ApiClient(config), [config]);
  return (
    <ApiClientContext.Provider value={client}>
      {children}
    </ApiClientContext.Provider>
  );
}

// 2. COMPOUND COMPONENTS — parent-child coordination
//    Context scoped to a component subtree, not global
const TabsContext = createContext<TabsState | null>(null);

function Tabs({ value, onValueChange, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div role="tablist">{children}</div>
    </TabsContext.Provider>
  );
}

function Tab({ value, children }: TabProps) {
  const ctx = useContext(TabsContext);  // Reads from nearest parent Tabs
  return (
    <button
      role="tab"
      aria-selected={ctx?.value === value}
      onClick={() => ctx?.onValueChange(value)}
    >
      {children}
    </button>
  );
}

// 3. LIBRARY WIRING — required by third-party libraries
//    QueryClientProvider, ThemeProvider, FormProvider, etc.
<QueryClientProvider client={queryClient}>
  <ThemeProvider defaultTheme="light">
    <App />
  </ThemeProvider>
</QueryClientProvider>

// 4. RARELY-CHANGING GLOBAL STATE — theme, locale, feature flags
//    If it changes <1 time per session, re-renders are not a concern
const FeatureFlagContext = createContext<FeatureFlags>(defaultFlags);
```

**Use Zustand when:**

```typescript
// 1. FREQUENTLY CHANGING STATE — auth, UI preferences, notifications
//    Zustand selectors prevent unnecessary re-renders
const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (creds) => { /* ... */ },
  logout: () => set({ user: null, token: null }),
}));

// Only re-renders when `user` changes, not when `token` changes
const user = useAuthStore((state) => state.user);

// 2. MULTIPLE CONSUMERS across different features
//    Context would cause re-renders in ALL consumers when ANY value changes
// ❌ Context: ALL consumers re-render when sidebar OR modal OR theme changes
const UIContext = createContext({ sidebar: false, modal: null, theme: "light" });

// ✅ Zustand: each consumer only re-renders for the value it selects
const useSidebar = () => useUIStore((s) => s.sidebarOpen);
const useModal = () => useUIStore((s) => s.activeModal);

// 3. STATE WITH COMPLEX ACTIONS — computed values, middleware
const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  total: () => get().items.reduce((sum, i) => sum + i.price, 0),
}));
```

### The Re-render Problem with Context

```typescript
// ❌ WRONG — Context re-renders ALL consumers when ANY property changes
const AppContext = createContext({
  user: null,        // changes on login
  theme: "light",    // changes rarely
  sidebarOpen: false // changes often
});

// Component that only needs theme still re-renders when sidebarOpen changes!
function ThemeDisplay() {
  const { theme } = useContext(AppContext);  // Re-renders on EVERY context change
  return <div>{theme}</div>;
}

// ✅ CORRECT — Split into separate contexts OR use Zustand
// Option A: Separate contexts (OK for 2-3 domains)
<UserProvider>
  <ThemeProvider>
    <UIProvider>
      <App />
    </UIProvider>
  </ThemeProvider>
</UserProvider>

// Option B: Zustand with selectors (better for 3+ domains)
const useTheme = () => useAppStore((s) => s.theme);      // Only re-renders on theme change
const useSidebar = () => useAppStore((s) => s.sidebarOpen); // Only re-renders on sidebar change
```

### Quick Reference: Provider vs Zustand

| Criterion | Context Provider | Zustand |
|-----------|-----------------|---------|
| **Update frequency** | Rarely (config, DI, theme) | Often (UI state, auth) |
| **Consumer count** | Few (<5 components) | Many (across features) |
| **Re-render control** | No selector — all consumers re-render | Selector-based — granular |
| **Scope** | Subtree (compound components) | Global (any component) |
| **DevTools** | React DevTools | Zustand DevTools middleware |
| **SSR** | Built-in support | Needs hydration handling |
| **Boilerplate** | createContext + Provider + useContext | create() + use hook |
| **Testing** | Wrap in Provider | No wrapper needed |

---

## React Query Patterns

### Query Keys Factory

**Always use the query keys factory** from `@/lib/query-keys.ts`. Never hardcode string keys.

```typescript
// ✅ CORRECT — use query keys factory
import { queryKeys } from "@/lib/query-keys";

const { data: orders } = useQuery({
  queryKey: queryKeys.orders.all,
  queryFn: () => api.get("/orders"),
});

const { data: order } = useQuery({
  queryKey: queryKeys.orders.detail(orderId),
  queryFn: () => api.get(`/orders/${orderId}`),
});

// ❌ WRONG — hardcoded string keys
const { data: orders } = useQuery({
  queryKey: ["orders"],  // Easy to get out of sync
  queryFn: () => api.get("/orders"),
});
```

### Reads with useQuery

```typescript
// ✅ CORRECT — fetch orders with loading, error, and data
function OrderList() {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders"),
  });

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!orders?.length) return <div>No orders found</div>;

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

### Writes with useMutation + Invalidation

```typescript
// ✅ CORRECT — mutation with success/error toast + cache invalidation
function CreateOrderButton() {
  const queryClient = useQueryClient();

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: (data: CreateOrderDto) => api.post("/orders", data),
    onSuccess: (newOrder) => {
      // 1. Toast success
      toast.success(`Order ${newOrder.id} created`);

      // 2. Invalidate queries to refetch
      await queryClient.invalidateQueries({
        queryKey: queryKeys.orders.all,
      });

      // 3. Optional: add to cache directly
      queryClient.setQueryData(
        queryKeys.orders.detail(newOrder.id),
        newOrder
      );
    },
    onError: (error) => {
      // Toast error (check @/hooks/use-api-mutation for shared pattern)
      toast.error(error.message || "Failed to create order");
    },
  });

  return (
    <Button
      onClick={() => createOrder({ /* ... */ })}
      disabled={isPending}
    >
      {isPending ? "Creating..." : "Create Order"}
    </Button>
  );
}

// ❌ WRONG — no toast, no cache invalidation
const handleCreate = async () => {
  const result = await api.post("/orders", data);  // No feedback!
};
```

### Pagination Pattern

```typescript
// ✅ CORRECT — use the usePaginatedQuery hook
import { usePaginatedQuery } from "@/hooks/use-paginated-query";

function OrdersList() {
  const { data, page, setPage, isPending } = usePaginatedQuery({
    queryKey: queryKeys.orders.paginated,
    queryFn: (page, limit) => api.get("/orders", { params: { page, limit } }),
  });

  return (
    <>
      <OrderListTable orders={data.orders} />
      <Pagination
        page={page}
        onPageChange={setPage}
        total={data.meta.total}
      />
    </>
  );
}
```

### Optimistic Updates

```typescript
// ✅ CORRECT — update cache immediately, revert on error
const { mutate: updateOrder } = useMutation({
  mutationFn: (data: UpdateOrderDto) =>
    api.patch(`/orders/${data.id}`, data),
  onMutate: (newData) => {
    // Save old data for rollback
    const previousOrders = queryClient.getQueryData(
      queryKeys.orders.all
    );

    // Update cache immediately
    queryClient.setQueryData(queryKeys.orders.all, (old: Order[]) =>
      old.map((o) => (o.id === newData.id ? { ...o, ...newData } : o))
    );

    return { previousOrders };  // For rollback
  },
  onError: (_error, _newData, context) => {
    // Rollback on error
    if (context?.previousOrders) {
      queryClient.setQueryData(
        queryKeys.orders.all,
        context.previousOrders
      );
    }
    toast.error("Failed to update order");
  },
  onSuccess: () => {
    toast.success("Order updated");
  },
});
```

---

## Zustand Patterns

### Store Creation

```typescript
// ✅ CORRECT — single store per domain, typed, with selectors
import { create } from "zustand";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginDto) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (credentials) => {
    const user = await api.post("/auth/login", credentials);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));

// ✅ CORRECT — use selectors to prevent unnecessary re-renders
function AuthButton() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <Button onClick={logout}>
      Logout {user?.name}
    </Button>
  );
}

// ❌ WRONG — subscribe to entire store, re-renders on any change
function AuthButton() {
  const { user, logout } = useAuthStore();  // Re-renders when user, or any other state, changes
  // ...
}
```

### Store Rules

- **One store per domain**: Not one giant store
- **Keep stores small**: <50 lines of state + actions
- **Use selectors**: Always access with `(state) => state.field`
- **Avoid storing derived state**: Compute from other state
- **No async in store**: Async goes in components/hooks

---

## Form Patterns

### Schema + useForm + zodResolver

```typescript
// 1. Define Zod schema (often in @/lib/form-utils.ts or feature/types)
import { z } from "zod";

export const CreateOrderSchema = z.object({
  productId: z.string().uuid("Invalid product"),
  quantity: z.number().int().positive("Quantity must be positive"),
  notes: z.string().max(500, "Notes too long").optional(),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

// 2. Use in form with zodResolver
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

function CreateOrderForm() {
  const form = useForm<CreateOrderDto>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: {
      productId: "",
      quantity: 1,
      notes: "",
    },
  });

  const { mutate: createOrder, isPending } = useMutation({
    mutationFn: (data: CreateOrderDto) => api.post("/orders", data),
    onSuccess: () => {
      toast.success("Order created");
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: CreateOrderDto) => {
    createOrder(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        control={form.control}
        name="productId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Product</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Select product..." />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="quantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Quantity</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Order"}
      </Button>
    </form>
  );
}

// ❌ WRONG — manual validation, no Zod, validation logic scattered
function CreateOrderForm() {
  const [productId, setProductId] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!productId) {
      setError("Product required");
      return;
    }
    // ... manual validation ...
  };
}
```

### Form + Mutation Integration

```typescript
// ✅ CORRECT — single mutation hook handling form + toast
import { useApiMutation } from "@/hooks/use-api-mutation";

function EditOrderForm({ orderId }: { orderId: string }) {
  const form = useForm<UpdateOrderDto>({
    resolver: zodResolver(UpdateOrderSchema),
  });

  const { mutate: updateOrder } = useApiMutation({
    mutationFn: (data: UpdateOrderDto) =>
      api.patch(`/orders/${orderId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => updateOrder(data))}>
      {/* form fields */}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Save
      </Button>
    </form>
  );
}
```

---

## Hooks Rules

### useMemo for Derived State (NOT useEffect)

```typescript
// ✅ CORRECT — derive state with useMemo
function OrderList({ orders, filter }: { orders: Order[]; filter: string }) {
  const filteredOrders = useMemo(
    () => orders.filter((o) => o.status === filter),
    [orders, filter]
  );

  return <div>{filteredOrders.length} orders</div>;
}

// ❌ WRONG — useEffect for derived state
function OrderList({ orders, filter }: { orders: Order[]; filter: string }) {
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);

  useEffect(() => {
    setFilteredOrders(orders.filter((o) => o.status === filter));
  }, [orders, filter]);  // Extra render! State can be stale!

  return <div>{filteredOrders.length} orders</div>;
}
```

### useCallback for Stable Function References

```typescript
// ✅ CORRECT — useCallback when passing function to child
function OrderList({ orders }: { orders: Order[] }) {
  const handleCancel = useCallback((id: string) => {
    api.patch(`/orders/${id}/cancel`);
  }, []);

  return (
    <div>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onCancel={handleCancel}  // Stable reference
        />
      ))}
    </div>
  );
}

// ❌ WRONG — inline function creates new reference each render
function OrderList({ orders }: { orders: Order[] }) {
  return (
    <div>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onCancel={(id) => api.patch(`/orders/${id}/cancel`)}  // New function each render!
        />
      ))}
    </div>
  );
}
```

### Never Fetch in useEffect

```typescript
// ✅ CORRECT — use React Query
const { data: orders } = useQuery({
  queryKey: queryKeys.orders.all,
  queryFn: () => api.get("/orders"),
});

// ❌ WRONG — useEffect for data fetching
const [orders, setOrders] = useState<Order[]>([]);
useEffect(() => {
  api.get("/orders").then((data) => setOrders(data));
}, []);  // No error handling, no loading state, duplicate requests
```

### Custom Hooks Pattern

```typescript
// ✅ CORRECT — extract reusable logic into custom hook
function useOrderActions(orderId: string) {
  const queryClient = useQueryClient();

  const cancel = useMutation({
    mutationFn: () => api.patch(`/orders/${orderId}/cancel`),
    onSuccess: () => {
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const archive = useMutation({
    mutationFn: () => api.patch(`/orders/${orderId}/archive`),
    onSuccess: () => {
      toast.success("Order archived");
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });

  return { cancel, archive };
}

// Use in multiple components
function OrderCard({ order }: { order: Order }) {
  const { cancel, archive } = useOrderActions(order.id);

  return (
    <Card>
      <Button onClick={() => cancel.mutate()}>Cancel</Button>
      <Button onClick={() => archive.mutate()}>Archive</Button>
    </Card>
  );
}
```

---

## Mandatory UX Patterns (from docs/ux-guide.md)

### 1. Every Mutation → Toast + Invalidation

```typescript
const { mutate } = useMutation({
  mutationFn: (data) => api.post("/orders", data),
  onSuccess: () => {
    toast.success("Order created");  // ✅ Success toast
    queryClient.invalidateQueries({  // ✅ Invalidate cache
      queryKey: queryKeys.orders.all,
    });
  },
  onError: (error) => {
    toast.error(error.message);       // ✅ Error toast
  },
});
```

### 2. Every Action Bar → `flex gap-2 flex-wrap`

```typescript
// ✅ CORRECT — prevents button overlap on mobile
<div className="flex gap-2 flex-wrap">
  <Button>Save</Button>
  <Button variant="outline">Cancel</Button>
  <Button variant="ghost">Delete</Button>
</div>

// ❌ WRONG — buttons can overlap
<div className="flex gap-2">
  <Button>Save</Button>
  <Button>Cancel</Button>
  <Button>Delete</Button>
</div>
```

### 3. Every Async Action → Loading Spinner + Disabled State

```typescript
// ✅ CORRECT — button shows loading state while pending
const { mutate, isPending } = useMutation({ /* ... */ });

<Button onClick={() => mutate(data)} disabled={isPending}>
  {isPending ? (
    <>
      <Spinner className="mr-2 h-4 w-4 animate-spin" />
      Saving...
    </>
  ) : (
    "Save"
  )}
</Button>

// ❌ WRONG — no feedback while async action is pending
<Button onClick={() => mutate(data)}>
  Save
</Button>
```

### 4. Every List/Table → Empty State with Icon + Message + CTA

```typescript
// ✅ CORRECT — empty state shows message and action
function OrderList() {
  const { data: orders } = useQuery({ /* ... */ });

  if (!orders?.length) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No orders yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first order to get started.
        </p>
        <Button onClick={() => navigate("/orders/new")}>
          Create Order
        </Button>
      </div>
    );
  }

  return <OrderTable orders={orders} />;
}

// ❌ WRONG — just shows empty space
function OrderList() {
  const { data: orders } = useQuery({ /* ... */ });
  return <OrderTable orders={orders ?? []} />;
}
```

### 5. Every Table → `overflow-x-auto` Wrapper for Mobile

```typescript
// ✅ CORRECT — table scrolls on mobile
<div className="overflow-x-auto">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Order ID</TableHead>
        <TableHead>Date</TableHead>
        <TableHead>Total</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {orders.map((order) => (
        <TableRow key={order.id}>
          <TableCell>{order.id}</TableCell>
          <TableCell>{order.date}</TableCell>
          <TableCell>{order.total}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>

// ❌ WRONG — table overflows page on mobile
<Table>
  {/* ... */}
</Table>
```

---

## Review Checklist

Before submitting a React feature for review:

### Code Quality

- [ ] No business logic in components (extract to hooks)?
- [ ] React Query used for server state, not useState?
- [ ] Forms use Zod schema + react-hook-form?
- [ ] Mutations have toast success + toast error?
- [ ] Cache invalidation after mutation?
- [ ] No useEffect for derived state (use useMemo)?
- [ ] No useEffect for data fetching (use React Query)?
- [ ] Custom hook for reusable logic?

### UX Compliance

- [ ] Loading state shown for async operations?
- [ ] Error state shown with helpful message?
- [ ] Empty state for lists with CTA?
- [ ] Table has overflow-x-auto for mobile?
- [ ] Action buttons wrapped in `flex gap-2 flex-wrap`?
- [ ] Disabled state while loading?
- [ ] No hardcoded HTML (`<button>`, `<input>`, `<select>`) — all Shadcn?

### TypeScript

- [ ] No `any` types?
- [ ] No untyped `as` casts?
- [ ] Optional props include `| undefined`?
- [ ] Props extracted to separate interface?
- [ ] No unused imports or variables?

### Accessibility

- [ ] Buttons have descriptive text (not just icons)?
- [ ] Form inputs have associated labels?
- [ ] Error messages linked to form fields?
- [ ] Keyboard navigation works (Tab, Enter)?
- [ ] Color not sole indicator (use icons + text)?
