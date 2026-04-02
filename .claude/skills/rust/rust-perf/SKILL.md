---
name: rust-perf
description: >
  Call this skill when optimizing Rust code for performance, profiling hot paths,
  reducing allocations, or working with latency-sensitive components like
  orderbook processing, slippage calculation, or high-throughput crawling.
  Includes zero-copy patterns, SIMD, memory layout, and benchmarking.

  Specifically for HFT: lock-free data structures (crossbeam), network latency optimization
  (TCP_NODELAY, connection pooling), CPU pinning, cache-line alignment, SIMD,
  arena allocators, object pools, and hot-path optimization techniques for
  sub-microsecond order execution.

  Memory management: TTL caches (moka), LRU eviction, bounded collections,
  memory leak detection patterns for long-running trading bots.
invocation: auto
---

# Performance Optimization Skill

## When to Apply

- Orderbook update processing (target: <1μs per update)
- Slippage calculation (target: <10μs per position)
- Account crawling throughput (target: >1000 req/s)
- Any code in hot path identified by profiling

## Profile First — Never Blindly Optimize

```bash
# Generate flamegraph
cargo install flamegraph
cargo flamegraph --bin your-app -- --bench-mode

# CPU profiling with perf
perf record -g cargo run --release -- --bench-mode
perf report

# Memory profiling
valgrind --tool=massif ./target/release/your-app  # Linux
```

---

## Zero-Copy Patterns

```rust
// PREFER: Parse without allocating
use simd_json::prelude::*;
let mut data = bytes.to_vec();
let parsed: Value = simd_json::to_borrowed_value(&mut data)?;

// PREFER: Borrow strings from source
struct OrderbookUpdate<'a> {
    symbol: &'a str,       // borrows from JSON
    bids: Vec<PriceLevel>, // owned because outlives source
}

// AVOID: Unnecessary string allocations
struct OrderbookUpdate {
    symbol: String,  // WASTE if only needed short-term
}
```

---

## Memory Layout

```rust
// PREFER: Struct of Arrays for batch processing
struct Positions {
    accounts: Vec<AccountId>,
    liq_prices: Vec<Decimal>,
    sizes: Vec<Decimal>,
    sides: Vec<Side>,
}

// INSTEAD OF: Array of Structs (worse cache locality)
struct Position { account, liq_price, size, side }
let positions: Vec<Position> = vec![];
```

---

## Pre-allocation Rules

```rust
// ALWAYS pre-allocate when size is known or can be estimated
let mut results = Vec::with_capacity(accounts.len());
let mut map = HashMap::with_capacity(estimated_entries);

// SmallVec for collections usually small
use smallvec::SmallVec;
type OrderLevels = SmallVec<[PriceLevel; 32]>;
```

---

## Benchmarking Template

```rust
use criterion::{criterion_group, criterion_main, Criterion, black_box};

fn bench_slippage_calculation(c: &mut Criterion) {
    let orderbook = create_test_orderbook(1000);
    let position = create_test_position();

    c.bench_function("slippage_1000_levels", |b| {
        b.iter(|| {
            calculate_slippage(
                black_box(&orderbook),
                black_box(&position),
            )
        })
    });
}

criterion_group!(benches, bench_slippage_calculation);
criterion_main!(benches);
```

---

## Performance Concurrency

```rust
// Tune tokio runtime
let runtime = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(num_cpus::get())
    .max_blocking_threads(32)
    .enable_all()
    .build()?;

// Pin critical tasks to specific cores
use core_affinity;
let cores = core_affinity::get_core_ids().unwrap();
core_affinity::set_for_current(cores[0]);
```

---

## Bot-Specific Optimizations

### Cache Expensive Computations

```rust
pub struct OrderBuilder {
    domain_separator: DomainSeparator,  // Cached at creation
}

impl OrderBuilder {
    pub fn new(chain_id: u64, exchange: Address) -> Self {
        let domain_separator = compute_domain_separator(chain_id, exchange);
        Self { domain_separator }
    }
}
```

### Connection Warmup

```rust
impl PolyHttpClient {
    pub async fn warmup(&self) -> Result<()> {
        let _ = self.client.get(&format!("{}/health", self.base_url)).send().await;
        Ok(())
    }
}
```

### Parallel Batch Operations

```rust
pub async fn build_orders(&self, orders: &[UserOrder]) -> Result<Vec<SignedOrder>> {
    let futures: Vec<_> = orders.iter().map(|o| self.build_order(o)).collect();
    let results = futures::future::join_all(futures).await;
    results.into_iter().collect()
}
```

---

## Release Profile

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
strip = true
```

---

## Quick Checklists

### Hot Path DO

- `#[inline(always)]` for small functions
- Pre-allocate all buffers
- Fixed-point arithmetic (u64) instead of Decimal/f64
- Lock-free structures for shared state

### Hot Path AVOID

- Heap allocations (Vec::new(), String::new())
- Mutex/RwLock (use atomics)
- System calls (logging, file I/O)
- String formatting/parsing

---

## References

For detailed patterns:
- `references/hft-patterns.md` — Lock-free, network, CPU, memory hot path
- `references/memory-management.md` — TTL caches, leak detection, bounded collections

For common pitfalls:
- `gotchas.md` — Optimization mistakes, verification steps
