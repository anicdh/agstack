# React Gotchas

Common React mistakes and how to avoid them.

---

## useEffect for Derived State

### Problem: Extra Render + Stale State

```typescript
// WRONG: useEffect for derived state
function OrderList({ orders, filter }: { orders: Order[]; filter: string }) {
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);

  useEffect(() => {
    setFilteredOrders(orders.filter((o) => o.status === filter));
  }, [orders, filter]);

  // 🐛 Bug: filteredOrders is stale until effect runs (extra render)
  return <div>{filteredOrders.length} orders</div>;
}

// CORRECT: useMemo for derived state
function OrderList({ orders, filter }: { orders: Order[]; filter: string }) {
  const filteredOrders = useMemo(
    () => orders.filter((o) => o.status === filter),
    [orders, filter]
  );

  // ✅ filteredOrders is always in sync, computed during render
  return <div>{filteredOrders.length} orders</div>;
}
```

---

## Fetching Data in useEffect

### Problem: Race Conditions, No Error Handling, Duplicate Requests

```typescript
// WRONG: useEffect for data fetching
function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/orders")
      .then((data) => {
        setOrders(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // 🐛 Bugs: manual loading/error state, race conditions, duplicates in StrictMode
  return <div>{loading ? "..." : orders.length} orders</div>;
}

// CORRECT: React Query
function OrderList() {
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders"),
  });

  // ✅ Handles loading, error, caching, deduplication automatically
  return <div>{isLoading ? "..." : orders.length} orders</div>;
}
```

---

## useState for Server Data

### Problem: Cache Misses, Manual Sync, Stale Data

```typescript
// WRONG: useState for API data
function OrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then((data) => setOrder(data));
  }, [orderId]);

  // 🐛 Bugs: no deduplication, stale data, no automatic refetch
  return <div>{order?.total}</div>;
}

// CORRECT: React Query
function OrderDetail({ orderId }: { orderId: string }) {
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => api.get(`/orders/${orderId}`),
  });

  // ✅ Dedupled, cached, synced across tabs
  return <div>{order?.total}</div>;
}
```

---

## Missing invalidateQueries After Mutation

### Problem: Stale Data, User Confusion, Manual Refetch

```typescript
// WRONG: Mutation without cache invalidation
function CreateOrderButton() {
  const { mutate: createOrder } = useMutation({
    mutationFn: (data: CreateOrderDto) => api.post("/orders", data),
    onSuccess: () => {
      toast.success("Order created");
      // 🐛 Bug: Orders list still shows old data!
    },
  });

  return <Button onClick={() => createOrder(data)}>Create</Button>;
}

// CORRECT: Mutation with cache invalidation + toast
function CreateOrderButton() {
  const queryClient = useQueryClient();

  const { mutate: createOrder } = useMutation({
    mutationFn: (data: CreateOrderDto) => api.post("/orders", data),
    onSuccess: () => {
      toast.success("Order created");
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.all,  // ✅ Refetch list
      });
    },
    onError: (error) => {
      toast.error(error.message);  // ✅ Error feedback
    },
  });

  return <Button onClick={() => createOrder(data)}>Create</Button>;
}
```

---

## Missing Loading/Error States

### Problem: Silent Failures, Poor UX

```typescript
// WRONG: No feedback while loading
function OrderList() {
  const { data: orders } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders"),
  });

  // 🐛 Bug: Blank screen while loading, no error message
  return <div>{orders?.map((o) => <OrderCard key={o.id} order={o} />)}</div>;
}

// CORRECT: Handle all states
function OrderList() {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders"),
  });

  if (isLoading) return <Skeleton className="h-32" />;
  if (error) return <Alert variant="destructive">Error: {error.message}</Alert>;
  if (!orders?.length) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="mx-auto h-12 w-12 mb-4" />
        <p>No orders yet</p>
        <Button>Create One</Button>
      </div>
    );
  }

  // ✅ All states handled
  return <div>{orders.map((o) => <OrderCard key={o.id} order={o} />)}</div>;
}
```

---

## Props Drilling

### Problem: Tight Coupling, Brittle Refactoring

```typescript
// WRONG: Props drilled through 4 levels
function OrderPage({ orderId }: { orderId: string }) {
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => api.get(`/orders/${orderId}`),
  });

  return <OrderDetail order={order} />;
}

function OrderDetail({ order }: { order: Order }) {
  return <OrderContent order={order} />;
}

function OrderContent({ order }: { order: Order }) {
  return <OrderHeader order={order} />;
}

function OrderHeader({ order }: { order: Order }) {
  // 🐛 Bug: order drilled through 4 levels!
  return <h1>{order.id}</h1>;
}

// CORRECT: Extract custom hook
function useCurrentOrder(orderId: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => api.get(`/orders/${orderId}`),
  });
}

function OrderPage({ orderId }: { orderId: string }) {
  return <OrderDetail orderId={orderId} />;
}

function OrderDetail({ orderId }: { orderId: string }) {
  return <OrderContent orderId={orderId} />;
}

function OrderContent({ orderId }: { orderId: string }) {
  return <OrderHeader orderId={orderId} />;
}

function OrderHeader({ orderId }: { orderId: string }) {
  // ✅ Each component gets what it needs
  const { data: order } = useCurrentOrder(orderId);
  return <h1>{order?.id}</h1>;
}
```

---

## Inline Objects/Arrays in JSX

### Problem: New Object Every Render = Unnecessary Re-renders

```typescript
// WRONG: Inline object in JSX
function OrderList() {
  const { data: orders } = useQuery({
    queryKey: queryKeys.orders.all,  // ❌ New array every render!
    queryFn: () => api.get("/orders"),
  });

  // 🐛 Bug: queryKey changes every render, query re-fetches!
  return <div>{orders?.length} orders</div>;
}

// CORRECT: Extract to constant
const ORDER_QUERY_KEY = queryKeys.orders.all;

function OrderList() {
  const { data: orders } = useQuery({
    queryKey: ORDER_QUERY_KEY,  // ✅ Same reference
    queryFn: () => api.get("/orders"),
  });

  return <div>{orders?.length} orders</div>;
}

// OR use the queryKeys factory (preferred)
function OrderList() {
  const { data: orders } = useQuery({
    queryKey: queryKeys.orders.all,  // Factory creates stable key
    queryFn: () => api.get("/orders"),
  });

  return <div>{orders?.length} orders</div>;
}
```

---

## Missing Key Prop or Using Index as Key

### Problem: Lost State, Reordered Items Bug

```typescript
// WRONG: No key prop
function OrderList({ orders }: { orders: Order[] }) {
  // 🐛 Bug: Reordering items breaks component state
  return <div>{orders.map((order) => <OrderCard order={order} />)}</div>;
}

// WRONG: Using index as key
function OrderList({ orders }: { orders: Order[] }) {
  // 🐛 Bug: Index changes when list reorders, state gets mixed up
  return (
    <div>
      {orders.map((order, index) => (
        <OrderCard key={index} order={order} />
      ))}
    </div>
  );
}

// CORRECT: Use unique stable identifier
function OrderList({ orders }: { orders: Order[] }) {
  // ✅ React can track identity even if list reorders
  return (
    <div>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

---

## Missing Empty State for Lists

### Problem: Confusing UX, User Thinks Data Didn't Load

```typescript
// WRONG: No empty state
function OrderList() {
  const { data: orders = [] } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders"),
  });

  // 🐛 Bug: User sees blank screen, doesn't know why
  return (
    <div>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

// CORRECT: Handle empty state with icon + message + CTA
function OrderList() {
  const { data: orders = [] } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders"),
  });

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No orders found</h3>
        <p className="text-muted-foreground mb-4">
          Get started by creating your first order.
        </p>
        <Button onClick={() => navigate("/orders/new")}>
          Create Order
        </Button>
      </div>
    );
  }

  // ✅ Helpful and actionable
  return (
    <div>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

---

## Raw HTML Elements Instead of Shadcn

### Problem: Inconsistent Styling, Missing Accessibility, Dark Mode Issues

```typescript
// WRONG: Raw HTML elements
function OrderForm() {
  return (
    <form>
      <label htmlFor="product">Product</label>
      <input id="product" type="text" placeholder="Select product..." />

      <button type="submit">Create Order</button>
      <button type="button">Cancel</button>

      <select>
        <option>Pending</option>
        <option>Shipped</option>
      </select>
    </form>
  );
}

// 🐛 Bugs: No consistent styling, accessibility issues, dark mode broken

// CORRECT: Use Shadcn components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function OrderForm() {
  return (
    <form>
      <FormField
        name="product"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Product</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Select product..." />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="flex gap-2">
        <Button type="submit">Create Order</Button>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </div>

      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="shipped">Shipped</SelectItem>
        </SelectContent>
      </Select>
    </form>
  );
}

// ✅ Consistent styling, accessible, dark mode works
```

---

## Buttons Overlapping on Mobile

### Problem: Unclickable Buttons, Poor Mobile UX

```typescript
// WRONG: Buttons can overlap
function ActionBar() {
  return (
    <div className="flex gap-2">
      <Button className="w-32">Save Order</Button>
      <Button variant="outline" className="w-32">
        Cancel
      </Button>
      <Button variant="ghost" className="w-32">
        Delete
      </Button>
    </div>
  );
}

// 🐛 Bug: Buttons wrap awkwardly, overlap on small screens

// CORRECT: Use flex-wrap + gap
function ActionBar() {
  return (
    <div className="flex gap-2 flex-wrap">
      <Button>Save Order</Button>
      <Button variant="outline">Cancel</Button>
      <Button variant="ghost">Delete</Button>
    </div>
  );
}

// ✅ Buttons wrap properly on mobile
```

---

## Hardcoded String Query Keys

### Problem: Query Keys Out of Sync, Duplicate Fetches

```typescript
// WRONG: Hardcoded string keys
function OrderListComponent() {
  const { data: orders } = useQuery({
    queryKey: ["orders"],  // 🐛 Easy to typo or get out of sync
    queryFn: () => api.get("/orders"),
  });

  return <div>{orders?.length}</div>;
}

function OrderDetailComponent({ orderId }: { orderId: string }) {
  const { data: order } = useQuery({
    queryKey: ["order", orderId],  // 🐛 Different format than above!
    queryFn: () => api.get(`/orders/${orderId}`),
  });

  return <div>{order?.id}</div>;
}

// CORRECT: Use queryKeys factory
function OrderListComponent() {
  const { data: orders } = useQuery({
    queryKey: queryKeys.orders.all,  // ✅ Single source of truth
    queryFn: () => api.get("/orders"),
  });

  return <div>{orders?.length}</div>;
}

function OrderDetailComponent({ orderId }: { orderId: string }) {
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(orderId),  // ✅ Consistent format
    queryFn: () => api.get(`/orders/${orderId}`),
  });

  return <div>{order?.id}</div>;
}
```

---

## Context Provider for Frequently-Changing Global State

### Problem: All Consumers Re-render on Every State Change

```typescript
// WRONG: Single context for multiple unrelated values
interface AppState {
  user: User | null;
  theme: "light" | "dark";
  sidebarOpen: boolean;
  notificationCount: number;
}

const AppContext = createContext<AppState>(/* ... */);

function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  return (
    <AppContext.Provider value={state}>
      {children}
    </AppContext.Provider>
  );
}

// 🐛 Bug: ThemeToggle only reads `theme`, but re-renders when
// sidebarOpen, notificationCount, or user changes too!
function ThemeToggle() {
  const { theme } = useContext(AppContext);
  return <Button>{theme}</Button>;
}

// 🐛 Bug: NotificationBadge updates every time sidebar opens/closes
function NotificationBadge() {
  const { notificationCount } = useContext(AppContext);
  return <Badge>{notificationCount}</Badge>;
}
```

```typescript
// CORRECT: Use Zustand with selectors for frequently-changing multi-consumer state
const useAppStore = create<AppState>((set) => ({
  user: null,
  theme: "light",
  sidebarOpen: false,
  notificationCount: 0,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));

// ✅ Only re-renders when `theme` changes
function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return <Button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme}</Button>;
}

// ✅ Only re-renders when `notificationCount` changes
function NotificationBadge() {
  const count = useAppStore((s) => s.notificationCount);
  return <Badge>{count}</Badge>;
}
```

```typescript
// ALSO CORRECT: Context is fine for rarely-changing values like DI or compound components
// DI — ApiClient instance created once, never changes
const ApiContext = createContext<ApiClient | null>(null);

function useApiClient() {
  const client = useContext(ApiContext);
  if (!client) throw new Error("ApiContext not found");
  return client;
}

// Compound component — context scoped to subtree, not global
const AccordionContext = createContext<{ openItem: string | null }>({ openItem: null });

function Accordion({ children }: { children: ReactNode }) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  return (
    <AccordionContext.Provider value={{ openItem, setOpenItem }}>
      {children}
    </AccordionContext.Provider>
  );
}
```

**Rule of thumb:** If >5 components consume the state AND it changes more than once per user session → Zustand. If it's dependency injection, library wiring, or compound component communication → Context Provider.

---

## Checklist Before Code Review

1. **useEffect**: Only for side effects, not derived state (use useMemo)?
2. **Data fetching**: Always React Query, never useEffect + useState?
3. **Server data**: React Query, never useState?
4. **Mutations**: Toast success + error + invalidateQueries?
5. **Loading states**: Shown while async operations pending?
6. **Error states**: Shown with helpful message?
7. **Empty states**: Icon + message + CTA?
8. **Key prop**: Using unique identifier, not index?
9. **Shadcn**: All interactive elements use Shadcn, no raw HTML?
10. **Action buttons**: `flex gap-2 flex-wrap` to prevent overlap?
11. **Query keys**: Using queryKeys factory, not hardcoded strings?
12. **Props drilling**: Extracted to custom hook if >2 levels?
13. **State management**: Context for DI/compound, Zustand for global, React Query for server?
