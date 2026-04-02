---
name: rust-async
description: >
  Call this skill when writing async Rust code with tokio, handling WebSocket connections,
  managing concurrent tasks, implementing rate limiters, or working with channel-based
  communication. Includes common async pitfalls and patterns for high-throughput networking.
invocation: auto
---

# Async Rust Patterns

## Task Spawning Patterns
```rust
// Long-running background service
let handle = tokio::spawn(async move {
    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Some(cmd) => handle_command(cmd).await,
                    None => break, // channel closed
                }
            }
            _ = tokio::signal::ctrl_c() => break,
        }
    }
});

// CPU-intensive work — NEVER block tokio threads
let result = tokio::task::spawn_blocking(move || {
    compute_heavy_slippage(&orderbook, &positions)
}).await?;

// Parallel batch with controlled concurrency
use futures::stream::{self, StreamExt};
let results: Vec<_> = stream::iter(accounts)
    .map(|account| {
        let client = client.clone();
        let semaphore = semaphore.clone();
        async move {
            let _permit = semaphore.acquire().await.unwrap();
            fetch_positions(&client, &account).await
        }
    })
    .buffer_unordered(500) // max 500 concurrent
    .collect()
    .await;
```

## WebSocket Patterns
```rust
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures::{StreamExt, SinkExt};

async fn listen_orderbook(url: &str, tx: mpsc::Sender<OrderbookUpdate>) -> Result<()> {
    let (ws_stream, _) = connect_async(url).await?;
    let (mut write, mut read) = ws_stream.split();

    // Subscribe message
    write.send(Message::Text(subscribe_msg)).await?;

    // Ping/pong keepalive
    let ping_interval = tokio::time::interval(Duration::from_secs(30));
    tokio::pin!(ping_interval);

    loop {
        tokio::select! {
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let update = parse_orderbook_update(&text)?;
                        tx.send(update).await?;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        write.send(Message::Pong(data)).await?;
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        tracing::warn!("WebSocket closed, reconnecting...");
                        break; // outer loop handles reconnection
                    }
                    Some(Err(e)) => {
                        tracing::error!("WebSocket error: {e}");
                        break;
                    }
                    _ => {} // Binary, Pong — ignore
                }
            }
            _ = ping_interval.tick() => {
                write.send(Message::Ping(vec![])).await?;
            }
        }
    }
    Ok(())
}
```

## Channel Patterns
```rust
// Bounded channel for backpressure
let (tx, mut rx) = tokio::sync::mpsc::channel::<OrderbookUpdate>(10_000);

// Broadcast for fan-out (orderbook → multiple calculators)
let (tx, _) = tokio::sync::broadcast::channel::<OrderbookSnapshot>(100);
let mut rx1 = tx.subscribe();
let mut rx2 = tx.subscribe();

// Watch only for latest value (best for "current state")
let (tx, rx) = tokio::sync::watch::channel(initial_orderbook);
// Writer: tx.send(new_book)?;
// Reader: let book = rx.borrow().clone();

// oneshot for request-response
let (tx, rx) = tokio::sync::oneshot::channel();
// sender: tx.send(result).ok();
// receiver: let result = rx.await?;
```

## Common Async Errors

### NEVER hold locks across await

```rust
// ❌ WRONG — deadlock risk
let guard = mutex.lock().await;
do_async_work().await;  // lock held across await!
drop(guard);

// ✅ RIGHT — release before await
let data = {
    let guard = mutex.lock().await;
    guard.clone()  // clone and release
};
do_async_work_with(data).await;
```

### NEVER use std blocking in async

```rust
// ❌ WRONG — blocks tokio thread
std::thread::sleep(Duration::from_secs(1));
let data = std::fs::read_to_string("file.txt")?;

// ✅ RIGHT
tokio::time::sleep(Duration::from_secs(1)).await;
let data = tokio::fs::read_to_string("file.txt").await?;
```

### Graceful Shutdown

```rust
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();

// Pass clones to each task
let task_token = token.clone();
tokio::spawn(async move {
    loop {
        tokio::select! {
            _ = task_token.cancelled() => {
                tracing::info!("Task shutting down gracefully");
                break;
            }
            result = do_work() => { /* handle */ }
        }
    }
});

// Trigger shutdown
tokio::signal::ctrl_c().await?;
token.cancel(); // all tasks receive cancellation
```

## Retry with Exponential Backoff

```rust
use std::time::Duration;

async fn retry_with_backoff<F, Fut, T, E>(
    mut f: F,
    max_retries: u32,
    base_delay: Duration,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let mut delay = base_delay;
    for attempt in 0..max_retries {
        match f().await {
            Ok(value) => return Ok(value),
            Err(e) if attempt < max_retries - 1 => {
                tracing::warn!("Attempt {}/{}: {e}, retrying in {:?}",
                    attempt + 1, max_retries, delay);
                tokio::time::sleep(delay).await;
                delay = delay.min(Duration::from_secs(60)) * 2;
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}
```

## API Crawling Verification Checklist

**IMPORTANT: Before completing any data crawling process from API, MUST verify these points:**

### 1. Proxy Configuration

```rust
// ✅ REQUIRED: Use proxy to avoid rate limiting and IP blocking
use reqwest::Proxy;

fn build_crawler_client(proxy_url: &str) -> Result<Client> {
    let proxy = Proxy::all(proxy_url)?;

    Client::builder()
        .proxy(proxy)
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(Into::into)
}

// ✅ BETTER: Rotating proxy pool
struct ProxyPool {
    proxies: Vec<String>,
    current: AtomicUsize,
}

impl ProxyPool {
    pub fn next(&self) -> &str {
        let idx = self.current.fetch_add(1, Ordering::Relaxed) % self.proxies.len();
        &self.proxies[idx]
    }
}
```

### 2. Concurrent Requests with Threads/Tokio Tasks

```rust
// ✅ REQUIRED: Use concurrent requests to optimize throughput
use futures::stream::{self, StreamExt};
use tokio::sync::Semaphore;

async fn crawl_with_concurrency<T>(
    urls: Vec<String>,
    client: &Client,
    max_concurrent: usize,
) -> Vec<Result<T>> {
    let semaphore = Arc::new(Semaphore::new(max_concurrent));

    stream::iter(urls)
        .map(|url| {
            let client = client.clone();
            let semaphore = semaphore.clone();
            async move {
                let _permit = semaphore.acquire().await.unwrap();
                client.get(&url).send().await?.json::<T>().await
            }
        })
        .buffer_unordered(max_concurrent)
        .collect()
        .await
}
```

### 3. Verification Checklist When Reviewing Crawling Code

```
□ Using proxy? (reqwest::Proxy or proxy pool)
□ Using concurrent requests? (buffer_unordered, join_all, or spawn)
□ Limiting concurrency? (Semaphore to avoid overwhelming server)
□ Retry logic with exponential backoff?
□ Rate limiting to comply with API limits?
□ Proper timeout configuration?
□ Error handling for network failures?
```

### 4. Recommended Minimum Configuration

```rust
// Crawling config - MUST have these parameters
pub struct CrawlerConfig {
    pub proxy_url: Option<String>,       // Proxy URL (recommended)
    pub max_concurrent: usize,           // Min: 10, Recommended: 50-500
    pub requests_per_second: u32,        // Rate limit
    pub timeout_secs: u64,               // Request timeout
    pub max_retries: u32,                // Number of retries
}

impl Default for CrawlerConfig {
    fn default() -> Self {
        Self {
            proxy_url: None,
            max_concurrent: 100,          // 100 concurrent requests
            requests_per_second: 50,      // 50 req/s
            timeout_secs: 30,
            max_retries: 3,
        }
    }
}
```

### 5. Warning Signs When Reviewing (NEED FIX NOW)

```rust
// ❌ WRONG: Sequential requests - too slow
for url in urls {
    let result = client.get(&url).send().await?;  // One request at a time!
}

// ❌ WRONG: No proxy - easy to block
let client = Client::new();  // No proxy config

// ❌ WRONG: Unbounded concurrency - may crash or hit rate limit
let futures: Vec<_> = urls.iter().map(|u| client.get(u).send()).collect();
let results = futures::future::join_all(futures).await;  // No semaphore!
```

## HTTP Client Patterns for Trading Bots

### Optimized Client Configuration

```rust
use reqwest::Client;
use std::time::Duration;

fn build_trading_client() -> Client {
    Client::builder()
        // Connection pooling
        .pool_max_idle_per_host(10)    // Keep connections warm
        .pool_idle_timeout(Duration::from_secs(90))

        // Timeouts for trading
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(30))

        // Performance
        .tcp_nodelay(true)              // Disable Nagle's algorithm
        .tcp_keepalive(Duration::from_secs(30))

        // TLS (for HTTPS APIs)
        .https_only(true)

        .build()
        .expect("Cannot build HTTP client")
}
```

### Connection Pool Warmup

```rust
impl ApiClient {
    /// Warmup connection pool before important trading
    pub async fn warmup(&self) -> Result<()> {
        // Multiple requests to establish connection pool
        let futures = (0..3).map(|_| {
            self.client.get(&format!("{}/health", self.base_url)).send()
        });

        futures::future::join_all(futures).await;
        tracing::info!("Connection pool warmed up");
        Ok(())
    }
}

// Usage pattern for trading bot
async fn run_bot() -> Result<()> {
    let client = ApiClient::new()?;

    // Warmup BEFORE WebSocket activates trading
    client.warmup().await?;

    // Now ready for low-latency order placement
    listen_for_market_events(|event| {
        // First order will not have connection setup latency
        client.place_orders(&orders).await
    }).await
}
```

### Parallel API Requests with Semaphore

```rust
use tokio::sync::Semaphore;
use std::sync::Arc;

struct RateLimitedClient {
    client: Client,
    semaphore: Arc<Semaphore>,
}

impl RateLimitedClient {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            client: build_trading_client(),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
        }
    }

    pub async fn fetch_many<T>(&self, urls: Vec<String>) -> Vec<Result<T>> {
        let futures = urls.into_iter().map(|url| {
            let client = self.client.clone();
            let permit = self.semaphore.clone();
            async move {
                let _permit = permit.acquire().await.unwrap();
                client.get(&url).send().await?.json::<T>().await
            }
        });

        futures::future::join_all(futures).await
    }
}
```
