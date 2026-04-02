# Data Storage Decision Framework

Complete guide for choosing the right storage tier in Rust applications.

---

## Core Principle

**NEVER default to Database.** Always evaluate the storage tier based on:
1. Durability requirements
2. Latency requirements
3. Data size
4. Access patterns

---

## Storage Tier Definitions

### L1: In-Memory (moka, DashMap, Vec)

**Latency:** <1μs
**Durability:** None (lost on process crash)
**Capacity:** Limited by RAM

**Best for:**
- Hot data accessed every request
- Computed/derived values
- Rate limit counters
- Short-lived caches (<5 min TTL)

**Rust implementations:**
```rust
// moka - High-performance cache with TTL
use moka::sync::Cache;
let cache: Cache<String, Data> = Cache::builder()
    .max_capacity(10_000)
    .time_to_live(Duration::from_secs(300))
    .build();

// DashMap - Concurrent HashMap
use dashmap::DashMap;
let map: DashMap<K, V> = DashMap::new();
```

---

### L2: Redis

**Latency:** 1-5ms (network RTT)
**Durability:** Survives process restart, not server restart (unless persistence enabled)
**Capacity:** Redis memory limit

**Best for:**
- Session state
- Distributed locks
- Position snapshots
- User preferences
- Pub/sub messaging
- Job queues

**Patterns:**
```rust
// Simple key with TTL
redis.set_ex("checkpoint:user123", data, 3600)?;

// Atomic operations
redis.incr("rate_limit:user:123")?;
redis.expire("rate_limit:user:123", 60)?;

// Pub/sub
redis.publish("price_updates", json)?;
```

---

### L3: Database (PostgreSQL)

**Latency:** 5-50ms (query + network)
**Durability:** Full (survives any failure)
**Capacity:** Disk space

**Best for:**
- Financial transactions (MUST be here)
- Audit trails
- User account data
- Order history
- Any data that MUST NOT be lost

**Patterns:**
```rust
// Transactions for atomicity
let mut tx = pool.begin().await?;
sqlx::query!("INSERT INTO orders ...").execute(&mut *tx).await?;
sqlx::query!("UPDATE balances ...").execute(&mut *tx).await?;
tx.commit().await?;
```

---

## Decision Matrix

| Question | L1 (Memory) | L2 (Redis) | L3 (DB) |
|----------|-------------|------------|---------|
| Need to survive process crash? | ❌ | ✅ | ✅ |
| Need to survive server restart? | ❌ | ❌* | ✅ |
| Latency critical (<1ms)? | ✅ | ❌ | ❌ |
| Data > 1MB? | ❌ | ⚠️ | ✅ |
| Complex queries needed? | ❌ | ❌ | ✅ |
| Audit trail required? | ❌ | ❌ | ✅ |
| Financial data? | ❌ | ❌ | ✅ |

*Redis can persist with AOF/RDB, but not ACID-compliant

---

## Checkpoint-Specific Guidelines

### What is a "Checkpoint"?

A checkpoint is any intermediate state saved to avoid recomputation:
- Position snapshots
- Aggregated metrics
- User session state
- Processing progress markers

### Checkpoint Decision Tree

```
Checkpoint data size?
├── < 1KB AND rebuild < 100ms
│   └── L1 (moka) - No persistence needed
│
├── 1KB - 1MB
│   ├── Read latency critical (<5ms)?
│   │   └── L2 (Redis) - Fast reads, survives restart
│   └── Read latency OK (>5ms)?
│       └── Still prefer L2, unless audit needed → L3
│
└── > 1MB
    ├── Need complex queries or audit?
    │   └── L3 (DB) - Full durability
    └── Simple key-value access?
        └── L3 or consider chunking to L2
```

### Checkpoint Examples

| Checkpoint | Size | Rebuild | Storage | Rationale |
|------------|------|---------|---------|-----------|
| Current BTC price | 100B | Instant | L1 (moka) | WebSocket feeds, always fresh |
| User session | 2KB | N/A | L2 (Redis) | Needs survive process restart |
| Position snapshot | 50KB | 1s | L2 (Redis) | Latency critical, can rebuild |
| Liquidation scan | 500KB | 10s | L2 (Redis) | Rebuild expensive, ok to lose |
| Order execution | N/A | N/A | L3 (DB) | MUST be durable, audit trail |

---

## Access Pattern Analysis

### When to Cache (L1 or L2)

```
Access frequency?
├── > 100 req/sec → MUST cache at L1
├── 10-100 req/sec → Should cache at L1 or L2
├── 1-10 req/sec → Consider caching at L2
└── < 1 req/sec → Direct L3 OK
```

### Hot Path Detection

Signs you need L1 cache:
- Function called in tight loop
- Accessed on every request
- Same query repeated with same params
- CPU-bound computation that can be memoized

---

## TTL Guidelines

| Data Type | Suggested TTL | Reason |
|-----------|---------------|--------|
| Price data | 1-5s | Stale price = bad trades |
| Rate limits | 60s | Per-minute limits |
| User session | 1h - 24h | Activity-based |
| Position snapshot | 5-30min | Balance with staleness |
| API response cache | 5-60s | Depends on volatility |

### TTL Code Patterns

```rust
// moka with TTL
Cache::builder()
    .time_to_live(Duration::from_secs(30))
    .build();

// Redis with TTL
redis.set_ex(key, value, 3600)?;  // 1 hour

// Conditional refresh
if cache.get(&key).map_or(true, |v| v.is_stale()) {
    let fresh = fetch_from_source().await?;
    cache.insert(key, fresh);
}
```

---

## Multi-Tier Caching

For high-traffic data, use cache hierarchy:

```
Request
   │
   ▼
┌─────────────┐
│ L1: moka    │ ← Check first (microseconds)
│ (in-process)│
└─────────────┘
   │ miss
   ▼
┌─────────────┐
│ L2: Redis   │ ← Check second (milliseconds)
│ (shared)    │
└─────────────┘
   │ miss
   ▼
┌─────────────┐
│ L3: Postgres│ ← Source of truth
│ (durable)   │
└─────────────┘
```

**Implementation:**
```rust
async fn get_with_cache(key: &str) -> Result<Data> {
    // L1: Check in-memory
    if let Some(data) = L1_CACHE.get(key) {
        return Ok(data);
    }

    // L2: Check Redis
    if let Some(data) = redis.get::<_, Option<Data>>(key).await? {
        L1_CACHE.insert(key.to_string(), data.clone());
        return Ok(data);
    }

    // L3: Query database
    let data = sqlx::query_as!(Data, "SELECT ...").fetch_one(&pool).await?;

    // Populate caches
    redis.set_ex(key, &data, 3600).await?;
    L1_CACHE.insert(key.to_string(), data.clone());

    Ok(data)
}
```

---

## Anti-Patterns

### 1. Database for Everything

```rust
// WRONG: Every checkpoint goes to DB
sqlx::query!("INSERT INTO checkpoints (key, value) VALUES ($1, $2)",
    "rate_limit:user:123", counter
).execute(&pool).await?;

// CORRECT: Rate limits belong in Redis
redis.incr("rate_limit:user:123")?;
redis.expire("rate_limit:user:123", 60)?;
```

### 2. Checkpoint Without TTL

```rust
// WRONG: Checkpoints accumulate forever
redis.set("checkpoint:scan", data)?;

// CORRECT: Always set expiration
redis.set_ex("checkpoint:scan", data, 3600)?;
```

### 3. Large Objects in Redis

```rust
// WRONG: Serialize 10MB object to Redis
redis.set("full_orderbook", huge_orderbook)?;

// CORRECT: Store reference, fetch on demand
redis.set("orderbook_version", version)?;
// Or use DB for large objects
```

### 4. Hot Path DB Queries

```rust
// WRONG: DB query on every request
let config = sqlx::query_as!(Config, "SELECT * FROM config")
    .fetch_one(&pool).await?;

// CORRECT: Cache config in memory
static CONFIG: OnceCell<ArcSwap<Config>> = OnceCell::new();
let config = CONFIG.get().unwrap().load();
```

---

## Checklist Before Choosing Storage

1. **Durability:** What happens if this data is lost?
   - Critical → L3
   - Rebuild possible → L2 or L1

2. **Latency:** What's acceptable read latency?
   - <1ms → L1 required
   - <5ms → L2 OK
   - <50ms → L3 OK

3. **Size:** How big is each record?
   - <1KB → Any tier
   - 1KB-1MB → L2 or L3
   - >1MB → L3 preferred

4. **TTL:** Does this data expire?
   - Yes → Set TTL explicitly
   - No → Probably L3

5. **Query complexity:** Need SQL queries?
   - Yes → L3
   - Simple KV → L1 or L2

---

## Summary Table

| Data Category | Default Tier | Override If |
|---------------|--------------|-------------|
| Price feeds | L1 (moka) | - |
| Rate limits | L1 or L2 | Distributed → L2 |
| Session state | L2 (Redis) | - |
| Position snapshots | L2 (Redis) | Audit needed → L3 |
| User preferences | L2 (Redis) | - |
| Trades/orders | L3 (Postgres) | Never cache writes |
| Account balances | L3 (Postgres) | Cache reads in L1/L2 |
| Audit logs | L3 (Postgres) | - |
