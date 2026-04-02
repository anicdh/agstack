# Rust Testing Gotchas

Common Rust testing mistakes and how to avoid them.

---

## Missing `#[tokio::test]` for Async Tests

### Using `#[test]` for Async Code

```rust
// WRONG: Test silently does nothing or fails with misleading error
#[test]
async fn fetch_price_succeeds() {
    let price = get_price("BTC").await.unwrap();
    assert!(price > dec!(0));
}

// CORRECT: Use #[tokio::test]
#[tokio::test]
async fn fetch_price_succeeds() {
    let price = get_price("BTC").await.unwrap();
    assert!(price > dec!(0));
}

// For multi-threaded runtime:
#[tokio::test(flavor = "multi_thread")]
async fn concurrent_orders_work() {
    // ...
}
```

**Why it matters:** Without `#[tokio::test]`, the test function doesn't return a `Future`, causing compilation errors or worse, silent failures. The macro properly initializes the async runtime.

---

## `.unwrap()` in Test Setup Without Context

### Obscuring Root Cause in Fixture Creation

```rust
// WRONG: If setup fails, you get unhelpful panic
#[test]
fn test_something() {
    let order = create_test_order().unwrap();  // Panic here is mysterious
    assert_eq!(order.symbol, "BTC");
}

// CORRECT: Use .expect() with explanation
#[test]
fn test_something() {
    let order = create_test_order()
        .expect("Failed to create test order: field validation error");
    assert_eq!(order.symbol, "BTC");
}

// EVEN BETTER: Handle error explicitly
#[test]
fn test_something() {
    let order = match create_test_order() {
        Ok(o) => o,
        Err(e) => panic!("Test fixture creation failed: {}\nDebug: {:?}", e, e),
    };
    assert_eq!(order.symbol, "BTC");
}
```

**Why it matters:** `.expect()` with a message tells you exactly what failed. `.unwrap()` just panics with "called Option::unwrap() on a None value" — unhelpful. Always include context.

---

## Testing Implementation Details Instead of Behavior

### Asserting on Private Fields

```rust
// WRONG: Tests implementation, breaks on refactoring
#[test]
fn validate_order_sets_internal_state() {
    let mut order = Order::default();
    validate(&mut order);
    assert_eq!(order.internal_flag, true);  // Private field!
}

// CORRECT: Test observable behavior
#[test]
fn validate_order_allows_execution() {
    let order = Order::default();
    let result = order.can_execute();
    assert!(result);  // Tests behavior, not internals
}

// CORRECT: Test through public interface
#[test]
fn validate_sets_status_correctly() {
    let order = OrderBuilder::new().symbol("BTC-USD").build();
    let validated = order.validate().unwrap();

    // Check public status, not internal flags
    assert_eq!(validated.status(), OrderStatus::Valid);
}
```

**Why it matters:** If you test implementation details (private fields, internal states), any refactoring breaks tests even if behavior is unchanged. Test the public interface, not the guts.

---

## Shared Mutable State Between Tests

### Static Mut State Across Tests

```rust
// WRONG: Tests interfere with each other
static mut COUNTER: u32 = 0;

#[test]
fn test_one() {
    unsafe { COUNTER += 1; }
    assert_eq!(unsafe { COUNTER }, 1);
}

#[test]
fn test_two() {
    unsafe { COUNTER += 1; }
    // COUNTER might be 2 if test_one ran first!
    assert_eq!(unsafe { COUNTER }, 1);  // FAILS if tests run in order
}

// CORRECT: Use local state or thread-local storage
#[test]
fn test_one() {
    let mut counter = 0;
    counter += 1;
    assert_eq!(counter, 1);
}

// CORRECT: For shared setup, use Arc + Mutex
#[tokio::test]
async fn test_concurrent_access() {
    let counter = Arc::new(Mutex::new(0));
    let c1 = counter.clone();
    let c2 = counter.clone();

    let t1 = tokio::spawn(async move {
        let mut guard = c1.lock().await;
        *guard += 1;
    });
    let t2 = tokio::spawn(async move {
        let mut guard = c2.lock().await;
        *guard += 1;
    });

    tokio::join!(t1, t2);
    assert_eq!(*counter.lock().await, 2);
}
```

**Why it matters:** Tests run in parallel by default. Shared mutable state causes race conditions, making tests flaky (pass sometimes, fail randomly).

---

## Only Testing the Happy Path

### Missing Error Cases

```rust
// WRONG: Only tests success
#[test]
fn parse_order_succeeds() {
    let json = r#"{"symbol":"BTC","qty":1.5}"#;
    let order = parse_order(json).unwrap();
    assert_eq!(order.symbol, "BTC");
}

// CORRECT: Test error variants too
#[test]
fn parse_order_fails_on_invalid_json() {
    let json = "not json";
    let result = parse_order(json);
    assert!(matches!(result, Err(ParseError::InvalidJson)));
}

#[test]
fn parse_order_fails_on_missing_symbol() {
    let json = r#"{"qty":1.5}"#;
    let result = parse_order(json);
    assert!(matches!(result, Err(ParseError::MissingField("symbol"))));
}

#[test]
fn parse_order_fails_on_negative_quantity() {
    let json = r#"{"symbol":"BTC","qty":-1.5}"#;
    let result = parse_order(json);
    assert!(matches!(result, Err(ParseError::InvalidQuantity)));
}
```

**Why it matters:** Error paths are where bugs hide. Happy path tests only catch 50% of issues. Test error cases with specific error types, not just `Err(_)`.

---

## Sleep-Based Timing in Async Tests (Flaky Tests)

### Using Real Time in Tests

```rust
// WRONG: Flaky! Timing varies on slow machines
#[tokio::test]
async fn retry_after_delay() {
    let mut attempt = 0;

    loop {
        attempt += 1;
        match risky_operation().await {
            Ok(v) => break v,
            Err(_) if attempt < 3 => {
                tokio::time::sleep(Duration::from_millis(100)).await;  // Real time!
            }
            Err(e) => panic!("{}", e),
        }
    }

    // Test might pass on fast hardware, fail on slow CI
}

// CORRECT: Pause clock, advance deterministically
#[tokio::test]
async fn retry_after_delay() {
    tokio::time::pause();  // Freeze clock

    let mut attempt = 0;
    let mut next_retry = Duration::from_millis(100);

    loop {
        attempt += 1;
        match risky_operation().await {
            Ok(v) => break v,
            Err(_) if attempt < 3 => {
                tokio::time::advance(next_retry).await;  // Skip time
                next_retry *= 2;
            }
            Err(e) => panic!("{}", e),
        }
    }

    // Test completes instantly, deterministic
}

// CORRECT: For timeout tests
#[tokio::test]
async fn operation_times_out() {
    tokio::time::pause();

    let result = tokio::time::timeout(
        Duration::from_millis(100),
        tokio::time::sleep(Duration::from_secs(10))
    ).await;

    assert!(matches!(result, Err(tokio::time::error::Elapsed)));
    // Instant test, no sleeping
}
```

**Why it matters:** Real time makes tests flaky (intermittent failures on CI). `tokio::time::pause()` freezes the clock, letting you fast-forward test time. Tests run instantly and are deterministic.

---

## Not Cleaning Up Database State

### Test Pollution from Database

```rust
// WRONG: Tests contaminate each other
#[tokio::test]
async fn insert_order() {
    let pool = create_pool().await;

    sqlx::query("INSERT INTO orders ...")
        .execute(&pool)
        .await
        .unwrap();

    assert_eq!(count_orders(&pool).await, 1);
}

#[tokio::test]
async fn count_orders() {
    let pool = create_pool().await;

    // If previous test ran first, might see stale data
    assert_eq!(count_orders(&pool).await, 0);  // FAILS!
}

// CORRECT: Use #[sqlx::test] macro (auto-rollback)
#[sqlx::test]
async fn insert_order(pool: PgPool) {
    sqlx::query("INSERT INTO orders ...")
        .execute(&pool)
        .await
        .unwrap();

    assert_eq!(count_orders(&pool).await, 1);
    // Auto-rollback after test
}

#[sqlx::test]
async fn count_orders(pool: PgPool) {
    // Fresh transaction, no stale data
    assert_eq!(count_orders(&pool).await, 0);
}

// CORRECT: Manual cleanup with explicit drop
#[tokio::test]
async fn some_test() {
    let pool = create_pool().await;
    let tx = pool.begin().await.unwrap();

    // ... test code ...

    tx.rollback().await.unwrap();  // Explicit cleanup
}
```

**Why it matters:** Without cleanup, tests pollute the database. Second test sees data from first test, causing spurious failures. Use `#[sqlx::test]` for automatic rollback.

---

## Over-Mocking: Mocking Mocks, Not Code

### Mocking Everything Instead of Testing Real Behavior

```rust
// WRONG: Mocking too much, not testing real code
#[tokio::test]
async fn portfolio_value_calculation() {
    let mut mock_cache = MockCache::new();
    let mut mock_price = MockPriceSource::new();
    let mut mock_portfolio = MockPortfolio::new();

    mock_cache.expect_get("BTC").returning(|| dec!(50000));
    mock_price.expect_price("BTC").returning(|| dec!(50000));
    mock_portfolio.expect_holdings().returning(|| vec![...]);

    // Now you're testing the mocks, not your code!
    let value = calculate_portfolio_value(&mock_cache, &mock_price, &mock_portfolio).await;
    assert_eq!(value, dec!(75000));
}

// CORRECT: Mock external dependencies, test real logic
#[tokio::test]
async fn portfolio_value_calculation() {
    struct MockPriceSource {
        prices: HashMap<String, Decimal>,
    }

    impl PriceSource for MockPriceSource {
        async fn get(&self, symbol: &str) -> Result<Decimal, Error> {
            Ok(self.prices[symbol])
        }
    }

    // Use real Portfolio struct with real calculations
    let mut source = MockPriceSource::new();
    source.prices.insert("BTC".to_string(), dec!(50000));
    source.prices.insert("ETH".to_string(), dec!(3000));

    let portfolio = Portfolio::new(vec![
        Holding::new("BTC", dec!(1.5)),
        Holding::new("ETH", dec!(10)),
    ]);

    // Test the real portfolio value calculation
    let value = portfolio.total_value(&source).await.unwrap();
    assert_eq!(value, dec!(105000));  // 1.5*50000 + 10*3000
}
```

**Why it matters:** Over-mocking makes tests worthless. You end up testing the mocks, not your actual code. Mock external dependencies (APIs, databases), test real domain logic.

---

## Hardcoded Ports and File Paths

### Port Conflicts in Tests

```rust
// WRONG: Fixed port, conflicts with other processes
#[tokio::test]
async fn start_server() {
    let listener = TcpListener::bind("127.0.0.1:8080").await.unwrap();
    // If another test or process uses port 8080, FAILS
}

// CORRECT: Use port 0 for random assignment
#[tokio::test]
async fn start_server() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let port = addr.port();

    // Use dynamically assigned port
    let client = reqwest::Client::new();
    let response = client.get(&format!("http://127.0.0.1:{}", port)).send().await;
    // ...
}

// WRONG: Hardcoded file paths
#[test]
fn load_config() {
    let config = load_file("/home/user/test_config.json").unwrap();
    assert_eq!(config.key, "value");
}

// CORRECT: Use temp directory
#[test]
fn load_config() {
    use std::fs;
    let dir = tempfile::TempDir::new().unwrap();
    let path = dir.path().join("config.json");
    fs::write(&path, r#"{"key":"value"}"#).unwrap();

    let config = load_file(&path).unwrap();
    assert_eq!(config.key, "value");
    // Dir auto-cleaned on drop
}
```

**Why it matters:** Fixed ports cause "Address already in use" errors in CI. Hardcoded paths fail on different machines. Dynamic ports and temp directories work everywhere.

---

## Missing `Send + Sync` Bounds on Mocks for Async Tests

### Mock Not Working in Spawned Tasks

```rust
// WRONG: Mock doesn't implement Send
struct MockPriceSource {
    prices: std::cell::RefCell<HashMap<String, Decimal>>,  // Not Send!
}

#[tokio::test]
async fn test_with_spawned_task() {
    let mock = MockPriceSource::new();

    tokio::spawn(async {
        let price = mock.get_price("BTC").await;  // ERROR: MockPriceSource not Send
        assert!(price > dec!(0));
    }).await.unwrap();
}

// CORRECT: Ensure mock is Send + Sync
struct MockPriceSource {
    prices: Arc<std::sync::Mutex<HashMap<String, Decimal>>>,  // Send + Sync!
}

#[tokio::test]
async fn test_with_spawned_task() {
    let mock = Arc::new(MockPriceSource::new());

    let mock_clone = mock.clone();
    tokio::spawn(async move {
        let price = mock_clone.get_price("BTC").await;
        assert!(price > dec!(0));
    }).await.unwrap();
}
```

**Why it matters:** `tokio::spawn()` requires `Send` bounds. `RefCell`, `Rc`, non-thread-safe containers violate this. Use `Arc<Mutex<_>>` or `Arc<RwLock<_>>` for thread-safe mocks.

---

## Snapshot Testing Entire Structs (Too Brittle)

### Overly Specific Snapshot Tests

```rust
// WRONG: Snapshot breaks on any field change
#[test]
fn serialize_order() {
    let order = Order {
        id: Uuid::nil(),
        symbol: "BTC-USD".to_string(),
        side: Side::Buy,
        quantity: dec!(1.5),
        price: dec!(50000),
        created_at: "2024-01-01T00:00:00Z".parse().unwrap(),
    };

    let json = serde_json::to_string(&order).unwrap();
    assert_eq!(json, r#"{"id":"00000000-0000-0000-0000-000000000000","symbol":"BTC-USD","side":"Buy","quantity":"1.5","price":"50000","created_at":"2024-01-01T00:00:00Z"}"#);
    // If you add a field, this test breaks even if behavior is correct
}

// CORRECT: Assert key fields, not entire snapshot
#[test]
fn serialize_order() {
    let order = Order {
        id: Uuid::nil(),
        symbol: "BTC-USD".to_string(),
        side: Side::Buy,
        quantity: dec!(1.5),
        price: dec!(50000),
        created_at: Utc::now(),
    };

    let json = serde_json::to_string(&order).unwrap();
    let deserialized: Order = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.symbol, "BTC-USD");
    assert_eq!(deserialized.quantity, dec!(1.5));
    assert_eq!(deserialized.side, Side::Buy);
    // Test behavior (round-trip), not exact string match
}

// CORRECT: Use insta crate for actual snapshot testing
#[test]
fn serialize_order() {
    let order = Order {
        id: Uuid::nil(),
        symbol: "BTC-USD".to_string(),
        ..Default::default()
    };

    let json = serde_json::to_string(&order).unwrap();
    insta::assert_snapshot!(json);  // Auto-updates on intentional changes
}
```

**Why it matters:** Brittle snapshots break on refactoring even when behavior is unchanged. Test behavior (round-trip serialization), not exact strings. Use `insta` crate if you need snapshots.

---

## Not Testing Edge Cases for Financial Calculations

### Missing Boundary Tests

```rust
// WRONG: Only tests normal cases
#[test]
fn calculate_profit() {
    assert_eq!(calc_profit(dec!(50000), dec!(60000)), dec!(10000));
}

// CORRECT: Test boundaries, zeros, extremes
#[test]
fn calculate_profit_with_equal_prices() {
    assert_eq!(calc_profit(dec!(50000), dec!(50000)), dec!(0));
}

#[test]
fn calculate_profit_with_zero_quantity() {
    assert_eq!(calc_profit(dec!(0), dec!(60000)), dec!(0));
}

#[test]
fn calculate_profit_with_loss() {
    assert_eq!(calc_profit(dec!(60000), dec!(50000)), dec!(-10000));
}

#[test]
fn calculate_profit_with_large_numbers() {
    // Test decimal precision
    assert_eq!(
        calc_profit(dec!(0.00001), dec!(0.00002)),
        dec!(0.00001)
    );
}

#[test]
fn calculate_slippage_at_zero_liquidity() {
    let result = calc_slippage(dec!(0), dec!(1000));
    assert!(matches!(result, Err(SlippageError::ZeroLiquidity)));
}
```

**Why it matters:** Financial calculations hide bugs at boundaries. Zero, negative, very large numbers, and precision edge cases are where overflow and precision loss occur.

---

## Forgetting `#[should_panic(expected = "...")]`

### Not Specifying Expected Panic Message

```rust
// WRONG: Too broad, passes on any panic
#[test]
#[should_panic]
fn operation_panics() {
    risky_operation();
}

// Now if someone changes the panic message, test still passes
// But if you removed the panic entirely, test fails (good!)

// CORRECT: Specify expected message
#[test]
#[should_panic(expected = "insufficient balance")]
fn operation_panics_with_message() {
    Order::new(dec!(100), dec!(1000_000));  // More than balance
}

// BETTER: Use Result type instead
#[test]
fn operation_returns_error() {
    let result = try_operation(dec!(100), dec!(1000_000));
    assert!(matches!(result, Err(OrderError::InsufficientBalance)));
}
```

**Why it matters:** `#[should_panic]` is a code smell. Returning `Result` and testing the error variant is more precise. If you must test panics, specify the exact message.

---

## Testing Without Checking Parallel Execution

### Tests That Break When Run in Parallel

```rust
// WRONG: Assumes sequential execution
#[test]
fn test_global_counter_increment() {
    global_counter().reset();
    global_counter().increment();
    assert_eq!(global_counter().value(), 1);
}

// If tests run in parallel, another test might increment it!

// CORRECT: Run with --test-threads=1 to catch issues
// cargo test -- --test-threads=1

// BETTER: Make tests truly isolated
#[test]
fn test_counter_increment() {
    let counter = Counter::new();
    counter.increment();
    assert_eq!(counter.value(), 1);
}
```

**Why it matters:** Tests that pass sequentially fail in parallel (CI). Always test with `--test-threads=1` if you suspect race conditions.

---

## Checklist Before Submitting

- [ ] All async tests use `#[tokio::test]`?
- [ ] No `.unwrap()` in test setup without `.expect("context")`?
- [ ] Testing public behavior, not implementation details?
- [ ] No static mut or shared mutable state?
- [ ] Error cases tested with specific error variants?
- [ ] No sleep-based timing (using `tokio::time::pause()` instead)?
- [ ] Database tests using `#[sqlx::test]` or transaction rollback?
- [ ] Mocks are `Send + Sync` for spawned tasks?
- [ ] Edge cases tested (zero, negative, overflow)?
- [ ] No hardcoded ports (using 0) or file paths (using temp)?
- [ ] Over-mocking avoided (mock external deps, test real code)?
- [ ] Tests verified to run in parallel (`--test-threads=1`)?
