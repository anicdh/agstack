# TypeScript Testing Gotchas

Common testing mistakes in full-stack TypeScript projects and how to avoid them.

## Testing Implementation Details Instead of Behavior

### Testing Private Methods

```typescript
// WRONG: Testing implementation detail
class OrderService {
  private calculateTax(total: number): number {
    return total * 0.1;
  }

  public getOrderTotal(baseAmount: number): number {
    return baseAmount + this.calculateTax(baseAmount);
  }
}

it("should call calculateTax", () => {
  const spy = jest.spyOn(service as any, "calculateTax");
  service.getOrderTotal(100);
  expect(spy).toHaveBeenCalled();  // Testing internals
});

// CORRECT: Test behavior through public API
it("should return correct total with tax", () => {
  const total = service.getOrderTotal(100);
  expect(total).toBe(110);  // Test result, not method calls
});
```

### Testing Internal State Instead of Output

```typescript
// WRONG: Testing internal state
it("should set orderCache to the order", () => {
  service.getOrder("order-1");
  expect((service as any).orderCache).toBeDefined();  // Internal detail
});

// CORRECT: Test observable behavior
it("should return order on subsequent calls without API call", async () => {
  jest.spyOn(api, "get");

  await service.getOrder("order-1");
  await service.getOrder("order-1");  // Second call

  expect(api.get).toHaveBeenCalledTimes(1);  // Cached
});
```

---

## Not Cleaning Up Test Database Between Tests

### Test Pollution

```typescript
// WRONG: Previous test data affects next test
describe("OrderService", () => {
  it("should find all orders", async () => {
    const order = await prisma.order.create({
      data: { userId: "user-1", total: 100 },
    });
    const orders = await service.findAll();
    expect(orders).toHaveLength(1);  // Passes
  });

  it("should create new order", async () => {
    const order = await service.create({
      userId: "user-2",
      total: 200,
    });
    const orders = await service.findAll();
    expect(orders).toHaveLength(1);  // FAILS - previous order still exists
  });
});

// CORRECT: Clean database before each test
describe("OrderService", () => {
  beforeEach(async () => {
    await prisma.order.deleteMany();
    await prisma.user.deleteMany();
  });

  it("should find all orders", async () => {
    const order = await prisma.order.create({
      data: { userId: "user-1", total: 100 },
    });
    const orders = await service.findAll();
    expect(orders).toHaveLength(1);
  });

  it("should create new order", async () => {
    const order = await service.create({
      userId: "user-2",
      total: 200,
    });
    const orders = await service.findAll();
    expect(orders).toHaveLength(1);  // Passes - clean state
  });
});

// EVEN BETTER: Use transaction rollback for speed
describe("OrderService", () => {
  let transaction: any;

  beforeEach(async () => {
    transaction = await prisma.$transaction();
  });

  afterEach(async () => {
    await transaction.$rollback();
  });

  // Tests here are isolated and fast
});
```

---

## Mocking Too Much — Testing Mocks Instead of Code

### Over-Mocking

```typescript
// WRONG: Everything mocked, testing mock behavior not real code
describe("OrderService", () => {
  let service: OrderService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: "1", total: 100 }),
        update: jest.fn().mockResolvedValue({ id: "1", total: 100 }),
        delete: jest.fn().mockResolvedValue({ id: "1", total: 100 }),
      },
    } as any;

    service = new OrderService(prisma);
  });

  it("should find order", async () => {
    const order = await service.findById("1");
    expect(order.id).toBe("1");  // Testing mock, not service logic
  });
});

// CORRECT: Mock only external services, test real database logic
describe("OrderService", () => {
  let service: OrderService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrderService, PrismaService],
    }).compile();

    service = module.get(OrderService);
    prisma = module.get(PrismaService);

    // Clear database, use real Prisma
    await prisma.order.deleteMany();
  });

  it("should find order with relationships", async () => {
    // Real Prisma call, tests actual include/select logic
    const order = await service.findById("1");
    expect(order.user).toBeDefined();
  });
});
```

---

## Missing Async/Await in Tests

### Test Passes But Doesn't Actually Test

```typescript
// WRONG: Promise created but not awaited
it("should fetch orders", () => {
  const result = service.fetchOrders();  // Promise not awaited
  expect(result).toBeDefined();  // Test passes immediately, never waits
});

// WRONG: Async function but no await
it("should fetch orders", async () => {
  const result = service.fetchOrders();  // Missing await
  expect(result).toBeInstanceOf(Promise);  // Test object, not result
});

// CORRECT: Properly await async operation
it("should fetch orders", async () => {
  const result = await service.fetchOrders();
  expect(result).toHaveLength(5);
});

// CORRECT: For React Query, use waitFor
it("should display orders after loading", async () => {
  render(<OrderList />);

  // Missing waitFor = test passes before data loads
  await waitFor(() => {
    expect(screen.getByText(/order 1/i)).toBeInTheDocument();
  });
});

// WRONG: React Query test without wrapper
it("should fetch orders", () => {
  const { result } = renderHook(() => useOrders());
  // QueryClient not provided, query fails silently
  expect(result.current.data).toBeDefined();
});

// CORRECT: Hook wrapped in QueryClientProvider
it("should fetch orders", () => {
  const { result } = renderHook(() => useOrders(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
  });
});
```

---

## Shared Mutable State Between Tests

### Test Order Dependency

```typescript
// WRONG: Tests depend on execution order
let mockCalls = [];

beforeEach(() => {
  // mockCalls not cleared, accumulates
  jest.spyOn(service, "log").mockImplementation(msg => {
    mockCalls.push(msg);
  });
});

it("test 1", () => {
  service.process();
  expect(mockCalls).toHaveLength(1);  // Passes
});

it("test 2", () => {
  service.process();
  expect(mockCalls).toHaveLength(1);  // FAILS - has 2 calls from test 1
});

// CORRECT: Clean state in beforeEach or afterEach
let mockCalls = [];

beforeEach(() => {
  mockCalls = [];  // Reset shared state
  jest.spyOn(service, "log").mockImplementation(msg => {
    mockCalls.push(msg);
  });
});

afterEach(() => {
  jest.clearAllMocks();  // Always clear
});

it("test 1", () => {
  service.process();
  expect(mockCalls).toHaveLength(1);
});

it("test 2", () => {
  service.process();
  expect(mockCalls).toHaveLength(1);  // Passes - clean state
});

// BETTER: Use jest.fn() isolated per test
it("test 1", () => {
  const mockLog = jest.fn();
  const serviceInstance = new Service(mockLog);
  serviceInstance.process();
  expect(mockLog).toHaveBeenCalledTimes(1);
});

it("test 2", () => {
  const mockLog = jest.fn();  // Fresh mock
  const serviceInstance = new Service(mockLog);
  serviceInstance.process();
  expect(mockLog).toHaveBeenCalledTimes(1);
});
```

---

## Using getByTestId When Better Options Exist

### Over-Reliance on test-id

```typescript
// WRONG: Test IDs everywhere, brittle to refactoring
<button data-testid="delete-button-order-123">Delete</button>

it("should delete order", async () => {
  const button = screen.getByTestId("delete-button-order-123");
  await userEvent.click(button);
});

// CORRECT: Use role queries (accessible, less brittle)
<button onClick={deleteOrder}>Delete</button>

it("should delete order", async () => {
  const button = screen.getByRole("button", { name: /delete/i });
  await userEvent.click(button);
});

// CORRECT: Use accessible text
<h1>Order {orderId}</h1>

it("should display order", () => {
  expect(screen.getByText(/order 123/i)).toBeInTheDocument();
});

// CORRECT: test-id only for complex components without semantic HTML
<div data-testid="custom-order-card">
  <span>{order.id}</span>
  <span>{order.total}</span>
</div>

it("should render order card", () => {
  const card = screen.getByTestId("custom-order-card");
  expect(card).toBeInTheDocument();
});
```

---

## Only Testing Happy Path

### Missing Error Cases

```typescript
// WRONG: Only tests success case
describe("OrderService", () => {
  it("should create order", async () => {
    const order = await service.create({
      userId: "user-1",
      total: 100,
    });
    expect(order.id).toBeDefined();
  });
});

// CORRECT: Test error cases too
describe("OrderService", () => {
  it("should create order successfully", async () => {
    const order = await service.create({
      userId: "user-1",
      total: 100,
    });
    expect(order.id).toBeDefined();
  });

  it("should throw NotFoundException when user not found", async () => {
    jest.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

    await expect(
      service.create({
        userId: "not-found",
        total: 100,
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw BadRequestException for negative total", async () => {
    await expect(
      service.create({
        userId: "user-1",
        total: -100,  // Invalid
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("should handle database connection error", async () => {
    jest
      .spyOn(prisma.order, "create")
      .mockRejectedValue(new Error("Connection timeout"));

    await expect(
      service.create({ userId: "user-1", total: 100 })
    ).rejects.toThrow("Connection timeout");
  });
});
```

---

## Snapshot Testing Overuse

### Brittle Snapshots

```typescript
// WRONG: Snapshot test breaks on any whitespace/format change
it("should render order component", () => {
  const { container } = render(<OrderCard order={order} />);
  expect(container).toMatchSnapshot();  // Brittle, hard to review diffs
});

// Updated component (spacing changed):
// Snapshot fails even though behavior unchanged
// Snapshot file 500 lines long, hard to review

// CORRECT: Test behavior, not structure
it("should display order details", () => {
  render(<OrderCard order={order} />);

  expect(screen.getByText(order.id)).toBeInTheDocument();
  expect(screen.getByText(`$${order.total}`)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
});

it("should call onDelete when delete button clicked", async () => {
  const onDelete = jest.fn();
  render(<OrderCard order={order} onDelete={onDelete} />);

  await userEvent.click(screen.getByRole("button", { name: /delete/i }));
  expect(onDelete).toHaveBeenCalledWith(order.id);
});

// Snapshots only for:
// - API response contracts (verify shape of returned data)
// - Configuration files
// NOT for UI rendering
```

---

## Missing act() Warnings in React Tests

### Unhandled State Updates

```typescript
// WRONG: React warns "not wrapped in act"
it("should update state", () => {
  const { result } = renderHook(() => useState(0));

  result.current[1](1);  // Not wrapped in act()
  // Warning: "An update to TestComponent inside a test was not wrapped in act"

  expect(result.current[0]).toBe(1);
});

// CORRECT: Wrap state updates in act()
it("should update state", () => {
  const { result } = renderHook(() => useState(0));

  act(() => {
    result.current[1](1);  // Wrapped
  });

  expect(result.current[0]).toBe(1);
});

// CORRECT: userEvent automatically wraps in act()
it("should increment counter on click", async () => {
  const user = userEvent.setup();
  render(<Counter />);

  // userEvent.click automatically wrapped
  await user.click(screen.getByRole("button", { name: /increment/i }));
  expect(screen.getByText("1")).toBeInTheDocument();
});
```

---

## Not Wrapping React Query Hooks in Provider

### Missing QueryClientProvider

```typescript
// WRONG: Hook fails silently without provider
it("should fetch orders", () => {
  const { result } = renderHook(() => useOrders());
  // Query can't run, no error shown, test passes empty
  expect(result.current.data).toBeDefined();  // Fails or passes silently
});

// CORRECT: Wrap in QueryClientProvider
it("should fetch orders", () => {
  const { result } = renderHook(() => useOrders(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    ),
  });

  expect(result.current.isLoading).toBe(true);
});

// CORRECT: For component tests
it("should display orders", () => {
  render(
    <QueryClientProvider client={queryClient}>
      <OrderList />
    </QueryClientProvider>
  );
});

// TIP: Create reusable wrapper helper
function renderWithQueryClient(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

// Usage
it("should display orders", () => {
  renderWithQueryClient(<OrderList />);
});
```

---

## Hardcoded Dates/Timestamps

### Test Breaks in Different Timezones

```typescript
// WRONG: Hardcoded date
it("should parse date correctly", () => {
  const date = new Date("2026-04-02");
  expect(formatDate(date)).toBe("April 2, 2026");  // Fails if timezone differs
});

// WRONG: Snapshot includes dynamic timestamp
it("should render created date", () => {
  const order = { createdAt: new Date() };
  expect(container).toMatchSnapshot();  // Fails each time, new timestamp
});

// CORRECT: Use fixed dates
it("should parse date correctly", () => {
  const date = new Date("2026-04-02T12:00:00Z");  // Explicit UTC
  expect(formatDate(date)).toBe("April 2, 2026");
});

// CORRECT: Mock current date for tests
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-04-02T12:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

it("should format today's date", () => {
  expect(formatDate(new Date())).toBe("Today");
});

// CORRECT: Use factory with consistent dates
const order = OrderFactory.create({
  createdAt: new Date("2026-04-01T00:00:00Z"),
});

// CORRECT: Test relative dates, not absolute
it("should show 'created today'", () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  render(<OrderCard order={{ createdAt: yesterday }} />);
  expect(screen.getByText(/created yesterday/i)).toBeInTheDocument();
});
```

---

## console.log Left in Tests

### Pollutes Test Output

```typescript
// WRONG: Debug logs left in test
it("should process order", async () => {
  const order = await service.create({ total: 100 });
  console.log("Order created:", order);  // Pollutes output

  expect(order.id).toBeDefined();
});

// CORRECT: Use debug utilities or remove before commit
it("should process order", async () => {
  const order = await service.create({ total: 100 });
  // console.log removed
  expect(order.id).toBeDefined();
});

// CORRECT: Use debug() from Testing Library when needed
it("should display order", () => {
  const { debug } = render(<OrderList />);

  // Temporary debugging during development
  // debug();  // Shows rendered HTML

  // Remove before committing
});

// CORRECT: Use debugger in IDE instead
it("should process order", async () => {
  const order = await service.create({ total: 100 });
  debugger;  // Set breakpoint in IDE, remove before commit
  expect(order.id).toBeDefined();
});

// PRE-COMMIT CHECK:
// grep -r "console.log\|debugger" src/__tests__ test/
// Should return nothing
```

---

## Not Testing Loading/Error States

### Component Tests Miss UI States

```typescript
// WRONG: Only tests success state
it("should display orders", async () => {
  jest.spyOn(api, "get").mockResolvedValue({ data: mockOrders });

  render(<OrderList />);
  await waitFor(() => {
    expect(screen.getByText("Order 1")).toBeInTheDocument();
  });
});

// CORRECT: Test all states
it("should show loading indicator while fetching", () => {
  jest.spyOn(api, "get").mockImplementation(
    () => new Promise(() => {})  // Never resolves
  );

  render(<OrderList />);
  expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
});

it("should display orders when loaded", async () => {
  jest.spyOn(api, "get").mockResolvedValue({ data: mockOrders });

  render(<OrderList />);
  await waitFor(() => {
    expect(screen.getByText("Order 1")).toBeInTheDocument();
  });
});

it("should show error message on failure", async () => {
  jest.spyOn(api, "get").mockRejectedValue({
    response: { data: { message: "Server error" } },
  });

  render(<OrderList />);
  await waitFor(() => {
    expect(screen.getByText(/server error/i)).toBeInTheDocument();
  });
});

it("should show empty state when no orders", async () => {
  jest.spyOn(api, "get").mockResolvedValue({ data: [] });

  render(<OrderList />);
  await waitFor(() => {
    expect(screen.getByText(/no orders found/i)).toBeInTheDocument();
  });
});
```
