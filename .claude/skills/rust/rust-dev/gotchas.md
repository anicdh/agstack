# Rust Development Gotchas

Common Rust development mistakes and how to avoid them.

## Error Handling

### Using unwrap() in Production

```rust
// WRONG: Panics in production
let value = map.get(&key).unwrap();
let parsed: i32 = text.parse().unwrap();

// CORRECT: Handle errors gracefully
let value = map.get(&key).ok_or(KeyNotFound)?;
let parsed: i32 = text.parse().context("Failed to parse")?;
```

### Generic Errors in Library Code

```rust
// WRONG: Loses type information
pub fn process() -> Result<(), Box<dyn Error>> { ... }
pub fn process() -> anyhow::Result<()> { ... }  // anyhow in lib

// CORRECT: Typed errors
#[derive(Debug, thiserror::Error)]
pub enum ProcessError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(String),
}

pub fn process() -> Result<(), ProcessError> { ... }
```

---

## Type Safety

### Using f64 for Money

```rust
// WRONG: Floating point precision errors
let price: f64 = 0.1 + 0.2;  // != 0.3!

// CORRECT: Decimal for financial values
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

let price: Decimal = dec!(0.1) + dec!(0.2);  // == 0.3
```

### Missing Newtype Patterns

```rust
// WRONG: Primitive obsession, easy to confuse
fn transfer(from: String, to: String, amount: u64) { ... }
transfer(to_id, from_id, amount);  // Oops, swapped!

// CORRECT: Newtypes prevent confusion
struct AccountId(String);
struct Amount(Decimal);

fn transfer(from: AccountId, to: AccountId, amount: Amount) { ... }
// Compiler catches wrong order
```

---

## Documentation

### Missing Doc Comments

```rust
// WRONG: No documentation
pub fn calculate_slippage(orderbook: &Orderbook, size: Decimal) -> Decimal { ... }

// CORRECT: Document purpose, params, examples
/// Calculate slippage for a given order size.
///
/// # Arguments
/// * `orderbook` - Current orderbook snapshot
/// * `size` - Order size in base currency
///
/// # Returns
/// Expected slippage as a decimal percentage (0.01 = 1%)
///
/// # Example
/// ```
/// let slippage = calculate_slippage(&book, dec!(100));
/// ```
pub fn calculate_slippage(orderbook: &Orderbook, size: Decimal) -> Decimal { ... }
```

---

## Testing

### Tests in src/

```rust
// WRONG: Tests in src/ directory
// src/lib.rs
#[cfg(test)]
mod tests { ... }

// CORRECT: Tests in tests/ directory
// tests/unit/module_tests.rs
use your_crate::module;

#[test]
fn test_function() { ... }
```

### Missing Edge Cases

```rust
// WRONG: Only happy path tested
#[test]
fn test_parse() {
    assert_eq!(parse("123"), Ok(123));
}

// CORRECT: Test edge cases
#[test]
fn test_parse_valid() { ... }

#[test]
fn test_parse_empty() {
    assert!(parse("").is_err());
}

#[test]
fn test_parse_negative() { ... }

#[test]
fn test_parse_overflow() { ... }
```

---

## Async Patterns

### Blocking in Async

```rust
// WRONG: Blocks tokio threads
async fn read_file() -> String {
    std::fs::read_to_string("file.txt").unwrap()  // BLOCKING!
}

// CORRECT: Use async I/O
async fn read_file() -> Result<String> {
    tokio::fs::read_to_string("file.txt").await
}
```

### CPU Work in Async

```rust
// WRONG: Heavy computation blocks executor
async fn process() {
    let result = expensive_calculation(&data);
}

// CORRECT: Use spawn_blocking
async fn process() {
    let result = tokio::task::spawn_blocking(|| {
        expensive_calculation(&data)
    }).await?;
}
```

---

## Memory & Performance

### Unnecessary Clones

```rust
// WRONG: Clone when reference works
fn process(items: Vec<Item>) { ... }
process(items.clone());

// CORRECT: Borrow
fn process(items: &[Item]) { ... }
process(&items);
```

### Missing Capacity Hints

```rust
// WRONG: Multiple reallocations
let mut results = Vec::new();
for item in items {
    results.push(process(item));
}

// CORRECT: Pre-allocate
let mut results = Vec::with_capacity(items.len());
for item in items {
    results.push(process(item));
}
```

---

## Before Commit Checklist

1. **cargo fmt --all** - Formatting
2. **cargo clippy -- -D warnings** - Lints
3. **cargo test** - Tests pass
4. **No .unwrap()** in non-test code
5. **All pub items** have doc comments
6. **cargo check** - Compiles cleanly
