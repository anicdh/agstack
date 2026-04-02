---
name: rust-dev
description: >
  ALWAYS read this BEFORE writing or modifying any Rust code (.rs files).
  Covers error handling, async patterns, type safety, and documentation
  requirements. MANDATORY for agent-jobs.
invocation: auto
---

# Rust Development Standards

> **MANDATORY:** agent-jobs MUST read this file before writing or modifying any `.rs` file.

## Before Writing Any Code

1. Read existing code in the module to understand patterns
2. Check `Cargo.toml` for available dependencies
3. Verify error types defined for this module (`src/error.rs`)
4. Run `cargo check` before AND after changes

## Implementation Checklist

### Every New Function
- [ ] Has `///` doc comment with description
- [ ] Returns `Result<T, AppError>` (not `anyhow` in library code)
- [ ] Uses `?` for error propagation with `.context()` when needed
- [ ] Has `#[must_use]` if return value should not be ignored
- [ ] Has unit test in `#[cfg(test)]` module

### Every New Struct
- [ ] Has `///` doc comment
- [ ] Derives `Debug` at minimum
- [ ] Derives `Clone` only when clone is cheap
- [ ] Uses newtype pattern for domain values (e.g., `struct JobId(String)`)
- [ ] Fields documented if not self-explanatory
- [ ] `#[serde(rename_all = "camelCase")]` for JSON compat with TypeScript

### Every New Module
- [ ] Has module-level `//!` doc comment
- [ ] Has error enum using `thiserror` (or uses shared `AppError`)
- [ ] Only exports public API via `mod.rs`

## Error Handling Patterns

```rust
// ✅ CORRECT — typed errors with thiserror
#[derive(Debug, thiserror::Error)]
pub enum JobError {
    #[error("Database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("Payload invalid: {0}")]
    Payload(String),
}

// ❌ WRONG — generic errors lose type information
pub fn process() -> Result<(), Box<dyn Error>> { ... }
pub fn process() -> anyhow::Result<()> { ... }  // anyhow in lib code
```

```rust
// ✅ CORRECT — handle errors gracefully
let value = map.get(&key).ok_or(AppError::NotFound("key missing"))?;
let parsed: i32 = text.parse().context("Failed to parse count")?;

// ❌ WRONG — panics in production
let value = map.get(&key).unwrap();
let parsed: i32 = text.parse().unwrap();
```

## Type Safety

```rust
// ✅ CORRECT — newtype prevents parameter confusion
struct AccountId(String);
struct Amount(Decimal);
fn transfer(from: AccountId, to: AccountId, amount: Amount) { ... }

// ❌ WRONG — primitive obsession, easy to swap params
fn transfer(from: String, to: String, amount: u64) { ... }
```

## Async Patterns

### Task Spawning
```rust
// Long-running background service
tokio::spawn(async move {
    loop {
        tokio::select! {
            msg = rx.recv() => match msg {
                Some(cmd) => handle_command(cmd).await,
                None => break,
            },
            _ = shutdown.cancelled() => break,
        }
    }
});

// CPU-intensive work — NEVER block tokio threads
let result = tokio::task::spawn_blocking(move || {
    heavy_computation(&data)
}).await?;
```

### Channel Patterns
```rust
// Bounded channel — backpressure prevents OOM
let (tx, mut rx) = tokio::sync::mpsc::channel::<JobPayload>(10_000);

// Watch — only latest value matters (current state)
let (tx, rx) = tokio::sync::watch::channel(initial_state);

// Broadcast — fan-out to multiple consumers
let (tx, _) = tokio::sync::broadcast::channel::<Event>(100);
```

### Common Async Mistakes

```rust
// ❌ WRONG — holds lock across await (deadlock risk)
let guard = mutex.lock().await;
do_async_work().await;
drop(guard);

// ✅ CORRECT — release before await
let data = {
    let guard = mutex.lock().await;
    guard.clone()
};
do_async_work_with(data).await;
```

```rust
// ❌ WRONG — blocks tokio thread
std::thread::sleep(Duration::from_secs(1));
let data = std::fs::read_to_string("file.txt")?;

// ✅ CORRECT — async versions
tokio::time::sleep(Duration::from_secs(1)).await;
let data = tokio::fs::read_to_string("file.txt").await?;
```

### Graceful Shutdown
```rust
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();
let task_token = token.clone();

tokio::spawn(async move {
    loop {
        tokio::select! {
            _ = task_token.cancelled() => {
                tracing::info!("Shutting down gracefully");
                cleanup().await;
                break;
            }
            result = do_work() => { /* handle */ }
        }
    }
});

// Trigger shutdown
tokio::signal::ctrl_c().await?;
token.cancel();
```

### Retry with Exponential Backoff
```rust
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
                tracing::warn!("Attempt {}/{}: {e}, retry in {:?}",
                    attempt + 1, max_retries, delay);
                tokio::time::sleep(delay).await;
                delay = (delay * 2).min(Duration::from_secs(60));
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}
```

## Memory & Performance

```rust
// ✅ CORRECT — borrow when possible
fn process(items: &[Item]) { ... }
process(&items);

// ❌ WRONG — unnecessary clone
fn process(items: Vec<Item>) { ... }
process(items.clone());
```

```rust
// ✅ CORRECT — pre-allocate known capacity
let mut results = Vec::with_capacity(items.len());

// ❌ WRONG — multiple reallocations
let mut results = Vec::new();
```

## After Writing Code

1. `cargo fmt --all` — formatting
2. `cargo clippy --all-targets --all-features -- -D warnings` — lints
3. `cargo test` — run relevant tests
4. Verify NO `.unwrap()` in non-test code
5. Verify all public items have doc comments
6. `cargo check` — clean compilation
