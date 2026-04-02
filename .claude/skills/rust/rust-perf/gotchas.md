# Rust Performance Gotchas

Common performance pitfalls and how to avoid them.

## Never Optimize Blindly

**Always profile first:**
```bash
# Create flamegraph
cargo install flamegraph
cargo flamegraph --bin your-app -- --bench-mode

# CPU profiling with perf
perf record -g cargo run --release -- --bench-mode
perf report

# Memory profiling
cargo install cargo-instruments  # macOS
valgrind --tool=massif ./target/release/your-app  # Linux
```

---

## Memory Layout Pitfalls

### Array of Structs vs Struct of Arrays

```rust
// PREFER: Struct of Arrays for batch processing
struct Positions {
    accounts: Vec<AccountId>,
    liq_prices: Vec<Decimal>,
    sizes: Vec<Decimal>,
    sides: Vec<Side>,
}

// INSTEAD OF: Array of Structs (worse cache locality when scanning)
struct Position {
    account: AccountId,
    liq_price: Decimal,
    size: Decimal,
    side: Side,
}
let positions: Vec<Position> = vec![]; // scattered access patterns
```

---

## Allocation Hot Spots

### Missing Pre-allocation

```rust
// ALWAYS pre-allocate when size is known or estimable
let mut results = Vec::with_capacity(accounts.len());
let mut map = HashMap::with_capacity(estimated_entries);

// Use SmallVec for collections that are usually small
use smallvec::SmallVec;
type OrderLevels = SmallVec<[PriceLevel; 32]>; // stack for ≤32, heap if larger
```

### Expensive Recomputation

```rust
// GOOD: Compute once, use many times
pub struct OrderBuilder {
    domain_separator: DomainSeparator,  // Cached at creation
}

impl OrderBuilder {
    pub fn new(chain_id: u64, exchange: Address) -> Self {
        // EIP-712 domain separator expensive - compute ONCE
        let domain_separator = compute_domain_separator(chain_id, exchange);
        Self { domain_separator }
    }
}

// BAD: Recompute every order
pub async fn build_order(order: &UserOrder) -> SignedOrder {
    let domain = compute_domain_separator(137, exchange); // WASTEFUL
    sign_order(order, &domain).await
}
```

---

## String Allocation Waste

```rust
// PREFER: Parse without allocating
use simd_json::prelude::*;
let mut data = bytes.to_vec(); // needs mutable for simd_json
let parsed: Value = simd_json::to_borrowed_value(&mut data)?;

// PREFER: Borrow strings from source
struct OrderbookUpdate<'a> {
    symbol: &'a str,       // borrows from JSON
    bids: Vec<PriceLevel>, // owned because it outlives source
}

// AVOID: Unnecessary String allocations
struct OrderbookUpdate {
    symbol: String,  // WASTEFUL if only needed briefly
}
```

---

## Connection Warmup Missing

```rust
// Pre-establish connections BEFORE critical trading moments
impl PolyHttpClient {
    pub async fn warmup(&self) -> Result<()> {
        // Dummy request to establish connection pool
        let _ = self.client
            .get(&format!("{}/health", self.base_url))
            .send()
            .await;

        tracing::info!("HTTP connection pool warmed up");
        Ok(())
    }
}

// Usage: Call warmup in initialization
let client = PolyHttpClient::new(...)?;
client.warmup().await?;  // Connection ready for first trade
```

---

## Release Profile Oversight

```toml
# Cargo.toml - Maximum performance for latency-sensitive bots
[profile.release]
opt-level = 3
lto = "fat"           # Full link-time optimization
codegen-units = 1     # Better optimization, slower compile
panic = "abort"       # Smaller binary, no unwinding overhead
strip = true          # Remove debug symbols
```

---

## Parallel Operations Not Used

```rust
// Sign multiple orders concurrently
pub async fn build_orders(&self, user_orders: &[UserOrder]) -> Result<Vec<SignedOrder>> {
    let futures: Vec<_> = user_orders
        .iter()
        .map(|uo| self.build_order(uo))
        .collect();

    // All orders signed in parallel
    let results = futures::future::join_all(futures).await;

    results.into_iter().collect()
}
```

---

## Runtime Misconfiguration

```rust
// Tune tokio runtime for workload
let runtime = tokio::runtime::Builder::new_multi_thread()
    .worker_threads(num_cpus::get())     // match CPU cores
    .max_blocking_threads(32)             // for spawn_blocking
    .enable_all()
    .build()?;

// Pin critical tasks to specific cores
use core_affinity;
let cores = core_affinity::get_core_ids().unwrap();
core_affinity::set_for_current(cores[0]); // pin orderbook processor
```

---

## Verification After Optimization

1. **Run full test suite** — correctness first
2. **Run benchmarks** — compare before/after
3. **Check for regressions** in other benchmarks
4. **Profile again** to confirm improvement
5. **Document reasoning** for optimization
