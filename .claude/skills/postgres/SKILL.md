# PostgreSQL + Prisma Development Standards

> **MANDATORY:** agent-api MUST read this file before writing or modifying any Prisma schema, migration, or database query.

## Before Writing Any Code

1. Read `api/prisma/schema.prisma` to understand current data model
2. Check existing migrations in `api/prisma/migrations/` for naming convention
3. Verify PostgreSQL is running: `docker-compose ps` or `pg_isready`
4. Run `npx prisma migrate status` to check current migration state

## Schema Design Patterns

### Every Model MUST Have

```prisma
model Order {
  id        String   @id @default(cuid())
  // ... fields ...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("orders")  // explicit table name, lowercase plural
}
```

Mandatory fields for ALL models:
- `id` — `String @id @default(cuid())` or `Int @id @default(autoincrement())`
- `createdAt` — `DateTime @default(now())`
- `updatedAt` — `DateTime @updatedAt`
- `@@map("table_name")` — explicit snake_case plural table name

### Relations — Always Explicit

```prisma
// ✅ CORRECT — explicit relation with onDelete
model Order {
  id         String      @id @default(cuid())
  userId     String
  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  items      OrderItem[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  @@index([userId])       // Index FK fields
  @@map("orders")
}

// ❌ WRONG — implicit relation, no onDelete, no FK index
model Order {
  id    String @id @default(cuid())
  user  User
  items OrderItem[]
}
```

### Indexes — Required for Query Performance

```prisma
model Order {
  // ... fields ...

  @@index([userId])                    // FK lookup
  @@index([status, createdAt])         // Filtered + sorted queries
  @@index([userId, status])            // Composite for user's orders by status
  @@unique([userId, productId])        // Business constraint
  @@map("orders")
}
```

Rules:
- Every foreign key field → `@@index`
- Every field used in `WHERE` + `ORDER BY` → composite `@@index`
- Unique business constraints → `@@unique`
- NEVER index boolean fields alone (low cardinality = useless)

### Enums for Fixed Values

```prisma
enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPING
  DELIVERED
  CANCELLED
}

model Order {
  status OrderStatus @default(PENDING)
}
```

Use enums for: status, role, type, category.
Do NOT use enums for: values that change frequently (use a reference table instead).

### Soft Delete Pattern

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  deletedAt DateTime? // null = active, timestamp = soft deleted
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([deletedAt])  // Filter active records efficiently
  @@map("users")
}
```

In service layer:
```typescript
// ✅ CORRECT — always filter soft-deleted records
async findAll() {
  return this.prisma.user.findMany({
    where: { deletedAt: null },
  });
}

async softDelete(id: string) {
  return this.prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

## Migration Patterns

### Creating Migrations

```bash
# After changing schema.prisma
npx prisma migrate dev --name descriptive-migration-name

# Good names:
npx prisma migrate dev --name add-orders-table
npx prisma migrate dev --name add-status-index-to-orders
npx prisma migrate dev --name add-soft-delete-to-users

# Bad names:
npx prisma migrate dev --name update      # too vague
npx prisma migrate dev --name fix         # what fix?
npx prisma migrate dev --name migration1  # meaningless
```

### Migration Rules

- NEVER modify a migration file after it has been applied
- NEVER delete migration files — use `npx prisma migrate dev --create-only` to create a new corrective migration
- ALWAYS review the generated SQL before applying
- Multi-step changes → separate migrations (e.g., add column nullable → backfill → make NOT NULL)
- Data migrations → write a separate script, do NOT put in Prisma migration

### Dangerous Operations — Require Extra Care

```sql
-- Adding NOT NULL column to existing table
-- ❌ WRONG — fails if table has data
ALTER TABLE orders ADD COLUMN tracking_code TEXT NOT NULL;

-- ✅ CORRECT — 3-step migration
-- Migration 1: add nullable
ALTER TABLE orders ADD COLUMN tracking_code TEXT;
-- Script: backfill data
UPDATE orders SET tracking_code = 'TBD' WHERE tracking_code IS NULL;
-- Migration 2: make NOT NULL
ALTER TABLE orders ALTER COLUMN tracking_code SET NOT NULL;
```

```sql
-- Renaming column
-- ❌ WRONG — breaks running app during deploy
ALTER TABLE orders RENAME COLUMN status TO order_status;

-- ✅ CORRECT — expand-contract pattern
-- Migration 1: add new column
ALTER TABLE orders ADD COLUMN order_status TEXT;
-- Deploy: app writes to both columns
-- Script: backfill
UPDATE orders SET order_status = status WHERE order_status IS NULL;
-- Migration 2: drop old column (after all instances use new column)
```

## Prisma Query Patterns

### Explicit Relations — Always Specify `include` or `select`

```typescript
// ✅ CORRECT — explicit include
const order = await this.prisma.order.findUnique({
  where: { id },
  include: {
    user: { select: { id: true, name: true, email: true } },
    items: { include: { product: true } },
  },
});

// ❌ WRONG — lazy loading (N+1 problem)
const order = await this.prisma.order.findUnique({ where: { id } });
const user = await this.prisma.user.findUnique({ where: { id: order.userId } });
```

### Use `select` to Limit Data

```typescript
// ✅ CORRECT — only fetch needed fields (better performance)
const users = await this.prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // password NOT included
  },
});

// ❌ WRONG — fetches all fields including sensitive data
const users = await this.prisma.user.findMany();
```

### Transactions for Multi-Write Operations

```typescript
// ✅ CORRECT — atomic transaction
const [order, payment] = await this.prisma.$transaction([
  this.prisma.order.create({ data: orderData }),
  this.prisma.payment.create({ data: paymentData }),
]);

// ✅ CORRECT — interactive transaction for complex logic
const result = await this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });

  const inventory = await tx.product.findUnique({
    where: { id: order.productId },
  });
  if (!inventory || inventory.stock < order.quantity) {
    throw new BadRequestException("Insufficient stock");
  }

  await tx.product.update({
    where: { id: order.productId },
    data: { stock: { decrement: order.quantity } },
  });

  return order;
});

// ❌ WRONG — separate queries, race condition risk
const order = await this.prisma.order.create({ data: orderData });
await this.prisma.payment.create({ data: paymentData });  // If this fails, order is orphaned
```

### Pagination — Always Cursor or Offset

```typescript
// ✅ CORRECT — offset pagination (simple, good for < 100k rows)
async findAll(page: number, limit: number) {
  const [data, total] = await Promise.all([
    this.prisma.order.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      where: { deletedAt: null },
    }),
    this.prisma.order.count({ where: { deletedAt: null } }),
  ]);

  return BaseResponseDto.paginated(data, { total, page, limit });
}

// ✅ BETTER — cursor pagination (for large datasets)
async findAll(cursor?: string | undefined, limit: number = 20) {
  const data = await this.prisma.order.findMany({
    take: limit + 1,  // Fetch one extra to detect "has next page"
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { createdAt: "desc" },
  });

  const hasNext = data.length > limit;
  if (hasNext) data.pop();

  return { data, nextCursor: hasNext ? data[data.length - 1]?.id : null };
}
```

### Bulk Operations

```typescript
// ✅ CORRECT — createMany for batch inserts
await this.prisma.orderItem.createMany({
  data: items.map((item) => ({
    orderId: order.id,
    productId: item.productId,
    quantity: item.quantity,
    price: item.price,
  })),
});

// ❌ WRONG — N individual inserts
for (const item of items) {
  await this.prisma.orderItem.create({ data: { ...item, orderId: order.id } });
}
```

## Performance Gotchas

### N+1 Query Problem

```typescript
// ❌ WRONG — N+1: 1 query for orders + N queries for users
const orders = await this.prisma.order.findMany();
for (const order of orders) {
  order.user = await this.prisma.user.findUnique({ where: { id: order.userId } });
}

// ✅ CORRECT — single query with include
const orders = await this.prisma.order.findMany({
  include: { user: true },
});
```

### Count vs findMany for Existence Check

```typescript
// ✅ CORRECT — findFirst is faster than count for existence
const exists = await this.prisma.order.findFirst({
  where: { userId, status: "PENDING" },
  select: { id: true },
});
if (exists) { ... }

// ❌ LESS EFFICIENT — count scans all matching rows
const count = await this.prisma.order.count({
  where: { userId, status: "PENDING" },
});
if (count > 0) { ... }
```

### Raw Queries — Only When Prisma Cannot

```typescript
// ✅ ACCEPTABLE — complex aggregation Prisma can't express
const stats = await this.prisma.$queryRaw<OrderStats[]>`
  SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS count,
    SUM(total) AS revenue
  FROM orders
  WHERE created_at >= ${startDate}
    AND deleted_at IS NULL
  GROUP BY DATE_TRUNC('day', created_at)
  ORDER BY day DESC
`;

// ❌ WRONG — string interpolation (SQL injection!)
const stats = await this.prisma.$queryRawUnsafe(
  `SELECT * FROM orders WHERE status = '${status}'`
);
```

**Raw query rules:**
- Use tagged template literals (`$queryRaw\`...\``) — auto-parameterized
- NEVER use `$queryRawUnsafe` with user input
- Add comment explaining why Prisma ORM can't do this
- Cache results if query is expensive (Redis with TTL)

## Connection & Pool Management

```typescript
// Prisma manages connection pool automatically
// Default: pool_size = num_physical_cpus * 2 + 1

// For high-load, configure in DATABASE_URL:
// postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10

// ✅ CORRECT — single PrismaService instance (NestJS DI handles this)
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}

// ❌ WRONG — creating PrismaClient per request
async handleRequest() {
  const prisma = new PrismaClient();  // New connection pool per request!
  await prisma.user.findMany();
}
```

## Before Commit Checklist

1. `npx prisma validate` — schema is valid
2. `npx prisma migrate dev` — migration applied cleanly
3. `npx prisma generate` — client regenerated after schema change
4. Every FK field has `@@index`
5. Every model has `createdAt`, `updatedAt`, `@@map`
6. Relations have explicit `onDelete` policy
7. No `$queryRawUnsafe` with user input
8. All multi-write operations use `$transaction`
9. No N+1 queries — use `include` or `select`
10. Sensitive fields (password, tokens) excluded from default selects
