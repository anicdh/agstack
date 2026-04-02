---
name: typescript-testing
description: >
  Call this skill when writing or reviewing tests for TypeScript code.
  Covers unit tests, integration tests, and component tests across NestJS backend
  (Jest + Prisma mocking) and React frontend (Vitest + Testing Library).
  Includes test factories, mocking patterns, and coverage strategies.
invocation: auto
---

# TypeScript Testing Patterns

## Testing Philosophy

### Arrange → Act → Assert Pattern

Every test follows this structure for clarity:

```typescript
// ✅ CORRECT: Clear phases
it("should calculate total price with tax when tax rate is 10%", () => {
  // Arrange: Set up test data and mocks
  const items = [
    { name: "item1", price: 100 },
    { name: "item2", price: 200 },
  ];
  const taxRate = 0.1;

  // Act: Call the function being tested
  const total = calculateTotalWithTax(items, taxRate);

  // Assert: Verify the result
  expect(total).toBe(330);  // (100 + 200) * 1.1
});

// ❌ WRONG: Unclear phases, multiple assertions
it("test calculation", () => {
  const result = calculateTotalWithTax([{ price: 100 }], 0.1);
  expect(result).toBe(110);
  const result2 = calculateTotalWithTax([{ price: 200 }], 0.1);
  expect(result2).toBe(220);
  const result3 = calculateTotalWithTax([], 0.1);
  expect(result3).toBe(0);
});
```

### Test Naming Convention

Test names describe behavior, not implementation:

```typescript
// ✅ CORRECT: Describes expected behavior
it("should return all active orders when filter is active", () => { ... });
it("should throw NotFoundException when user not found", () => { ... });
it("should invalidate queries after successful mutation", () => { ... });

// ❌ WRONG: Implementation details or unclear
it("calls findAll", () => { ... });
it("test1", () => { ... });
it("should work", () => { ... });
```

---

## NestJS Backend Testing

### Service Unit Tests with Mocked Prisma

```typescript
// api/src/modules/orders/__tests__/orders.service.spec.ts

import { Test, TestingModule } from "@nestjs/testing";
import { OrdersService } from "../orders.service";
import { PrismaService } from "@/common/prisma.service";
import { NotFoundException } from "@nestjs/common";

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // Create module with mocked Prisma
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return order when found", async () => {
      // Arrange
      const orderId = "order-123";
      const mockOrder = {
        id: orderId,
        userId: "user-1",
        total: 150,
        status: "pending",
        createdAt: new Date(),
      };
      jest
        .spyOn(prisma.order, "findUnique")
        .mockResolvedValue(mockOrder);

      // Act
      const result = await service.findById(orderId);

      // Assert
      expect(result).toEqual(mockOrder);
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: orderId },
      });
    });

    it("should throw NotFoundException when order not found", async () => {
      // Arrange
      const orderId = "not-found";
      jest.spyOn(prisma.order, "findUnique").mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(orderId)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw when Prisma throws database error", async () => {
      // Arrange
      jest
        .spyOn(prisma.order, "findUnique")
        .mockRejectedValue(new Error("Database connection failed"));

      // Act & Assert
      await expect(service.findById("order-123")).rejects.toThrow(
        "Database connection failed"
      );
    });
  });

  describe("create", () => {
    it("should create order with valid DTO", async () => {
      // Arrange
      const createDto = {
        userId: "user-1",
        items: [{ name: "item-1", price: 100 }],
        total: 100,
      };
      const savedOrder = {
        id: "order-123",
        ...createDto,
        status: "pending",
        createdAt: new Date(),
      };
      jest.spyOn(prisma.order, "create").mockResolvedValue(savedOrder);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toEqual(savedOrder);
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining(createDto),
      });
    });
  });
});
```

### Service Tests with External Service Mocks

```typescript
describe("EmailService", () => {
  let service: EmailService;
  let smtpProvider: SmtpProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: SmtpProvider,
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    smtpProvider = module.get<SmtpProvider>(SmtpProvider);
  });

  it("should retry on network error", async () => {
    // Arrange
    const email = { to: "user@example.com", subject: "Test" };
    jest
      .spyOn(smtpProvider, "send")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ messageId: "msg-123" });

    // Act
    const result = await service.sendWithRetry(email);

    // Assert
    expect(result.messageId).toBe("msg-123");
    expect(smtpProvider.send).toHaveBeenCalledTimes(2);
  });

  it("should fail after max retries", async () => {
    // Arrange
    jest
      .spyOn(smtpProvider, "send")
      .mockRejectedValue(new Error("Network error"));

    // Act & Assert
    await expect(
      service.sendWithRetry(
        { to: "user@example.com", subject: "Test" },
        { maxRetries: 2 }
      )
    ).rejects.toThrow("Network error");
    expect(smtpProvider.send).toHaveBeenCalledTimes(2);
  });
});
```

### Integration Tests with Real Database

```typescript
// api/src/modules/orders/__tests__/orders.integration.spec.ts

describe("OrdersService (Integration)", () => {
  let service: OrdersService;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Use test database (must be configured in .env.test)
    const module = await Test.createTestingModule({
      providers: [OrdersService, PrismaService],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clear database before each test
    await prisma.order.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create and retrieve order with user relationship", async () => {
    // Arrange: Create test user
    const user = await prisma.user.create({
      data: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
      },
    });

    // Act: Create order
    const order = await service.create({
      userId: user.id,
      items: [{ name: "item", price: 100 }],
      total: 100,
    });

    // Assert: Verify relationships work
    const retrieved = await service.findById(order.id);
    expect(retrieved.userId).toBe(user.id);

    // Verify cascade delete
    await prisma.user.delete({ where: { id: user.id } });
    await expect(service.findById(order.id)).rejects.toThrow();
  });

  it("should handle concurrent order creation", async () => {
    // Arrange
    const userId = "user-1";
    await prisma.user.create({
      data: { id: userId, email: "test@example.com", name: "Test" },
    });

    // Act: Create 10 orders concurrently
    const promises = Array(10)
      .fill(null)
      .map((_, i) =>
        service.create({
          userId,
          items: [{ name: `item-${i}`, price: 100 }],
          total: 100,
        })
      );

    const orders = await Promise.all(promises);

    // Assert
    expect(orders).toHaveLength(10);
    const savedOrders = await prisma.order.findMany({
      where: { userId },
    });
    expect(savedOrders).toHaveLength(10);
  });
});
```

### DTO Validation Tests

```typescript
// api/src/modules/orders/dto/__tests__/create-order.dto.spec.ts

import { validate } from "class-validator";
import { plainToClass } from "class-transformer";
import { CreateOrderDto } from "../create-order.dto";

describe("CreateOrderDto", () => {
  it("should validate correct payload", async () => {
    // Arrange
    const payload = {
      userId: "user-123",
      items: [{ name: "item", price: 100 }],
      total: 100,
    };

    // Act
    const dto = plainToClass(CreateOrderDto, payload);
    const errors = await validate(dto);

    // Assert
    expect(errors).toHaveLength(0);
  });

  it("should fail validation with missing userId", async () => {
    // Arrange
    const payload = {
      items: [{ name: "item", price: 100 }],
      total: 100,
    };

    // Act
    const dto = plainToClass(CreateOrderDto, payload);
    const errors = await validate(dto);

    // Assert
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("userId");
    expect(errors[0].constraints).toHaveProperty("isNotEmpty");
  });

  it("should fail validation with negative total", async () => {
    // Arrange
    const payload = {
      userId: "user-123",
      items: [{ name: "item", price: 100 }],
      total: -50,  // Invalid
    };

    // Act
    const dto = plainToClass(CreateOrderDto, payload);
    const errors = await validate(dto);

    // Assert
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("total");
    expect(errors[0].constraints).toHaveProperty("isPositive");
  });

  it("should strip extra properties", async () => {
    // Arrange
    const payload = {
      userId: "user-123",
      items: [{ name: "item", price: 100 }],
      total: 100,
      extra: "this should be stripped",
    };

    // Act
    const dto = plainToClass(CreateOrderDto, payload, {
      excludeExtraneousValues: true,
    });

    // Assert
    expect(dto).not.toHaveProperty("extra");
  });
});
```

---

## React Frontend Testing

### Component Tests with Testing Library

```typescript
// frontend/src/features/orders/components/__tests__/order-list.test.tsx

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { OrderList } from "../order-list";

// Mock API
jest.mock("@/lib/api-client", () => ({
  api: {
    get: jest.fn(),
  },
}));

describe("OrderList", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  function renderWithProviders(component: React.ReactElement) {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  }

  it("should display loading state initially", () => {
    // Arrange
    renderWithProviders(<OrderList />);

    // Act & Assert
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("should display orders when loaded", async () => {
    // Arrange
    const mockOrders = [
      { id: "1", userId: "user-1", total: 100, status: "pending" },
      { id: "2", userId: "user-1", total: 200, status: "shipped" },
    ];

    jest.spyOn(require("@/lib/api-client").api, "get").mockResolvedValue({
      data: mockOrders,
    });

    // Act
    renderWithProviders(<OrderList />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/order 1/i)).toBeInTheDocument();
      expect(screen.getByText(/order 2/i)).toBeInTheDocument();
    });
  });

  it("should display empty state when no orders", async () => {
    // Arrange
    jest.spyOn(require("@/lib/api-client").api, "get").mockResolvedValue({
      data: [],
    });

    // Act
    renderWithProviders(<OrderList />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/no orders found/i)).toBeInTheDocument();
    });
  });

  it("should delete order on button click", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockOrders = [
      { id: "1", userId: "user-1", total: 100, status: "pending" },
    ];

    jest.spyOn(require("@/lib/api-client").api, "get").mockResolvedValue({
      data: mockOrders,
    });

    jest.spyOn(require("@/lib/api-client").api, "delete").mockResolvedValue({
      data: { success: true },
    });

    // Act
    renderWithProviders(<OrderList />);
    await waitFor(() => {
      expect(screen.getByText(/order 1/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    // Assert
    expect(require("@/lib/api-client").api.delete).toHaveBeenCalledWith(
      "/orders/1"
    );
  });

  it("should show error toast on API failure", async () => {
    // Arrange
    jest.spyOn(require("@/lib/api-client").api, "get").mockRejectedValue({
      response: { data: { message: "Server error" } },
    });

    // Act
    renderWithProviders(<OrderList />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });
});
```

### Hook Tests with React Query

```typescript
// frontend/src/features/orders/hooks/__tests__/use-orders.test.ts

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOrders } from "../use-orders";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");

describe("useOrders", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  function renderWithProviders<T>(
    callback: () => T
  ): ReturnType<typeof renderHook<T>> {
    return renderHook(callback, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
  }

  it("should fetch orders on mount", async () => {
    // Arrange
    const mockOrders = [
      { id: "1", userId: "user-1", total: 100, status: "pending" },
    ];
    jest.spyOn(apiClient.api, "get").mockResolvedValue({
      data: mockOrders,
    });

    // Act
    const { result } = renderWithProviders(() => useOrders("user-1"));

    // Assert
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockOrders);
    expect(apiClient.api.get).toHaveBeenCalledWith(
      "/orders?userId=user-1"
    );
  });

  it("should not refetch when user ID unchanged", async () => {
    // Arrange
    jest.spyOn(apiClient.api, "get").mockResolvedValue({
      data: [{ id: "1", userId: "user-1", total: 100, status: "pending" }],
    });

    // Act
    const { rerender } = renderWithProviders(() => useOrders("user-1"));

    await waitFor(() => {
      expect(apiClient.api.get).toHaveBeenCalledTimes(1);
    });

    rerender();

    // Assert
    await waitFor(() => {
      expect(apiClient.api.get).toHaveBeenCalledTimes(1);  // No refetch
    });
  });

  it("should refetch when user ID changes", async () => {
    // Arrange
    jest.spyOn(apiClient.api, "get").mockResolvedValue({
      data: [],
    });

    // Act
    const { rerender } = renderWithHook(() => useOrders("user-1"));

    await waitFor(() => {
      expect(apiClient.api.get).toHaveBeenCalledTimes(1);
    });

    // Change user ID
    rerender(() => useOrders("user-2"));

    // Assert
    await waitFor(() => {
      expect(apiClient.api.get).toHaveBeenCalledTimes(2);
      expect(apiClient.api.get).toHaveBeenLastCalledWith(
        "/orders?userId=user-2"
      );
    });
  });
});
```

### Zustand Store Tests

```typescript
// frontend/src/stores/__tests__/user-store.test.ts

import { renderHook, act } from "@testing-library/react";
import { useUserStore } from "../user-store";

describe("useUserStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useUserStore.setState({
      user: null,
      isAuthenticated: false,
    });
  });

  it("should initialize with null user", () => {
    // Act
    const { result } = renderHook(() => useUserStore());

    // Assert
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should set user on login", () => {
    // Arrange
    const mockUser = { id: "user-1", email: "test@example.com", name: "Test" };

    // Act
    const { result } = renderHook(() => useUserStore());
    act(() => {
      result.current.setUser(mockUser);
    });

    // Assert
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("should clear user on logout", () => {
    // Arrange
    const mockUser = { id: "user-1", email: "test@example.com", name: "Test" };
    const { result } = renderHook(() => useUserStore());
    act(() => {
      result.current.setUser(mockUser);
    });

    // Act
    act(() => {
      result.current.logout();
    });

    // Assert
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

---

## Mocking Patterns

### Type-Safe Mocks with DeepMockProxy

```typescript
// ✅ CORRECT: Type-safe mock factory
import { mockDeep } from "jest-mock-extended";

describe("OrderService with typed mocks", () => {
  it("should handle Prisma errors safely", async () => {
    // Arrange
    const prismaMock = mockDeep<PrismaService>();
    const service = new OrderService(prismaMock);

    prismaMock.order.findUnique.mockRejectedValue(
      new Prisma.PrismaClientValidationError(
        "Invalid where clause",
        { version: "1.0", clientVersion: "4.0.0" }
      )
    );

    // Act & Assert: Type-safe, IDE autocompletion works
    await expect(service.findById("order-1")).rejects.toThrow();
  });
});

// ❌ WRONG: No type safety
const prismaMock = {
  order: {
    findUnique: jest.fn(),
  },
} as any;  // Lost type information
```

### Partial Mocking — Keep Some Real, Mock Others

```typescript
// ✅ CORRECT: Mock only what you need
jest.mock("@/lib/api-client", () => {
  const actualModule = jest.requireActual("@/lib/api-client");
  return {
    ...actualModule,
    api: {
      ...actualModule.api,
      get: jest.fn(),  // Mock only get
      // post, put, delete remain real
    },
  };
});
```

### Mock Factory Pattern

```typescript
// test/factories/user.factory.ts

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    createdAt: new Date(),
    ...overrides,
  };
}

export function createMockOrder(overrides?: Partial<Order>): Order {
  return {
    id: "order-1",
    userId: "user-1",
    total: 100,
    status: "pending",
    createdAt: new Date(),
    ...overrides,
  };
}

// Usage in tests
const user = createMockUser({ email: "custom@example.com" });
const order = createMockOrder({ total: 500 });
```

### When to Mock vs When to Use Real

```typescript
// ✅ MOCK: External services (email, payment, analytics)
jest.mock("@/services/email-service");
jest.mock("@/services/payment-gateway");

// ✅ MOCK: Database (PrismaService) — use factories for data
jest.mock("@/common/prisma.service");

// ✅ REAL: Utilities, helpers, validators
// Don't mock, use the real implementation

// ✅ REAL: In integration tests, use real database and real external services
// (configured for test environment)

// ❌ WRONG: Mocking everything
// You end up testing your mocks, not your code
```

---

## Test Factories

### Basic Factory Pattern

```typescript
// test/factories/index.ts

import { faker } from "@faker-js/faker";

export class UserFactory {
  static create(overrides?: Partial<User>): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      createdAt: faker.date.past(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

export class OrderFactory {
  static create(overrides?: Partial<Order>): Order {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      total: faker.number.float({ min: 10, max: 1000, precision: 0.01 }),
      status: faker.datatype.boolean() ? "pending" : "shipped",
      items: [
        {
          name: faker.commerce.productName(),
          price: faker.number.float({ min: 10, max: 100, precision: 0.01 }),
          quantity: faker.number.int({ min: 1, max: 10 }),
        },
      ],
      createdAt: faker.date.past(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides?: Partial<Order>): Order[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// Usage
const user = UserFactory.create();
const users = UserFactory.createMany(10);
const order = OrderFactory.create({ userId: user.id, total: 500 });
```

---

## Test Organization

### Frontend Structure

```
frontend/src/features/orders/
  components/
    order-list.tsx
    __tests__/
      order-list.test.tsx
  hooks/
    use-orders.ts
    __tests__/
      use-orders.test.ts
  queries/
    use-orders.ts
  stores/
    order-store.ts
    __tests__/
      order-store.test.ts
```

### Backend Structure

```
api/src/modules/orders/
  __tests__/
    orders.service.spec.ts      # Unit tests
    orders.integration.spec.ts  # Integration tests
  dto/
    __tests__/
      create-order.dto.spec.ts
  orders.service.ts
  orders.controller.ts
  orders.module.ts
```

---

## Coverage Strategy

### Critical Paths (90%+ coverage)

- Authentication and authorization
- Payment processing
- Data mutations (create, update, delete)
- Error scenarios

### Business Logic (80%+ coverage)

- Service layer methods
- Complex calculations
- Validation logic
- State transitions

### Lower Priority (50%+ coverage)

- UI components (meaningful interaction tests, not snapshot tests)
- Utility functions (unless critical path)
- Simple getters and formatters

### Don't Test

```typescript
// ❌ No need to test these:

// Simple getters
get user(): User | null {
  return this.userState.user;
}

// Framework internals (React.FC, decorator behavior)
// Simple mappers that just spread objects
// Console output or logging
```

### Coverage Configuration

```json
{
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/index.ts",
      "!src/**/index.ts"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      },
      "api/src/modules/**/services/**": {
        "branches": 90,
        "functions": 90,
        "lines": 90,
        "statements": 90
      }
    }
  }
}
```

---

## Review Checklist

Before submitting tests for review:

- [ ] Test names describe behavior, not implementation?
- [ ] Happy path AND error cases tested?
- [ ] Arrange → Act → Assert structure clear?
- [ ] No test interdependency (tests can run independently)?
- [ ] beforeEach/afterEach properly cleans up state?
- [ ] Mocks are type-safe and verified?
- [ ] No implementation details tested (private methods, internal state)?
- [ ] Async operations properly awaited with waitFor?
- [ ] Database tests properly isolated (transactions or cleanup)?
- [ ] Factory functions used for test data, no hardcoded values?
- [ ] Tests can run in parallel without conflicts?
- [ ] Coverage targets met for critical paths?
- [ ] No console.log or debug code left?
- [ ] Error messages helpful (not just "should work")?
