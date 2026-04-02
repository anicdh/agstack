# HFT Optimization Patterns

## Lock-Free Data Structures

```rust
use crossbeam::queue::ArrayQueue;
use std::sync::atomic::{AtomicU64, Ordering};

// Lock-free orderbook price level
pub struct LockFreeOrderbook {
    // Pre-allocated fixed-size queue - no locks, no allocations
    bids: ArrayQueue<PriceLevel>,
    asks: ArrayQueue<PriceLevel>,
    sequence: AtomicU64,
}

impl LockFreeOrderbook {
    pub fn new(capacity: usize) -> Self {
        Self {
            bids: ArrayQueue::new(capacity),
            asks: ArrayQueue::new(capacity),
            sequence: AtomicU64::new(0),
        }
    }

    #[inline(always)]
    pub fn update_bid(&self, level: PriceLevel) {
        // Non-blocking push - bounded queue
        let _ = self.bids.force_push(level);
        self.sequence.fetch_add(1, Ordering::Release);
    }

    #[inline(always)]
    pub fn get_sequence(&self) -> u64 {
        self.sequence.load(Ordering::Acquire)
    }
}

// Lock-free counter for metrics
use std::sync::atomic::AtomicUsize;
static ORDER_COUNT: AtomicUsize = AtomicUsize::new(0);

#[inline(always)]
pub fn increment_orders() {
    ORDER_COUNT.fetch_add(1, Ordering::Relaxed);
}
```

---

## Network Latency Optimization

```rust
use tokio::net::TcpStream;
use socket2::{Socket, TcpKeepalive};
use std::time::Duration;

// Configure TCP socket for minimum latency
pub fn configure_low_latency_socket(stream: &TcpStream) -> std::io::Result<()> {
    let socket = Socket::from(stream.as_raw_fd());

    // Disable Nagle's algorithm - send immediately
    socket.set_nodelay(true)?;

    // Aggressive keepalive for connection health
    let keepalive = TcpKeepalive::new()
        .with_time(Duration::from_secs(10))
        .with_interval(Duration::from_secs(1));
    socket.set_tcp_keepalive(&keepalive)?;

    // Increase socket buffer sizes
    socket.set_recv_buffer_size(1024 * 1024)?;  // 1MB
    socket.set_send_buffer_size(1024 * 1024)?;

    Ok(())
}

// HTTP client optimized for HFT
use reqwest::Client;
pub fn create_hft_http_client() -> Client {
    Client::builder()
        .tcp_nodelay(true)
        .pool_max_idle_per_host(10)       // Keep connections warm
        .pool_idle_timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_millis(500))
        .timeout(Duration::from_secs(5))
        .http2_prior_knowledge()           // Skip HTTP/1.1 upgrade
        .build()
        .expect("Failed to build HTTP client")
}

// WebSocket with optimized settings
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
pub fn ws_config_for_hft() -> WebSocketConfig {
    WebSocketConfig {
        max_message_size: Some(64 * 1024 * 1024),  // 64MB
        max_frame_size: Some(16 * 1024 * 1024),    // 16MB
        accept_unmasked_frames: false,
        ..Default::default()
    }
}
```

---

## CPU & Cache Optimization

```rust
// Cache-line alignment to prevent false sharing
#[repr(align(64))]  // Typical cache line size
pub struct CacheAlignedCounter {
    value: AtomicU64,
    _padding: [u8; 56],  // Pad to 64 bytes
}

// SIMD for batch price calculations
#[cfg(target_arch = "x86_64")]
use std::arch::x86_64::*;

#[inline(always)]
#[cfg(target_arch = "x86_64")]
pub unsafe fn batch_multiply_prices(prices: &mut [f64], multiplier: f64) {
    let mult = _mm256_set1_pd(multiplier);
    let chunks = prices.chunks_exact_mut(4);

    for chunk in chunks {
        let data = _mm256_loadu_pd(chunk.as_ptr());
        let result = _mm256_mul_pd(data, mult);
        _mm256_storeu_pd(chunk.as_mut_ptr(), result);
    }
}

// Branch prediction hints
#[inline(always)]
pub fn process_order(order: &Order) -> Result<(), OrderError> {
    // Mark hot path - most orders are valid
    if std::intrinsics::likely(order.is_valid()) {
        execute_order(order)
    } else {
        // Cold path - invalid orders are rare
        Err(OrderError::Invalid)
    }
}

// With stable Rust, use #[cold] attribute instead
#[cold]
#[inline(never)]
fn handle_error(e: OrderError) {
    // Error handling code - rarely executed
    tracing::error!("Order error: {:?}", e);
}

// CPU pinning for critical threads
use core_affinity::CoreId;
pub fn pin_to_isolated_core(core_id: usize) {
    let core_ids = core_affinity::get_core_ids().unwrap();
    if let Some(id) = core_ids.get(core_id) {
        core_affinity::set_for_current(*id);
        tracing::info!("Pinned to core {}", core_id);
    }
}

// Dedicated thread for order execution
std::thread::Builder::new()
    .name("order-executor".into())
    .spawn(move || {
        pin_to_isolated_core(0);  // Pin to core 0
        // Order execution loop...
    })?;
```

---

## Memory Optimization for Hot Path

```rust
// Object pool to avoid allocations in hot path
use object_pool::Pool;

pub struct OrderPool {
    pool: Pool<Order>,
}

impl OrderPool {
    pub fn new(size: usize) -> Self {
        Self {
            pool: Pool::new(size, Order::default),
        }
    }

    #[inline(always)]
    pub fn get(&self) -> PoolGuard<Order> {
        self.pool.try_pull().expect("Pool exhausted")
    }
}

// Arena allocator for batch operations
use bumpalo::Bump;

pub fn process_batch(orders: &[RawOrder]) -> Vec<ProcessedOrder> {
    let arena = Bump::new();

    // All allocations in this batch use arena
    let processed: Vec<&ProcessedOrder> = orders
        .iter()
        .map(|o| arena.alloc(process_single(o)))
        .collect();

    // Convert to owned before arena drops
    processed.into_iter().cloned().collect()
}

// Pre-allocated buffers for serialization
thread_local! {
    static ENCODE_BUFFER: RefCell<Vec<u8>> = RefCell::new(Vec::with_capacity(4096));
}

#[inline(always)]
pub fn encode_order(order: &Order) -> Vec<u8> {
    ENCODE_BUFFER.with(|buf| {
        let mut buffer = buf.borrow_mut();
        buffer.clear();  // Reuse allocation
        order.encode_into(&mut buffer);
        buffer.clone()
    })
}

// Avoid String allocations - use ArrayString for fixed-size
use arrayvec::ArrayString;
type Symbol = ArrayString<16>;  // Stack-allocated, max 16 chars

pub struct FastOrder {
    symbol: Symbol,           // No heap allocation
    price: u64,               // Fixed-point instead of Decimal
    quantity: u64,
}
```

---

## Hot Path Checklist

```rust
// DO in hot path:
// - Use #[inline(always)] for small, frequently-called functions
// - Pre-allocate all buffers
// - Use fixed-point arithmetic (u64) instead of Decimal/f64
// - Access data sequentially for cache optimization
// - Use lock-free structures for shared state

// AVOID in hot path:
// - Any heap allocation (Vec::new(), String::new(), Box::new())
// - Mutex/RwLock - use atomics or lock-free structures
// - System calls (logging, file I/O)
// - Hash map lookups - use array indexing if possible
// - String formatting/parsing
// - Error handling with Result (use Option or direct values)

// Example: Optimized price lookup
pub struct PriceLookup {
    // Array-based lookup by token ID (0-255)
    prices: [AtomicU64; 256],
}

impl PriceLookup {
    #[inline(always)]
    pub fn get(&self, token_id: u8) -> u64 {
        // Single array index - O(1), no hashing
        self.prices[token_id as usize].load(Ordering::Relaxed)
    }

    #[inline(always)]
    pub fn set(&self, token_id: u8, price: u64) {
        self.prices[token_id as usize].store(price, Ordering::Release);
    }
}
```

---

## Cargo.toml for Maximum HFT Performance

```toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
panic = "abort"
strip = true

[profile.release.build-override]
opt-level = 3

# Target-specific optimizations
[target.x86_64-unknown-linux-gnu]
rustflags = ["-C", "target-cpu=native"]

[dependencies]
# Lock-free structures
crossbeam = "0.8"
# Object pooling
object-pool = "0.5"
# Arena allocation
bumpalo = "3"
# Stack-allocated strings/vecs
arrayvec = "0.7"
smallvec = "1"
# CPU affinity
core_affinity = "0.8"
# Fast random (for jitter)
fastrand = "2"
# Optimized hasher
ahash = "0.8"
rustc-hash = "1"
```
