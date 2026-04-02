# Memory Management for Long-Running Bots

## Common Leak Patterns

```rust
// LEAK: Unbounded collection that grows forever
struct TradingBot {
    placed_orders: HashSet<String>,      // Never cleaned up
    seen_markets: Vec<MarketId>,         // Grows unbounded
    price_history: HashMap<Token, Vec<f64>>, // Accumulates forever
}
```

---

## Solution 1: TTL Cache with Moka (Recommended)

```rust
use moka::sync::Cache;
use std::time::Duration;

struct TradingBot {
    // Automatically expires entries after 24 hours, max 100K entries
    placed_orders: Cache<String, ()>,
}

impl TradingBot {
    pub fn new() -> Self {
        let placed_orders = Cache::builder()
            .time_to_live(Duration::from_secs(24 * 60 * 60))  // 24h TTL
            .max_capacity(100_000)  // LRU eviction when full
            .build();

        Self { placed_orders }
    }

    pub fn has_placed(&self, order_id: &str) -> bool {
        self.placed_orders.contains_key(order_id)
    }

    pub fn mark_placed(&self, order_id: String) {
        self.placed_orders.insert(order_id, ());  // Auto-expires
    }
}

// Cargo.toml
// moka = { version = "0.12", features = ["sync"] }
```

---

## Solution 2: LRU Cache with quick_cache

```rust
use quick_cache::sync::Cache;

struct PriceCache {
    // Fixed size, evicts least recently used
    prices: Cache<TokenId, f64>,
}

impl PriceCache {
    pub fn new() -> Self {
        Self {
            prices: Cache::new(10_000),  // Max 10K entries
        }
    }
}

// Cargo.toml
// quick_cache = "0.6"
```

---

## Solution 3: Periodic Cleanup with Background Task

```rust
use std::time::{Duration, Instant};
use tokio::time::interval;

struct StateWithTimestamp {
    data: HashMap<String, (Value, Instant)>,
    max_age: Duration,
}

impl StateWithTimestamp {
    pub fn new(max_age: Duration) -> Self {
        Self {
            data: HashMap::new(),
            max_age,
        }
    }

    pub fn insert(&mut self, key: String, value: Value) {
        self.data.insert(key, (value, Instant::now()));
    }

    pub fn cleanup_expired(&mut self) {
        let now = Instant::now();
        self.data.retain(|_, (_, inserted_at)| {
            now.duration_since(*inserted_at) < self.max_age
        });
    }
}

// Spawn cleanup task
tokio::spawn(async move {
    let mut interval = interval(Duration::from_secs(3600)); // Every hour
    loop {
        interval.tick().await;
        state.write().await.cleanup_expired();
        tracing::debug!("Cleaned up expired entries");
    }
});
```

---

## Solution 4: Bounded Ring Buffer for History

```rust
use std::collections::VecDeque;

struct BoundedHistory<T> {
    buffer: VecDeque<T>,
    max_size: usize,
}

impl<T> BoundedHistory<T> {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(max_size),
            max_size,
        }
    }

    pub fn push(&mut self, item: T) {
        if self.buffer.len() >= self.max_size {
            self.buffer.pop_front();  // Remove oldest
        }
        self.buffer.push_back(item);
    }
}

// Usage: Price history with max 1000 entries
let price_history: BoundedHistory<PriceUpdate> = BoundedHistory::new(1000);
```

---

## Memory Leak Detection Checklist

```rust
// Review these patterns in long-running bots:

// 1. Any HashMap/HashSet without cleanup mechanism?
seen_ids: HashSet<String>  // Check if bounded

// 2. Any Vec that only pushes, never pops/clears?
event_log: Vec<Event>  // Check if bounded

// 3. Any cache without TTL or max size?
cache: HashMap<K, V>  // Should use moka/quick_cache

// 4. Any Arc<T> that might create cycles?
parent: Arc<Node>  // Use Weak<T> for back-references

// 5. Channels with unbounded capacity?
let (tx, rx) = mpsc::unbounded_channel();  // Use bounded channel
let (tx, rx) = mpsc::channel(1000);  // Bounded
```

---

## Production Memory Monitoring

```rust
// Log memory usage periodically
use sysinfo::{System, SystemExt, ProcessExt};

fn log_memory_usage() {
    let mut sys = System::new();
    sys.refresh_process(sysinfo::get_current_pid().unwrap());

    if let Some(process) = sys.process(sysinfo::get_current_pid().unwrap()) {
        let memory_mb = process.memory() / 1024 / 1024;
        tracing::info!(
            memory_mb = memory_mb,
            "Current memory usage"
        );

        // Alert if memory exceeds threshold
        if memory_mb > 500 {
            tracing::warn!("High memory usage: {}MB", memory_mb);
        }
    }
}

// Cargo.toml
// sysinfo = "0.30"
```

---

## Checklist Before Deployment

1. **All collections bounded?** - Check HashMap, HashSet, Vec
2. **TTL on caches?** - Use moka or quick_cache
3. **Weak references?** - Avoid Arc cycles
4. **Bounded channels?** - No unbounded_channel
5. **Memory monitoring?** - Log usage periodically
6. **Cleanup tasks?** - Background cleanup for long-lived data
