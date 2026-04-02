---
name: rust-dev
description: >
  ALWAYS call this skill BEFORE writing or modifying ANY Rust code (.rs files).
  Ensure compliance with project Rust development standards including error handling, type safety,
  async patterns, and documentation requirements. REQUIRED for all Rust development in this project.
invocation: auto
---

# Rust Development Standards

## Before Writing Any Code
1. Read existing code in related modules to understand patterns
2. Check `Cargo.toml` to know available dependencies
3. Verify error type defined for this module
4. Run `cargo check` before and after changes

## Implementation Checklist

### Each New Function
- [ ] Has `///` doc comment with description
- [ ] Returns `Result<T, E>` with appropriate error type (do not use anyhow in library code)
- [ ] Uses `?` for error propagation with `.context()` when needed
- [ ] Has `#[must_use]` if return value should not be discarded
- [ ] Has unit test in `#[cfg(test)]` module

### Each New Struct
- [ ] Has `///` doc comment
- [ ] Derives `Debug` at minimum
- [ ] Derives `Clone` only when clone is cheap
- [ ] Uses newtype pattern for domain values
- [ ] Fields documented if not self-explanatory

### Each New Module
- [ ] Has module-level `//!` doc comment
- [ ] Has own error enum with `thiserror`
- [ ] Exports only public API via `mod.rs`
- [ ] Has integration test in `tests/`

## Rust Patterns Specific to This Project

### Financial Calculations

```rust
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

// ALWAYS use Decimal for money/prices
let price: Decimal = dec!(1234.5678);
let size: Decimal = dec!(10.0);
let notional = price * size; // Exact arithmetic

// NEVER do this:
// let price: f64 = 1234.5678; // WRONG — floating point errors
```

### Async HTTP with Rate Limiting

```rust
use tokio::sync::Semaphore;
use std::sync::Arc;

let semaphore = Arc::new(Semaphore::new(500)); // max concurrent
let permit = semaphore.acquire().await?;
let response = client.get(url).send().await?;
drop(permit); // release explicitly if needed before processing
```

### Concurrent Map Updates

```rust
use dashmap::DashMap;

let positions: DashMap<AccountId, Vec<Position>> = DashMap::new();

// Read without blocking writers
if let Some(pos) = positions.get(&account_id) {
    // use pos.value()
}

// Update atomically
positions.entry(account_id).or_default().push(new_position);
```

### Orderbook Atomic Swap

```rust
use arc_swap::ArcSwap;
use std::sync::Arc;

let orderbook = ArcSwap::from_pointee(Orderbook::new());

// Writer: swap entire snapshot
let new_book = Arc::new(build_new_orderbook(updates));
orderbook.store(new_book);

// Reader: load without blocking writer
let book = orderbook.load();
let best_bid = book.best_bid();
```

## After Writing Code

1. `cargo fmt --all`
2. `cargo clippy --all-targets --all-features -- -D warnings`
3. `cargo test` (related modules)
4. Verify no `.unwrap()` in non-test code
5. Verify all public items have doc comments
