---
name: rust-architecture
description: >
  Call this skill when designing architecture for Rust code: new modules,
  trait interfaces, concurrency patterns (Arc, channels, DashMap, ArcSwap),
  or ownership decisions. Provides Rust-specific constraints and patterns.
invocation: auto
---

# Rust Architecture Patterns

This skill provides Rust-specific constraints and patterns for architectural decisions.

## Mandatory Rules

| Rule | Rationale |
|------|-----------|
| Financial values → `rust_decimal::Decimal` | Never use f64 for money |
| All I/O → async via tokio | No blocking in async context |
| Public APIs → `Result<T, E>` with typed errors | Explicit error handling |
| Shared state → lock-free structures when possible | Performance and safety |
| Modules → clear ownership boundaries | Borrow checker friendly |

## Rust Concurrency Primitives Selection

### Concurrency Decision Table

| Primitive | Use Case | Access Pattern | Performance |
|-----------|----------|----------------|-------------|
| **ArcSwap<T>** | Config, state snapshot | write-rarely, read-often | O(1) reads, lock-free |
| **DashMap<K, V>** | Concurrent HashMap | write-often, read-often, key-based | Per-shard locking |
| **Arc<Mutex<T>>** | Exclusive access | write-often, read-often | Full lock |
| **Arc<RwLock<T>>** | Reader-heavy | write-rarely, read-often | Read-preferring lock |
| **tokio::sync::mpsc** | Message queue | producer-consumer | Bounded/unbounded |
| **tokio::sync::broadcast** | Pub/sub | one-to-many delivery | Clone per consumer |
| **tokio::sync::watch** | Latest value only | single producer, multi consumer | Always latest |
| **tokio::sync::oneshot** | Single response | request-response | One-shot |
| **crossbeam::channel** | Sync message passing | multi-producer, multi-consumer | Lock-free |

### Selection Flowchart

```
Need shared mutable state?
├── YES: Data access pattern?
│   ├── Read-heavy (>90% reads) → ArcSwap or RwLock
│   ├── Write-heavy + key-based → DashMap
│   └── Write-heavy + full struct → Mutex
│
└── NO (message passing): Consumer pattern?
    ├── Single consumer → tokio::sync::mpsc
    ├── Multiple consumers (all receive same message) → tokio::sync::broadcast
    ├── Multiple consumers (only need latest value) → tokio::sync::watch
    └── Single response (RPC-style) → tokio::sync::oneshot
```

### When to Use What (Scenarios)

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| Global config read on every request | `ArcSwap<Config>` | Lock-free reads, atomic swap on update |
| Orderbook state with many readers | `ArcSwap<OrderbookSnapshot>` | Copy-on-write, readers not blocked |
| User sessions, caches | `DashMap<UserId, Session>` | Per-key locking, high concurrency |
| Event broadcasting | `tokio::sync::broadcast` | Multiple subscribers, backpressure |
| Latest price feed | `tokio::sync::watch` | Subscribers only need latest price |
| Task queue | `tokio::sync::mpsc` | Bounded queue with backpressure |
| Sync worker pool | `crossbeam::channel` | High-throughput, sync context |
| Async RPC call | `tokio::sync::oneshot` | Single response, auto-cleanup |

### Anti-patterns to Avoid

```rust
// ❌ AVOID: Mutex for read-heavy data
let config = Arc::new(Mutex::new(config));
// Every read must acquire lock

// ✅ USE: ArcSwap for read-heavy data
let config = Arc::new(ArcSwap::from_pointee(config));
// Reads need no lock, updates are atomic swap

// ❌ AVOID: HashMap with RwLock for high concurrency
let cache = Arc::new(RwLock::new(HashMap::new()));
// Entire map locked on write

// ✅ USE: DashMap for concurrent key-value access
let cache = DashMap::new();
// Per-shard locking, high concurrency

// ❌ AVOID: Holding lock across .await point
let guard = mutex.lock().await;
some_async_operation().await;  // 💀 Deadlock risk!
drop(guard);

// ✅ USE: Clone data first, release lock
let data = {
    let guard = mutex.lock().await;
    guard.clone()
};
some_async_operation(data).await;  // Safe
```

## Data Storage Decisions

### Decision Tree: Where to Store Data

```
┌─────────────────────────────────────────────────────────────┐
│                   DATA STORAGE DECISION                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Need to survive       │
              │ process restart?      │
              └───────────────────────┘
                    │           │
                   YES          NO
                    │           │
                    ▼           ▼
         ┌──────────────┐   ┌──────────────┐
         │ Need to      │   │ In-Memory    │
         │ survive      │   │ (moka, Vec,  │
         │ server       │   │  DashMap)    │
         │ restart?     │   └──────────────┘
         └──────────────┘
               │     │
              YES    NO
               │     │
               ▼     ▼
         ┌────────┐  ┌────────┐
         │  DB    │  │ Redis  │
         │(Postgres)│ │        │
         └────────┘  └────────┘
```

### Storage Tier Matrix

| Tier | Storage | Latency | Durability | Use Case |
|------|---------|---------|------------|----------|
| **L1** | In-Memory | <1μs | None | Hot cache, rate limiters, computed values |
| **L2** | Redis | 1-5ms | Process restart | Sessions, checkpoints, distributed locks |
| **L3** | Database | 5-50ms | Full | Transactions, audit logs, user data |

### Checkpoint Storage Rules

**Use In-Memory (moka/DashMap) When:**
- Checkpoint < 1KB
- Rebuild time < 100ms
- Loss acceptable on crash
- Examples: price cache, rate limit counters, computed aggregates

**Use Redis When:**
- Checkpoint 1KB - 1MB
- Need survive process restart
- Can lose on server restart
- Read latency critical (<5ms)
- Examples: session state, position snapshots, user preferences

**Use Database When:**
- Checkpoint > 1MB
- Need full durability
- Audit trail required
- Complex queries needed
- Examples: trade history, order logs, account state

> **Full reference:** See `references/storage-tiers.md` for detailed guidance

---

## Ownership Patterns

### When to Use What:

```
Data shared (immutable) → Arc<T>
Data shared (mutable)   → Arc<Mutex<T>> or Arc<RwLock<T>>
Data transferred        → move ownership
Data borrowed           → &T or &mut T with explicit lifetimes
Interior mutability     → RefCell, Cell, RwLock
```

### Decision Tree:

```
Need to share across threads?
├── Yes: Need mutate?
│   ├── Yes: Read-heavy? → Arc<RwLock<T>>
│   │        Write-heavy? → Arc<Mutex<T>>
│   │        Key-based? → Arc<DashMap<K, V>>
│   │        Atomic swap? → ArcSwap<T>
│   └── No: Arc<T>
└── No: Need mutate?
    ├── Yes: &mut T or RefCell<T>
    └── No: &T or move
```

## Code Patterns

### Financial Calculations
```rust
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

let price: Decimal = dec!(1234.5678);
let size: Decimal = dec!(10.0);
let notional = price * size; // Exact arithmetic
```

### Atomic Swap for Orderbook
```rust
use arc_swap::ArcSwap;
use std::sync::Arc;

let orderbook = ArcSwap::from_pointee(Orderbook::new());

// Writer: atomic replace
let new_book = Arc::new(build_orderbook(updates));
orderbook.store(new_book);

// Reader: non-blocking load
let book = orderbook.load();
let best_bid = book.best_bid();
```

### Concurrent Map for Positions
```rust
use dashmap::DashMap;

let positions: DashMap<AccountId, Vec<Position>> = DashMap::new();

// Read without blocking writers
if let Some(pos) = positions.get(&account_id) {
    // use pos.value()
}

// Atomic update
positions.entry(account_id).or_default().push(new_position);
```

### Channel-based Communication
```rust
use tokio::sync::mpsc;

// Bounded channel for backpressure
let (tx, mut rx) = mpsc::channel::<OrderUpdate>(1000);

// Sender
tx.send(update).await?;

// Receiver
while let Some(update) = rx.recv().await {
    process(update);
}
```

## Review Checklist

When reviewing Rust architecture:

### Ownership & Borrowing
- [ ] Unnecessary clones? Can use references or Arc?
- [ ] Lifetime annotations clear and minimal?
- [ ] Ownership transfer documented?

### Concurrency
- [ ] Locks held across `.await` points? (deadlock risk)
- [ ] Channel buffer sizes appropriate?
- [ ] Shutdown handling clean?

### Safety
- [ ] Unsafe blocks justified and documented?
- [ ] Invariants maintained?
- [ ] Panic-free in production code?

### Error Handling
- [ ] Error types specific and actionable?
- [ ] Error propagation with `?` and `.context()`?
- [ ] No `.unwrap()` in non-test code?

### Performance
- [ ] Allocations in hot path?
- [ ] String operations use `&str` instead of `String`?
- [ ] Iterators instead of collecting?

## Trait Design Guidelines

```rust
// Good: Trait small, focused
pub trait PriceProvider {
    fn get_price(&self, symbol: &str) -> Result<Decimal, PriceError>;
}

// Good: Async trait with Send bound
#[async_trait]
pub trait OrderExecutor: Send + Sync {
    async fn execute(&self, order: Order) -> Result<Execution, ExecutionError>;
}

// Good: Builder pattern for complex construction
pub struct OrderBuilder {
    // fields...
}

impl OrderBuilder {
    pub fn new() -> Self { ... }
    pub fn symbol(mut self, symbol: &str) -> Self { ... }
    pub fn side(mut self, side: Side) -> Self { ... }
    pub fn build(self) -> Result<Order, BuildError> { ... }
}
```

## Module Structure Template

```
src/
└── new_module/
    ├── mod.rs          # Public API, re-exports
    ├── types.rs        # Domain types
    ├── error.rs        # Module-specific errors
    ├── service.rs      # Main service implementation
    └── utils.rs        # Internal helpers (private)
```

```rust
// mod.rs
//! Module documentation explaining purpose and usage.

mod types;
mod error;
mod service;
mod utils;

pub use types::{Config, State};
pub use error::ModuleError;
pub use service::Service;
```
