# Rust Async Gotchas

Common async programming mistakes and how to avoid them.

## Blocking the Runtime

### Using std Blocking in Async

```rust
// WRONG: Blocks tokio thread
std::thread::sleep(Duration::from_secs(1));
let data = std::fs::read_to_string("file.txt")?;

// CORRECT: Use tokio async versions
tokio::time::sleep(Duration::from_secs(1)).await;
let data = tokio::fs::read_to_string("file.txt").await?;
```

### CPU-Intensive Work in Async

```rust
// WRONG: CPU work blocks async executor
async fn process() {
    let result = heavy_computation(&data);  // Blocks!
}

// CORRECT: Use spawn_blocking
async fn process() {
    let result = tokio::task::spawn_blocking(move || {
        heavy_computation(&data)
    }).await?;
}
```

---

## Lock Pitfalls

### Holding Lock Across Await

```rust
// WRONG: Deadlock risk!
let guard = mutex.lock().await;
do_async_work().await;  // Lock held across await!
drop(guard);

// CORRECT: Release before await
let data = {
    let guard = mutex.lock().await;
    guard.clone()
};
do_async_work_with(data).await;
```

### Using std::sync::Mutex in Async

```rust
// WRONG: std Mutex can't be held across await
let guard = std_mutex.lock().unwrap();
async_work().await;  // WILL NOT COMPILE (Mutex not Send)

// CORRECT: Use tokio::sync::Mutex
let guard = tokio_mutex.lock().await;
// But still avoid holding across await!
```

---

## Channel Mistakes

### Unbounded Memory Growth

```rust
// WRONG: Unbounded channel can OOM
let (tx, rx) = mpsc::unbounded_channel();

// CORRECT: Bounded with backpressure
let (tx, rx) = mpsc::channel(1000);
```

### Not Handling Channel Close

```rust
// WRONG: Ignoring channel close
while let Some(msg) = rx.recv().await {
    process(msg);
}
// Silently exits when sender drops

// CORRECT: Explicit handling
loop {
    match rx.recv().await {
        Some(msg) => process(msg),
        None => {
            tracing::info!("Channel closed, shutting down");
            break;
        }
    }
}
```

---

## Crawling/HTTP Mistakes

### Sequential Requests

```rust
// WRONG: Sequential - too slow
for url in urls {
    let result = client.get(&url).send().await?;
}

// CORRECT: Concurrent with semaphore
let semaphore = Arc::new(Semaphore::new(100));
let futures = urls.into_iter().map(|url| {
    let client = client.clone();
    let sem = semaphore.clone();
    async move {
        let _permit = sem.acquire().await.unwrap();
        client.get(&url).send().await
    }
});
let results = futures::future::join_all(futures).await;
```

### No Proxy for High-Volume

```rust
// WRONG: No proxy - will get rate limited/blocked
let client = Client::new();

// CORRECT: Use proxy for crawling
let client = Client::builder()
    .proxy(Proxy::all(proxy_url)?)
    .build()?;
```

### Unbounded Concurrency

```rust
// WRONG: Can overwhelm server or crash
let futures: Vec<_> = urls.iter().map(|u| client.get(u).send()).collect();
let results = futures::future::join_all(futures).await;

// CORRECT: Bounded concurrency
use futures::stream::StreamExt;
stream::iter(urls)
    .map(|url| client.get(&url).send())
    .buffer_unordered(100)  // Max 100 concurrent
    .collect()
    .await
```

---

## Shutdown Mistakes

### No Graceful Shutdown

```rust
// WRONG: Tasks just die on Ctrl+C
tokio::spawn(async move {
    loop {
        do_work().await;  // Orphaned on shutdown
    }
});

// CORRECT: Use CancellationToken
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();
let task_token = token.clone();

tokio::spawn(async move {
    loop {
        tokio::select! {
            _ = task_token.cancelled() => {
                cleanup().await;
                break;
            }
            _ = do_work() => {}
        }
    }
});

// On shutdown:
token.cancel();
```

---

## WebSocket Mistakes

### No Reconnection Logic

```rust
// WRONG: Single connection attempt
let (ws, _) = connect_async(url).await?;
// If connection drops, game over

// CORRECT: Reconnection loop
loop {
    match connect_and_listen(url).await {
        Ok(()) => break,  // Clean shutdown
        Err(e) => {
            tracing::warn!("Connection lost: {}, reconnecting...", e);
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
}
```

### No Ping/Pong Keepalive

```rust
// WRONG: Connection may timeout silently
while let Some(msg) = ws.next().await { ... }

// CORRECT: Ping interval
let mut ping_interval = tokio::time::interval(Duration::from_secs(30));

loop {
    tokio::select! {
        msg = ws.next() => { ... }
        _ = ping_interval.tick() => {
            ws.send(Message::Ping(vec![])).await?;
        }
    }
}
```

---

## Checklist Before Deploy

1. **No std blocking** in async code?
2. **No locks** held across await?
3. **All channels** bounded?
4. **Graceful shutdown** implemented?
5. **Retry logic** for network operations?
6. **Concurrency limited** with semaphore?
7. **Proxy configured** for high-volume crawling?
