# TypeScript Async Gotchas

Common async programming mistakes in TypeScript for both NestJS backend and React frontend.

---

## 1. Sequential Awaits When Parallel Is Possible

### Problem

Operations that are independent get awaited sequentially, causing unnecessary delays.

```typescript
// WRONG: Total time = T1 + T2 + T3 (sequential)
async getDashboard(userId: string) {
  const user = await this.userService.findById(userId);          // Takes 100ms
  const orders = await this.orderService.findByUserId(userId);   // Waits, takes 100ms
  const notifications = await this.notifyService.findByUserId(userId);  // Waits, takes 100ms
  // Total: ~300ms
  return { user, orders, notifications };
}

// CORRECT: Total time = max(T1, T2, T3) (parallel)
async getDashboard(userId: string) {
  const [user, orders, notifications] = await Promise.all([
    this.userService.findById(userId),
    this.orderService.findByUserId(userId),
    this.notifyService.findByUserId(userId),
  ]);
  // Total: ~100ms
  return { user, orders, notifications };
}
```

### When to Use What

- **Independent operations** → `Promise.all()`
- **Operations with dependencies** → Sequential with `await`
- **Mixed** → Use `Promise.all()` for independent, then sequential for dependent

---

## 2. Floating Promises (Not Awaited)

### Problem

Unawaited promises silently fail. Errors are swallowed. Code continues as if operation succeeded.

```typescript
// WRONG: Floating promise
async processOrder(orderId: string) {
  const order = await getOrder(orderId);

  // These errors are SILENT — user never notified
  sendEmail(order);           // Error silently fails
  updateAnalytics(orderId);   // Error silently fails
  logToService(order);        // Error silently fails

  return { success: true };   // Returns success even if notifications failed!
}

// CORRECT: Await all promises or mark explicitly as void
async processOrder(orderId: string) {
  const order = await getOrder(orderId);

  // Option 1: Await critical operations
  await updateAnalytics(orderId);
  await logToService(order);

  // Option 2: Fire-and-forget (marked explicitly with void)
  void sendEmail(order);  // Intentional, errors logged elsewhere

  return { success: true };
}

// CORRECT: Use allSettled for non-critical operations
async processOrder(orderId: string) {
  const order = await getOrder(orderId);

  // Non-critical notifications (tolerate failures)
  await Promise.allSettled([
    sendEmail(order),
    sendSms(order),
    logAnalytics(orderId),
  ]);

  return { success: true };
}
```

### ESLint to Catch This

Enable in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "noImplicitReturns": true
  }
}
```

Or use ESLint rule: `@typescript-eslint/no-floating-promises`

---

## 3. Missing Error Handling in Async Callbacks

### Problem

Errors in async callbacks (useEffect, event handlers) are not caught.

```typescript
// WRONG: React — error in useEffect is silent
export function OrderList() {
  useEffect(() => {
    fetchOrders();  // Error is NOT caught — console.error only
  }, []);

  async function fetchOrders() {
    const response = await api.get("/orders");
    setOrders(response.data);
  }

  return <div>{/* ... */}</div>;
}

// CORRECT: Catch in useEffect
export function OrderList() {
  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await api.get("/orders");
        setOrders(response.data);
      } catch (error) {
        toast.error("Failed to load orders");
        console.error(error);
      }
    }

    void fetchOrders();  // Call the async function
  }, []);

  return <div>{/* ... */}</div>;
}

// ALSO CORRECT: Use React Query (preferred)
export function OrderList() {
  const { data: orders = [] } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: () => api.get("/orders").then(r => r.data),
  });

  return <div>{/* ... */}</div>;
  // React Query handles loading, error, and retry automatically
}
```

### NestJS Example

```typescript
// WRONG: NestJS — Service throws, but controller doesn't catch
@Controller("orders")
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);  // If this throws, unhandled!
  }
}

// CORRECT: Let global filter handle it
@Controller("orders")
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    // Don't catch — let HttpExceptionFilter handle it
    return this.orderService.create(dto);
  }
}

// In service, throw specific exceptions
@Injectable()
export class OrderService {
  async create(dto: CreateOrderDto): Promise<Order> {
    if (dto.quantity <= 0) {
      throw new BadRequestException("Quantity must be positive");
    }
    return this.prisma.order.create({ data: dto });
  }
}
```

---

## 4. Promise.all Fails Fast (Sometimes You Want allSettled)

### Problem

If any operation fails, `Promise.all()` rejects immediately. Other operations may be abandoned.

```typescript
// WRONG: All or nothing
async notifyOrderCompletion(order: Order) {
  await Promise.all([
    sendEmail(order),       // If SMS fails, email notification is ABANDONED
    sendSms(order),
    logAnalytics(order),
    updateCRM(order),
  ]);
}

// If sendSms throws:
// - sendEmail is abandoned (not awaited completely)
// - logAnalytics is abandoned
// - Error bubbles up, other notifications lost

// CORRECT: Use allSettled for independent notifications
async notifyOrderCompletion(order: Order) {
  const results = await Promise.allSettled([
    sendEmail(order),
    sendSms(order),
    logAnalytics(order),
    updateCRM(order),
  ]);

  // Log failures, but don't fail the operation
  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );
  if (failures.length > 0) {
    this.logger.warn(
      `${failures.length} notifications failed`,
      failures.map(f => f.reason)
    );
  }
}

// WHEN TO USE Promise.all:
// - All operations MUST succeed
// - Example: Load user + preferences + settings (all required for page)

// WHEN TO USE allSettled:
// - Some failures are tolerable
// - Example: Email + SMS + analytics (nice-to-have notifications)
```

---

## 5. Not Handling AbortController/Cancellation

### Problem

Long-running operations continue even after user navigates away. Memory leaks, wasted requests.

```typescript
// WRONG: React — fetch continues after component unmounts
export function SearchUsers() {
  const [results, setResults] = useState<User[]>([]);

  async function searchUsers(query: string) {
    const response = await fetch(`/api/users?q=${query}`);
    setResults(await response.json());  // Error: component may be unmounted
  }

  return <input onChange={(e) => searchUsers(e.target.value)} />;
}

// CORRECT: Use AbortController with cleanup
export function SearchUsers() {
  const [results, setResults] = useState<User[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function searchUsers(query: string) {
    // Cancel previous request
    abortControllerRef.current?.abort();

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/users?q=${query}`, {
        signal: abortControllerRef.current.signal,
      });
      if (response.ok) {
        setResults(await response.json());
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Request was cancelled, this is OK
        return;
      }
      console.error(error);
    }
  }

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return <input onChange={(e) => searchUsers(e.target.value)} />;
}

// ALSO CORRECT: Use React Query (auto handles cleanup)
export function SearchUsers() {
  const [query, setQuery] = useState("");
  const { data: results = [] } = useQuery({
    queryKey: ["users", query],
    queryFn: () => api.get(`/users?q=${query}`).then(r => r.data),
    enabled: query.length > 0,
  });

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

---

## 6. async forEach (Doesn't Work as Expected)

### Problem

`forEach` doesn't wait for async operations. All execute in parallel without control.

```typescript
// WRONG: Order not guaranteed, all promises fire at once
const orders = [order1, order2, order3];

orders.forEach(async (order) => {
  await sendEmail(order);  // All 3 emails sent in parallel
  await updateDatabase(order);
});

// Code continues immediately, emails may still be sending

// CORRECT: Sequential processing
for (const order of orders) {
  await sendEmail(order);
  await updateDatabase(order);
}

// CORRECT: Parallel processing with controlled concurrency
await Promise.all(
  orders.map(order =>
    (async () => {
      await sendEmail(order);
      await updateDatabase(order);
    })()
  )
);

// CORRECT: Batch processing with limit
import pLimit from "p-limit";

const limit = pLimit(5);  // Max 5 concurrent
await Promise.all(
  orders.map(order =>
    limit(() => sendEmailAndUpdate(order))
  )
);
```

---

## 7. Missing Timeout for External API Calls

### Problem

API calls hang indefinitely, blocking entire application.

```typescript
// WRONG: No timeout
async fetchUserData(userId: string) {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();  // Hangs forever if server is down
}

// CORRECT: Use timeout
async fetchUserData(userId: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`/api/users/${userId}`, {
      signal: controller.signal,
    });
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// ALSO CORRECT: NestJS with axios
import axios from "axios";

const client = axios.create({
  timeout: 5000,  // 5 second timeout for all requests
});

// ALSO CORRECT: Use Promise.race
async fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    ),
  ]);
}
```

---

## 8. Unhandled Promise Rejection in Promise Chains

### Problem

Errors in promise chains are not caught without `.catch()`.

```typescript
// WRONG: Error in then() is unhandled
this.api.get("/data")
  .then(response => processData(response.data))
  .then(result => updateUI(result));
  // If processData throws, error is unhandled

// CORRECT: Add .catch()
this.api.get("/data")
  .then(response => processData(response.data))
  .then(result => updateUI(result))
  .catch(error => {
    console.error("Operation failed:", error);
    showErrorMessage(error);
  });

// BETTER: Use async/await with try-catch
async function loadData() {
  try {
    const response = await this.api.get("/data");
    const result = await processData(response.data);
    updateUI(result);
  } catch (error) {
    console.error("Operation failed:", error);
    showErrorMessage(error);
  }
}
```

---

## 9. Race Conditions from Stale Closures in React

### Problem

Async operations capture old state/props, causing race conditions.

```typescript
// WRONG: Race condition
export function OrderDetails({ orderId }: Props) {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    // This closure captures initial orderId
    async function loadOrder() {
      const data = await api.get(`/orders/${orderId}`);
      setOrder(data);  // But orderId may have changed!
    }

    loadOrder();
  }, []);  // Missing orderId dependency!

  // If orderId prop changes, loadOrder still uses old orderId
}

// CORRECT: Include dependencies
export function OrderDetails({ orderId }: Props) {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function loadOrder() {
      const data = await api.get(`/orders/${orderId}`);
      setOrder(data);
    }

    loadOrder();
  }, [orderId]);  // Re-run when orderId changes

  // Or use React Query (auto handles this)
  const { data: order } = useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => api.get(`/orders/${orderId}`).then(r => r.data),
  });
}

// WRONG: Multiple fetches racing (last one wins)
export function SearchResults({ query }: Props) {
  const [results, setResults] = useState([]);

  const handleSearch = async (q: string) => {
    const data = await api.get(`/search?q=${q}`);
    setResults(data);  // What if query changed while request was pending?
  };

  // User types "apple" → request starts
  // User types "apples" → request starts (query="apple" still pending)
  // apples request finishes first → setResults(apples)
  // apple request finishes → setResults(apple)  // Wrong order!
}

// CORRECT: Abort previous requests
export function SearchResults({ query }: Props) {
  const abortRef = useRef<AbortController | null>(null);
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    async function search() {
      try {
        const data = await api.get(`/search?q=${query}`, {
          signal: abortRef.current!.signal,
        });
        setResults(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;  // Request was cancelled, that's OK
        }
        console.error(error);
      }
    }

    if (query) {
      void search();
    }
  }, [query]);

  return <div>{/* ... */}</div>;
}
```

---

## 10. Not Using Dead Letter Queue for Failed Jobs

### Problem

Failed BullMQ jobs are lost. No visibility into what failed and why.

```typescript
// WRONG: Jobs disappear on failure
await queue.add(jobName, payload, {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnFail: true,  // Job deleted after failure — GONE forever
});

// CORRECT: Keep failed jobs in dead letter queue
await queue.add(jobName, payload, {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: true,   // Remove successful jobs
  removeOnFail: false,      // Keep failed jobs for inspection
});

// Monitor dead letter queue
const deadLetterQueue = new Queue("jobs:dead", { connection: redis });

async function monitorDeadLetterQueue() {
  const deadJobs = await deadLetterQueue.getJobs(["failed"]);

  if (deadJobs.length > 0) {
    this.logger.error(
      `${deadJobs.length} jobs in dead letter queue`,
      deadJobs.map(job => ({
        id: job.id,
        name: job.name,
        failedReason: job.failedReason,
        data: job.data,
      }))
    );

    // Alert ops team
    await this.slackService.alertOps(`${deadJobs.length} failed jobs`);
  }
}
```

---

## Checklist Before Deploy

- [ ] No sequential awaits when parallel is possible?
- [ ] No floating promises (all awaited or marked with `void`)?
- [ ] All async callbacks have error handling?
- [ ] Using `allSettled` for tolerant failures?
- [ ] AbortController used for cancellable operations?
- [ ] Timeouts configured on external API calls?
- [ ] Promise chains have `.catch()` handler?
- [ ] React useEffect dependencies correct (no stale closures)?
- [ ] Failed jobs kept in dead letter queue?
- [ ] All async loop operations processed with proper concurrency control?
