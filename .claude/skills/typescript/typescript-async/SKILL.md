---
name: typescript-async
description: >
  Call this skill when working with async TypeScript code: Promise patterns, error handling
  in async operations, BullMQ job queues, retry logic, parallel execution, streaming,
  or debugging async bugs. Covers common async pitfalls for both NestJS backend and React frontend.
invocation: auto
---

# TypeScript Async Patterns

## Promise Patterns

### Promise.all — Parallel Independent Operations

Use when all operations must complete and failure in any one fails the entire operation.

**Backend Example (NestJS Service):**

```typescript
// ✅ CORRECT — Load unrelated data in parallel
async getOrderDashboard(userId: string): Promise<DashboardDto> {
  const [orders, notifications, preferences] = await Promise.all([
    this.orderService.findByUserId(userId),
    this.notificationService.findByUserId(userId),
    this.preferenceService.findByUserId(userId),
  ]);

  return { orders, notifications, preferences };
}

// ❌ WRONG — Sequential when parallel is possible
async getOrderDashboard(userId: string): Promise<DashboardDto> {
  const orders = await this.orderService.findByUserId(userId);        // Finishes at T=1
  const notifications = await this.notificationService.findByUserId(userId);  // Waits for orders, finishes at T=2
  const preferences = await this.preferenceService.findByUserId(userId);      // Waits for notifications, finishes at T=3
  return { orders, notifications, preferences };
}
```

**Frontend Example (React Query):**

```typescript
// ✅ CORRECT — Parallel queries
function useOrderDashboard(userId: string) {
  const ordersQuery = useQuery({
    queryKey: queryKeys.orders.byUser(userId),
    queryFn: () => api.get(`/orders?userId=${userId}`),
  });

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.byUser(userId),
    queryFn: () => api.get(`/notifications?userId=${userId}`),
  });

  return {
    orders: ordersQuery.data?.data ?? [],
    notifications: notificationsQuery.data?.data ?? [],
    isLoading: ordersQuery.isLoading || notificationsQuery.isLoading,
  };
}

// React Query already handles parallel execution automatically
```

---

### Promise.allSettled — Partial Failure Tolerance

Use when some operations can fail without failing the entire operation (notifications, logging, analytics).

```typescript
// ✅ CORRECT — allSettled when individual failures are acceptable
async notifyOrderCompletion(order: Order): Promise<void> {
  const results = await Promise.allSettled([
    this.emailService.sendOrderComplete(order),
    this.smsService.sendOrderComplete(order),
    this.analyticsService.trackOrderCompletion(order),
    this.slackService.notifyTeam(order),
  ]);

  // Log failures without failing the operation
  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );
  if (failures.length > 0) {
    this.logger.warn(
      `${failures.length} notifications failed for order ${order.id}`,
      failures.map(f => f.reason)
    );
  }
}

// ❌ WRONG — Promise.all means one failure kills all
async notifyOrderCompletion(order: Order): Promise<void> {
  await Promise.all([
    this.emailService.sendOrderComplete(order),   // If SMS fails, email never sent
    this.smsService.sendOrderComplete(order),
    this.analyticsService.trackOrderCompletion(order),
  ]);
}
```

---

### Promise.race — Timeout Pattern

Use to implement request timeouts or "first-success" patterns.

```typescript
// ✅ CORRECT — Race with timeout
async fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// Usage
const result = await this.fetchWithTimeout(
  api.get("/expensive-endpoint"),
  5000  // 5 second timeout
);
```

---

### Promise.any — First-Success Pattern

Use when any of multiple providers can succeed (redundancy, fallbacks).

```typescript
// ✅ CORRECT — Try multiple payment providers, use first that works
async processPayment(amount: number): Promise<TransactionId> {
  try {
    return await Promise.any([
      this.stripeProvider.charge(amount),
      this.paypalProvider.charge(amount),
      this.squareProvider.charge(amount),
    ]);
  } catch (error) {
    // All providers failed (AggregateError)
    throw new PaymentFailedException("All payment providers failed");
  }
}
```

---

## Error Handling in Async

### Try-Catch with Typed Errors

```typescript
// ✅ CORRECT — Specific error handling
async getUserWithOrders(userId: string): Promise<UserWithOrders> {
  try {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { orders: true },
    });
    return user;
  } catch (error) {
    if (error instanceof Prisma.NotFoundError) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    throw error;  // Re-throw unknown errors
  }
}

// ❌ WRONG — Generic error, hides root cause
async getUserWithOrders(userId: string): Promise<UserWithOrders> {
  try {
    return await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { orders: true },
    });
  } catch {
    throw new Error("Failed to fetch user");  // Lost error details
  }
}
```

### NestJS: Throw in Service, Global Filter Catches

```typescript
// ✅ CORRECT — Service throws specific exception
@Injectable()
export class OrderService {
  async cancelOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.status === "shipped") {
      throw new BadRequestException("Cannot cancel shipped order");
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "cancelled" },
    });
  }
}

// Controller just calls service, doesn't catch
@Controller("orders")
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Patch(":id/cancel")
  async cancelOrder(@Param("id") id: string): Promise<void> {
    return this.orderService.cancelOrder(id);
    // HttpExceptionFilter catches exceptions and returns proper HTTP status
  }
}

// ❌ WRONG — Service catches and re-wraps
async cancelOrder(orderId: string): Promise<void> {
  try {
    // ... logic
  } catch (error) {
    throw new HttpException("Something went wrong", 500);  // Swallows error details
  }
}
```

### React: React Query Error Handling + Toast

```typescript
// ✅ CORRECT — onError callback shows user feedback
const { mutate: createOrder, isPending } = useApiMutation({
  mutationFn: (data: CreateOrderDto) =>
    api.post<OrderDto>("/orders", data),
  onSuccess: (response) => {
    toast.success("Order created successfully");
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  },
  onError: (error: AxiosError<ErrorResponse>) => {
    const message = error.response?.data?.message || "Failed to create order";
    toast.error(message);
  },
});

// ❌ WRONG — No error handling, user sees nothing
const handleSubmit = async (data: CreateOrderDto) => {
  try {
    await api.post("/orders", data);
  } catch (error) {
    // Silently fail, user confused
  }
};
```

---

## Floating Promises

A "floating promise" is an awaitable expression whose result is not awaited. Errors are swallowed silently.

```typescript
// ❌ WRONG — Floating promise, errors swallowed
async processOrder(orderId: string): Promise<void> {
  const order = await this.getOrder(orderId);

  // These promises are NOT awaited
  this.emailService.sendConfirmation(order);   // Error silently discarded
  this.logAnalytics(orderId);                  // Error silently discarded
  this.updateInventory(order.items);           // Error silently discarded
}

// ✅ CORRECT — Await all promises
async processOrder(orderId: string): Promise<void> {
  const order = await this.getOrder(orderId);

  await this.emailService.sendConfirmation(order);
  await this.logAnalytics(orderId);
  await this.updateInventory(order.items);
}

// ✅ ALSO CORRECT — Explicit void for fire-and-forget
async processOrder(orderId: string): Promise<void> {
  const order = await this.getOrder(orderId);

  // Intentional fire-and-forget (void signals this)
  void this.emailService.sendConfirmation(order);
  void this.logAnalytics(orderId);

  // Critical path is awaited
  await this.updateInventory(order.items);
}

// ✅ USE Promise.allSettled FOR INDEPENDENT NOTIFICATIONS
async processOrder(orderId: string): Promise<void> {
  const order = await this.getOrder(orderId);

  // Non-critical notifications (tolerate failures)
  await Promise.allSettled([
    this.emailService.sendConfirmation(order),
    this.smsService.sendConfirmation(order),
    this.analyticsService.trackOrderProcessed(order),
  ]);

  // Critical path
  await this.updateInventory(order.items);
}
```

**ESLint Rule:** Enable `@typescript-eslint/no-floating-promises` to catch these automatically.

---

## Retry with Exponential Backoff

### Generic Retry Utility

```typescript
// ✅ CORRECT — Reusable retry function
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
  }
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs } = options;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;  // Last attempt, don't retry
      }

      const jitter = Math.random() * 0.1 * delayMs;  // 10% jitter
      const actualDelay = delayMs + jitter;

      this.logger.warn(
        `Attempt ${attempt}/${maxRetries} failed, retrying in ${actualDelay}ms`,
        error
      );

      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delayMs = Math.min(delayMs * 2, maxDelayMs);  // Exponential backoff
    }
  }

  throw new Error("Should not reach here");
}

// Usage
async fetchOrderWithRetry(orderId: string): Promise<Order> {
  return retryWithBackoff(
    () => this.api.get(`/orders/${orderId}`),
    {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
    }
  );
}
```

### When to Retry vs When to Fail Fast

```typescript
// ✅ RETRY: Transient failures (network, rate limit, timeout)
if (error instanceof AxiosError) {
  if (
    error.code === "ECONNRESET" ||
    error.code === "ETIMEDOUT" ||
    error.response?.status === 429 ||  // Rate limit
    error.response?.status === 503     // Service unavailable
  ) {
    return shouldRetry = true;
  }
}

// ❌ DON'T RETRY: Permanent failures (bad request, not found, auth)
if (error instanceof AxiosError) {
  if (
    error.response?.status === 400 ||  // Bad request
    error.response?.status === 401 ||  // Unauthorized
    error.response?.status === 403 ||  // Forbidden
    error.response?.status === 404     // Not found
  ) {
    return shouldRetry = false;
  }
}
```

---

## BullMQ Job Queue Patterns

### Queue Naming Convention

```typescript
// Job type constants in /shared/constants/job-types.ts
export const JOB_TYPES = {
  SEND_EMAIL: "send-email",
  PROCESS_IMAGE: "process-image",
  GENERATE_REPORT: "generate-report",
  UPDATE_INVENTORY: "update-inventory",
} as const;

// Queue names follow pattern: jobs:{type}
const emailQueue = new Queue(`jobs:${JOB_TYPES.SEND_EMAIL}`, {
  connection: redis,
});
```

### Producer (NestJS Service) — Enqueue Job

```typescript
// ✅ CORRECT — Enqueue with typed payload
@Injectable()
export class OrderService {
  constructor(
    @InjectQueue(`jobs:${JOB_TYPES.SEND_EMAIL}`)
    private emailQueue: Queue<SendEmailPayload>,

    @InjectQueue(`jobs:${JOB_TYPES.UPDATE_INVENTORY}`)
    private inventoryQueue: Queue<UpdateInventoryPayload>,

    private prisma: PrismaService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    // Save order
    const order = await this.prisma.order.create({
      data: {
        userId: dto.userId,
        items: dto.items,
        total: dto.total,
      },
    });

    // Enqueue email notification (fire-and-forget)
    await this.emailQueue.add(
      `send-order-confirmation-${order.id}`,
      {
        orderId: order.id,
        userId: order.userId,
        recipientEmail: dto.email,
      } as SendEmailPayload,
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,  // Start with 2s
        },
        removeOnComplete: true,  // Remove from queue after success
        removeOnFail: false,      // Keep failed jobs for dead letter queue
      }
    );

    // Enqueue inventory update (critical path)
    await this.inventoryQueue.add(
      `update-inventory-${order.id}`,
      {
        orderId: order.id,
        items: dto.items,
      } as UpdateInventoryPayload,
      {
        attempts: 5,  // More retries for critical operations
        priority: 1,   // High priority
      }
    );

    return order;
  }
}

// ❌ WRONG — Inline retry logic instead of queue
async createOrder(dto: CreateOrderDto): Promise<Order> {
  const order = await this.prisma.order.create({
    data: { /* ... */ }
  });

  // Inline retry (no persistence, no dead letter queue)
  for (let i = 0; i < 3; i++) {
    try {
      await this.emailService.sendConfirmation(order);
      break;
    } catch (error) {
      if (i === 2) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return order;
}
```

### Job Payload Format

```typescript
// /shared/types/job-envelope.ts
export interface JobEnvelope<TPayload> {
  id: string;              // Unique job ID
  type: string;            // Job type from JOB_TYPES
  data: TPayload;          // Job payload
  createdAt: Date;         // When job was enqueued
  attempts: number;        // Current attempt count
}

// Specific job payloads
export interface SendEmailPayload {
  orderId: string;
  userId: string;
  recipientEmail: string;
}

export interface UpdateInventoryPayload {
  orderId: string;
  items: OrderItem[];
}
```

### Retry Configuration

```typescript
// In producer (NestJS):
await queue.add(jobName, payload, {
  attempts: 3,                    // Max 3 attempts
  backoff: {
    type: "exponential",
    delay: 2000,                  // 2s, 4s, 8s
  },
  removeOnComplete: true,         // Clean up successful jobs
  removeOnFail: false,            // Keep failed jobs
});

// Recommended retry counts:
// - Email notifications: 3 attempts
// - API calls: 3 attempts
// - Database operations: 5 attempts
// - Image processing: 2 attempts (usually hardware-limited)
```

### Dead Letter Queue — Failed Jobs

```typescript
// ✅ CORRECT — Failed jobs stored for inspection
// After max retries, BullMQ automatically moves to dead-letter queue

// Consumer code should log failures
if (job.attemptsMade >= job.opts.attempts!) {
  this.logger.error(
    `Job ${job.id} failed permanently after ${job.attemptsMade} attempts`,
    {
      jobType: job.name,
      payload: job.data,
      error: job.failedReason,
    }
  );
  // Job is now in queue: `jobs:dead`
}

// Monitoring dead letter queue
const deadLetterQueue = new Queue("jobs:dead", { connection: redis });
const deadJobs = await deadLetterQueue.getJobs(["completed"]);

// Alert ops team or trigger manual intervention
```

---

## Concurrent Operations with Limits

### Batch Processing with Concurrency Limit

```typescript
// ✅ CORRECT — Process items with concurrency limit
async processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number = 5
): Promise<R[]> {
  const results: R[] = [];
  let activePromises = 0;
  let currentIndex = 0;

  const processItem = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];

      try {
        const result = await processor(item);
        results[index] = result;
      } catch (error) {
        this.logger.error(`Failed to process item ${index}`, error);
        throw error;
      }
    }
  };

  // Start concurrencyLimit workers
  const workers = Array(concurrencyLimit)
    .fill(null)
    .map(() => processItem());

  await Promise.all(workers);
  return results;
}

// Usage
const orders = await getOrders();
const processed = await processBatch(
  orders,
  (order) => this.enrichOrderData(order),
  10  // Process 10 orders concurrently
);
```

### Alternative: Using p-limit (npm library)

```typescript
import pLimit from "p-limit";

// ✅ SIMPLER — Use library instead
const limit = pLimit(10);  // Max 10 concurrent

const results = await Promise.all(
  orders.map(order =>
    limit(() => this.enrichOrderData(order))
  )
);
```

---

## Timeout Patterns

### AbortController for Fetch Timeout

```typescript
// ✅ CORRECT — AbortController with timeout
async fetchWithAbortTimeout<T>(
  url: string,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Usage
const data = await this.fetchWithAbortTimeout("/api/data", 5000);
```

### Promise.race Timeout Pattern

```typescript
// ✅ CORRECT — Promise.race with timeout
async operationWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage: string = "Operation timeout"
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${errorMessage} after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// Usage
const result = await this.operationWithTimeout(
  this.api.get("/expensive-endpoint"),
  5000,
  "Endpoint request timeout"
);
```

### NestJS Request Timeout Interceptor

```typescript
// ✅ CORRECT — Global timeout for all requests
import { Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, timeout } from "rxjs";

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(30000)  // 30 second timeout for all endpoints
    );
  }
}

// Register in main.ts
app.useGlobalInterceptors(new TimeoutInterceptor());
```

---

## Review Checklist

Before submitting async code for review:

- [ ] All async functions properly error-handled (try-catch or .catch())?
- [ ] No floating promises? (use `await` or explicit `void`)
- [ ] Independent operations parallelized with `Promise.all`?
- [ ] Partial failures handled with `Promise.allSettled` where appropriate?
- [ ] Retry logic for transient failures (network, rate limit, timeout)?
- [ ] No retries for permanent failures (400, 401, 404)?
- [ ] Timeouts configured for external API calls?
- [ ] Job queue properly configured with retry backoff?
- [ ] Dead letter queue monitoring for failed jobs?
- [ ] Concurrency limits in place to avoid overwhelming services?
- [ ] No blocking operations in async code?
- [ ] Proper cleanup on cancellation (AbortController, etc.)?
- [ ] Error messages are informative and include context?
- [ ] Logging captures request ID / correlation ID for tracing?
