# Rust Architecture Gotchas

Common architectural mistakes and how to avoid them.

## Concurrency Primitive Selection

### Using Mutex for Read-Heavy Data

```rust
// WRONG: Mutex for read-heavy data
let config = Arc::new(Mutex::new(config));
// Every read must acquire lock

// CORRECT: ArcSwap for read-heavy data
let config = Arc::new(ArcSwap::from_pointee(config));
// Reads don't need lock, updates atomic swap
```

### Using RwLock HashMap for High Concurrency

```rust
// WRONG: HashMap with RwLock when high concurrency needed
let cache = Arc::new(RwLock::new(HashMap::new()));
// Entire map locked on write

// CORRECT: DashMap for concurrent key-value access
let cache = DashMap::new();
// Per-shard locking, high concurrency
```

### Holding Locks Across Await Points

```rust
// WRONG: Holding lock across .await (deadlock risk!)
let guard = mutex.lock().await;
some_async_operation().await;  // Lock held here!
drop(guard);

// CORRECT: Clone data out, release lock
let data = {
    let guard = mutex.lock().await;
    guard.clone()
};
some_async_operation(data).await;  // Safe
```

---

## Ownership Mistakes

### Unnecessary Clones

```rust
// WRONG: Clone when reference would work
fn process(data: Vec<Item>) { ... }
process(items.clone());  // Wasteful if items not needed after

// CORRECT: Borrow when possible
fn process(data: &[Item]) { ... }
process(&items);
```

### Arc Cycles

```rust
// WRONG: Arc cycle creates memory leak
struct Node {
    parent: Arc<Node>,   // Creates cycle!
    children: Vec<Arc<Node>>,
}

// CORRECT: Use Weak for back-references
struct Node {
    parent: Weak<Node>,  // No cycle
    children: Vec<Arc<Node>>,
}
```

---

## Channel Mistakes

### Unbounded Channels

```rust
// WRONG: Unbounded channel can cause OOM
let (tx, rx) = mpsc::unbounded_channel();

// CORRECT: Bounded channel with backpressure
let (tx, rx) = mpsc::channel(1000);
```

### Wrong Channel Type

| Need | Wrong Choice | Correct Choice |
|------|-------------|----------------|
| All subscribers get same message | `mpsc` | `broadcast` |
| Only latest value matters | `mpsc` | `watch` |
| Single response | `mpsc` | `oneshot` |

---

## Error Handling Mistakes

### Using anyhow in Library Code

```rust
// WRONG: anyhow in library (loses type info)
pub fn process() -> anyhow::Result<()> { ... }

// CORRECT: Typed errors in library
pub fn process() -> Result<(), ProcessError> { ... }
```

### unwrap() in Production Code

```rust
// WRONG: unwrap in production
let value = map.get(&key).unwrap();

// CORRECT: Handle None case
let value = map.get(&key).ok_or(KeyNotFound)?;
```

---

## Financial Calculation Mistakes

### Using f64 for Money

```rust
// WRONG: Float for financial values
let price: f64 = 1234.5678;  // Precision errors!

// CORRECT: Decimal for exact arithmetic
use rust_decimal::Decimal;
let price: Decimal = dec!(1234.5678);
```

---

## Module Structure Mistakes

### Exposing Internal Types

```rust
// WRONG: Expose internal implementation
pub mod internal_helpers;  // Now public API!

// CORRECT: Private internal, public API in mod.rs
mod internal_helpers;  // Private
pub use types::PublicType;  // Explicit public API
```

### Missing Error Types

```rust
// WRONG: Generic errors lose context
pub fn fetch() -> Result<Data, Box<dyn Error>> { ... }

// CORRECT: Module-specific error enum
#[derive(Debug, thiserror::Error)]
pub enum FetchError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Parse error: {0}")]
    Parse(String),
}
```

---

## Data Storage Mistakes

### Defaulting to Database for Everything

```rust
// WRONG: Checkpoint doesn't need full durability
sqlx::query!("INSERT INTO checkpoints (key, data) VALUES ($1, $2)",
    "rate_limit:user:123", counter
).execute(&pool).await?;  // 5-50ms latency!

// CORRECT: Rate limits → Redis or in-memory
redis.incr("rate_limit:user:123")?;  // 1-5ms
redis.expire("rate_limit:user:123", 60)?;

// OR for single-process
use moka::sync::Cache;
let rate_limits: Cache<UserId, u32> = Cache::builder()
    .time_to_live(Duration::from_secs(60))
    .build();  // <1μs
```

### Checkpoint Without TTL

```rust
// WRONG: Checkpoints accumulate forever → memory leak
redis.set("checkpoint:scan", data)?;
cache.insert(key, value);  // Never expires

// CORRECT: Always set expiration
redis.set_ex("checkpoint:scan", data, 3600)?;

let cache: Cache<K, V> = Cache::builder()
    .time_to_live(Duration::from_secs(300))
    .build();
```

### Large Objects in Redis

```rust
// WRONG: Serialize 10MB orderbook to Redis
redis.set("full_orderbook", huge_orderbook)?;  // Network overhead!

// CORRECT: Store reference or use DB for large objects
redis.set("orderbook_version", version)?;
// Fetch from source when needed

// OR: Store in DB with proper indexing
sqlx::query!("INSERT INTO orderbook_snapshots ...").execute(&pool).await?;
```

### Reading from DB on Hot Path

```rust
// WRONG: DB query on every request
async fn handle_request(req: Request) -> Response {
    let config = sqlx::query_as!(Config, "SELECT * FROM config")
        .fetch_one(&pool).await?;  // 5-50ms on EVERY request!
    // ...
}

// CORRECT: Cache config in memory
static CONFIG: OnceCell<ArcSwap<Config>> = OnceCell::new();

async fn handle_request(req: Request) -> Response {
    let config = CONFIG.get().unwrap().load();  // <1μs
    // ...
}
```

### Storage Decision Table

| Scenario | Wrong | Correct | Why |
|----------|-------|---------|-----|
| Rate limit counters | DB | moka/Redis | Needs <1ms latency |
| Session state | DB | Redis | Needs survive restart, not full durability |
| Price cache | Redis | moka | Updated every second, memory OK |
| Position snapshot | DB | Redis | Can rebuild, latency critical |
| Trade execution | Redis | DB | MUST be durable, audit trail |

---

## Checklist Before Merge

1. **Concurrency**: No locks held across await points?
2. **Ownership**: No unnecessary clones?
3. **Channels**: All channels bounded?
4. **Errors**: Typed errors, no unwrap()?
5. **Money**: Decimal for financial values?
6. **API**: Only intended types are public?
7. **Storage**: Correct tier for each data type? (See `references/storage-tiers.md`)
