---
name: rust-testing
description: >
  Call this skill when writing or reviewing tests for Rust code.
  Covers unit tests, integration tests, async test patterns, mocking,
  test fixtures, property-based testing, and benchmark tests.
  Includes patterns for testing async code with tokio, database tests
  with sqlx, and WebSocket/HTTP client tests.
invocation: auto
---

# Rust Testing Patterns

## Testing Philosophy

Tests should validate **behavior**, not implementation details. Every test follows the **Arrange → Act → Assert** pattern:

1. **Arrange**: Set up test data and mocks
2. **Act**: Call the function/method under test
3. **Assert**: Verify the result

### Test Naming Convention

Use descriptive names that explain what is being tested and the expected outcome:

```rust
// Pattern 1: test_[function]_[scenario]_[expected]
#[test]
fn test_calculate_slippage_with_zero_liquidity_returns_error() { }

// Pattern 2: [function]_[does_what] — simpler for happy path
#[test]
fn calculate_slippage_computes_correct_percent() { }

// Pattern 3: [function]_returns_error_when_[condition]
#[test]
fn calculate_slippage_returns_error_when_liquidity_is_zero() { }
```

### Testing Principles

- **One assertion focus per test**: Each test validates one behavior
- **Deterministic**: No randomness, timing, or flakiness. All tests must pass consistently
- **Isolated**: Tests don't depend on each other, no shared mutable state
- **Fast**: Unit tests < 10ms each, integration tests < 1s each
- **Clear on failure**: Assertion message explains what went wrong

---

## Unit Tests

Unit tests live in the same file as the code, in a `#[cfg(test)]` module.

### Basic Unit Test Structure

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculate_margin_uses_correct_formula() {
        // Arrange
        let balance = dec!(10000);
        let leverage = dec!(2);

        // Act
        let margin = calculate_required_margin(balance, leverage);

        // Assert
        assert_eq!(margin, dec!(5000));
    }

    #[test]
    fn calculate_margin_returns_error_when_leverage_exceeds_max() {
        // Arrange
        let balance = dec!(10000);
        let max_leverage = dec!(10);
        let excess_leverage = dec!(11);

        // Act
        let result = calculate_required_margin_checked(balance, excess_leverage, max_leverage);

        // Assert
        assert!(matches!(result, Err(TradeError::LeverageTooHigh)));
    }
}
```

### Testing Result Types

```rust
#[test]
fn parse_order_succeeds_with_valid_json() {
    let json = r#"{"symbol":"BTC-USD","side":"Buy","qty":1.5}"#;
    let result = parse_order(json);

    // Assert Ok variant and extract value
    assert!(result.is_ok());
    let order = result.unwrap();
    assert_eq!(order.symbol, "BTC-USD");
}

#[test]
fn parse_order_fails_with_invalid_json() {
    let json = "not valid json";
    let result = parse_order(json);

    // Assert specific error variant
    assert!(matches!(result, Err(ParseError::InvalidJson)));
}

#[test]
fn parse_order_fails_with_missing_symbol() {
    let json = r#"{"side":"Buy","qty":1.5}"#;
    let result = parse_order(json);

    // Assert error and check message
    match result {
        Err(e) => assert_eq!(e.to_string(), "missing required field: symbol"),
        Ok(_) => panic!("Expected error but got Ok"),
    }
}
```

### Testing Option Types

```rust
#[test]
fn find_position_returns_some_when_position_exists() {
    let book = create_test_orderbook();
    let pos = book.find_position("trader1", "BTC-USD");

    assert!(pos.is_some());
    assert_eq!(pos.unwrap().quantity, dec!(5));
}

#[test]
fn find_position_returns_none_when_position_not_found() {
    let book = create_test_orderbook();
    let pos = book.find_position("nonexistent", "BTC-USD");

    assert!(pos.is_none());
}
```

### Custom Assert Macros for Domain Logic

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Define custom assertions for your domain
    macro_rules! assert_order_valid {
        ($order:expr) => {
            assert!($order.quantity > dec!(0), "quantity must be positive");
            assert!($order.price > dec!(0), "price must be positive");
            assert!(
                matches!($order.side, Side::Buy | Side::Sell),
                "side must be Buy or Sell"
            );
        };
    }

    #[test]
    fn create_order_produces_valid_order() {
        let order = Order {
            id: Uuid::new_v4(),
            symbol: "BTC-USD".to_string(),
            side: Side::Buy,
            quantity: dec!(2.5),
            price: dec!(50000),
            created_at: Utc::now(),
        };

        assert_order_valid!(order);
    }
}
```

### Testing Private Functions

Private functions are tested through the public interface or directly in the same module:

```rust
fn private_validate_qty(qty: Decimal) -> Result<(), QtyError> {
    if qty <= dec!(0) {
        return Err(QtyError::NegativeOrZero);
    }
    Ok(())
}

pub fn create_order(qty: Decimal) -> Result<Order, OrderError> {
    private_validate_qty(qty)?;
    // ...
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_validate_qty_rejects_zero() {
        let result = private_validate_qty(dec!(0));
        assert!(matches!(result, Err(QtyError::NegativeOrZero)));
    }

    #[test]
    fn private_validate_qty_accepts_positive() {
        let result = private_validate_qty(dec!(1.5));
        assert!(result.is_ok());
    }
}
```

### Complete Unit Test Module Template

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    // Shared setup
    fn create_test_order() -> Order {
        Order {
            id: Uuid::new_v4(),
            symbol: "BTC-USD".to_string(),
            side: Side::Buy,
            quantity: dec!(1.5),
            price: dec!(50000),
            created_at: Utc::now(),
        }
    }

    // Happy path test
    #[test]
    fn execute_order_updates_position() {
        let mut book = Orderbook::new();
        let order = create_test_order();

        book.execute(&order);

        assert_eq!(book.position_count(), 1);
        let pos = book.find_position("trader1", "BTC-USD").unwrap();
        assert_eq!(pos.quantity, dec!(1.5));
    }

    // Error path test
    #[test]
    fn execute_order_returns_error_when_balance_insufficient() {
        let mut book = Orderbook::with_balance(dec!(1000));
        let mut order = create_test_order();
        order.price = dec!(100000);  // Requires 150k balance

        let result = book.try_execute(&order);

        assert!(matches!(result, Err(ExecuteError::InsufficientBalance)));
    }

    // Edge case test
    #[test]
    fn execute_order_handles_minimum_notional() {
        let order = Order {
            quantity: dec!(0.00001),
            price: dec!(50000),
            ..create_test_order()
        };

        // Notional = 0.5 USD (below 1 USD minimum)
        let result = validate_notional(&order);
        assert!(matches!(result, Err(OrderError::BelowMinNotional)));
    }
}
```

---

## Integration Tests

Integration tests live in `/tests/` directory and test complete workflows end-to-end.

### File Structure

```
src/
  lib.rs
  jobs/
    mod.rs
    email.rs
tests/
  common/
    mod.rs        # Shared setup
  integration_test.rs
  job_tests.rs
```

### Shared Test Utilities

Create `/tests/common/mod.rs` for shared test helpers:

```rust
// /tests/common/mod.rs
use uuid::Uuid;
use rust_decimal_macros::dec;

pub struct TestDb {
    pub pool: sqlx::PgPool,
}

impl TestDb {
    pub async fn new() -> Self {
        let database_url = std::env::var("TEST_DATABASE_URL")
            .expect("TEST_DATABASE_URL must be set");

        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Migrations failed");

        Self { pool }
    }

    pub async fn cleanup(&self) {
        sqlx::query("TRUNCATE TABLE orders CASCADE")
            .execute(&self.pool)
            .await
            .ok();
    }
}

pub fn create_test_order() -> Order {
    Order {
        id: Uuid::new_v4(),
        symbol: "BTC-USD".to_string(),
        side: Side::Buy,
        quantity: dec!(1.5),
        price: dec!(50000),
        created_at: Utc::now(),
    }
}
```

### Integration Test Template

```rust
// /tests/job_tests.rs
mod common;

use common::{TestDb, create_test_order};

#[tokio::test]
async fn job_enqueue_and_process_workflow() {
    let db = TestDb::new().await;

    // Arrange
    let order = create_test_order();
    let queue = JobQueue::new(&db.pool).await.unwrap();

    // Act
    let job_id = queue.enqueue_process_order(&order).await.unwrap();

    // Wait for job to process (in real scenario)
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Assert
    let job = queue.get_job(job_id).await.unwrap();
    assert_eq!(job.status, JobStatus::Completed);
    assert_eq!(job.result, "processed");

    db.cleanup().await;
}

#[tokio::test]
async fn job_retries_on_transient_error() {
    let db = TestDb::new().await;

    // Arrange
    let queue = JobQueue::new(&db.pool).await.unwrap();
    let failing_order = create_test_order_that_fails_first_attempt();

    // Act
    let job_id = queue.enqueue_process_order(&failing_order).await.unwrap();

    // Wait for retries
    for _ in 0..3 {
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    // Assert
    let job = queue.get_job(job_id).await.unwrap();
    assert_eq!(job.attempt_count, 2);  // Failed once, succeeded on retry
    assert_eq!(job.status, JobStatus::Completed);

    db.cleanup().await;
}
```

---

## Async Test Patterns

### Basic Async Tests

Use `#[tokio::test]` for async functions:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn fetch_price_from_api_succeeds() {
        let client = create_test_http_client();
        let price = client.get_price("BTC").await.unwrap();

        assert!(price > dec!(0));
    }

    // Multi-threaded runtime for tests requiring concurrency
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn concurrent_orders_don_interfere() {
        let book = Arc::new(Orderbook::new());

        let task1 = {
            let b = book.clone();
            tokio::spawn(async move {
                b.execute(&create_test_order()).await
            })
        };

        let task2 = {
            let b = book.clone();
            tokio::spawn(async move {
                b.execute(&create_test_order()).await
            })
        };

        let (r1, r2) = tokio::join!(task1, task2);
        assert!(r1.is_ok());
        assert!(r2.is_ok());
    }
}
```

### Testing Timeouts

```rust
#[tokio::test]
async fn slow_operation_times_out() {
    let slow_op = tokio::time::sleep(Duration::from_secs(10));

    let result = tokio::time::timeout(Duration::from_millis(100), slow_op).await;

    assert!(matches!(result, Err(tokio::time::error::Elapsed)));
}

#[tokio::test]
async fn operation_completes_before_timeout() {
    let fast_op = async {
        tokio::time::sleep(Duration::from_millis(10)).await;
        "done"
    };

    let result = tokio::time::timeout(Duration::from_secs(1), fast_op).await;

    assert_eq!(result.unwrap(), "done");
}
```

### Testing Channels

```rust
#[tokio::test]
async fn channel_sends_and_receives_message() {
    let (tx, mut rx) = tokio::sync::mpsc::channel(10);

    // Spawn sender
    tokio::spawn(async move {
        tx.send("hello").await.unwrap();
    });

    // Receive
    let msg = rx.recv().await.unwrap();
    assert_eq!(msg, "hello");
}

#[tokio::test]
async fn channel_close_breaks_recv_loop() {
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(10);
    drop(tx);  // Close sender side

    // Recv should return None
    let msg = rx.recv().await;
    assert!(msg.is_none());
}

#[tokio::test]
async fn broadcast_channel_delivers_to_all_subscribers() {
    let (tx, mut rx1) = tokio::sync::broadcast::channel(10);
    let mut rx2 = tx.subscribe();

    tx.send("msg1").unwrap();

    assert_eq!(rx1.recv().await.unwrap(), "msg1");
    assert_eq!(rx2.recv().await.unwrap(), "msg1");
}
```

### Testing Spawned Tasks

```rust
#[tokio::test]
async fn spawned_task_completes_successfully() {
    let handle = tokio::spawn(async {
        expensive_computation().await
    });

    let result = handle.await.unwrap();
    assert_eq!(result, 42);
}

#[tokio::test]
async fn select_cancels_losing_task() {
    let sleep_future = tokio::time::sleep(Duration::from_secs(10));
    let quick_future = async { "done" };

    let result = tokio::select! {
        _ = sleep_future => "sleep won",
        val = quick_future => val,
    };

    assert_eq!(result, "done");
}
```

### Deterministic Async Testing with `tokio::time::pause()`

Avoid flaky time-dependent tests by pausing the clock:

```rust
#[tokio::test]
async fn retries_after_exponential_backoff() {
    tokio::time::pause();  // Freeze time

    let mut attempt = 0;
    let mut next_retry = Duration::from_secs(1);

    while attempt < 3 {
        attempt += 1;
        if attempt > 1 {
            tokio::time::advance(next_retry).await;
        }
        next_retry *= 2;
    }

    // No real time elapsed, test runs instantly
    assert_eq!(attempt, 3);
}

#[tokio::test]
async fn timeout_fires_at_correct_time() {
    tokio::time::pause();

    let result = tokio::time::timeout(
        Duration::from_millis(100),
        async {
            loop { tokio::task::yield_now().await; }
        }
    ).await;

    assert!(matches!(result, Err(tokio::time::error::Elapsed)));
}
```

---

## Database Testing with sqlx

### Using `#[sqlx::test]` Macro

The `#[sqlx::test]` macro automatically runs migrations and rolls back after each test:

```rust
// Cargo.toml
[dev-dependencies]
sqlx = { version = "0.7", features = ["postgres", "macros", "migrate"] }

// src/lib.rs
#[cfg(test)]
mod tests {
    use sqlx::postgres::PgPool;

    #[sqlx::test]
    async fn insert_order_and_retrieve(pool: PgPool) {
        // Arrange
        let order = Order {
            id: Uuid::new_v4(),
            symbol: "BTC-USD".to_string(),
            quantity: dec!(1.5),
            created_at: Utc::now(),
        };

        // Act
        sqlx::query(
            "INSERT INTO orders (id, symbol, quantity, created_at) VALUES ($1, $2, $3, $4)"
        )
        .bind(order.id)
        .bind(&order.symbol)
        .bind(order.quantity)
        .bind(order.created_at)
        .execute(&pool)
        .await
        .unwrap();

        // Assert
        let retrieved = sqlx::query_as::<_, Order>(
            "SELECT id, symbol, quantity, created_at FROM orders WHERE id = $1"
        )
        .bind(order.id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(retrieved.symbol, "BTC-USD");
        assert_eq!(retrieved.quantity, dec!(1.5));

        // Transaction auto-rolls back after test
    }

    #[sqlx::test]
    async fn delete_cascades_correctly(pool: PgPool) {
        // Setup
        let trader_id = Uuid::new_v4();
        sqlx::query("INSERT INTO traders (id, name) VALUES ($1, $2)")
            .bind(trader_id)
            .bind("Alice")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query("INSERT INTO positions (trader_id, symbol) VALUES ($1, $2)")
            .bind(trader_id)
            .bind("BTC-USD")
            .execute(&pool)
            .await
            .unwrap();

        // Act: Delete trader
        sqlx::query("DELETE FROM traders WHERE id = $1")
            .bind(trader_id)
            .execute(&pool)
            .await
            .unwrap();

        // Assert: Positions should be deleted too
        let position_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM positions WHERE trader_id = $1"
        )
        .bind(trader_id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(position_count, 0);
    }
}
```

### Database Test Fixtures with `.sqlx` Files

Store SQL setup in `sqlx-data.json` or separate fixture files:

```rust
// tests/fixtures/trader_with_positions.sql
INSERT INTO traders (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'Bob');

INSERT INTO positions (trader_id, symbol, quantity) VALUES
  ('11111111-1111-1111-1111-111111111111', 'BTC-USD', 1.5),
  ('11111111-1111-1111-1111-111111111111', 'ETH-USD', 10.0),
  ('22222222-2222-2222-2222-222222222222', 'BTC-USD', 0.5);

// In test code:
#[sqlx::test]
async fn list_trader_positions(pool: PgPool) {
    // Load fixture
    let fixture = include_str!("fixtures/trader_with_positions.sql");
    sqlx::raw_sql(fixture).execute(&pool).await.unwrap();

    // Test query
    let positions = sqlx::query_as::<_, Position>(
        "SELECT trader_id, symbol, quantity FROM positions WHERE trader_id = $1"
    )
    .bind(uuid!("11111111-1111-1111-1111-111111111111"))
    .fetch_all(&pool)
    .await
    .unwrap();

    assert_eq!(positions.len(), 2);
}
```

---

## Mocking Patterns

### Trait-Based Mocking

Define traits for dependencies so you can inject mocks:

```rust
// Real implementation
pub trait PriceSource {
    async fn get_price(&self, symbol: &str) -> Result<Decimal, PriceError>;
}

pub struct ApiPriceSource {
    client: reqwest::Client,
}

impl PriceSource for ApiPriceSource {
    async fn get_price(&self, symbol: &str) -> Result<Decimal, PriceError> {
        let resp = self.client.get(&format!("https://api.example.com/prices/{}", symbol))
            .send()
            .await?;
        Ok(resp.json().await?)
    }
}

// Mock implementation for tests
#[cfg(test)]
mod tests {
    use super::*;

    struct MockPriceSource {
        prices: std::collections::HashMap<String, Decimal>,
    }

    impl MockPriceSource {
        fn new() -> Self {
            Self {
                prices: [
                    ("BTC".to_string(), dec!(50000)),
                    ("ETH".to_string(), dec!(3000)),
                ].iter().cloned().collect(),
            }
        }
    }

    #[async_trait::async_trait]
    impl PriceSource for MockPriceSource {
        async fn get_price(&self, symbol: &str) -> Result<Decimal, PriceError> {
            self.prices.get(symbol)
                .copied()
                .ok_or(PriceError::SymbolNotFound(symbol.to_string()))
        }
    }

    #[tokio::test]
    async fn calculate_portfolio_value_with_mock_prices() {
        let price_source = MockPriceSource::new();
        let portfolio = Portfolio::new(vec![
            Holding { symbol: "BTC".to_string(), quantity: dec!(1) },
            Holding { symbol: "ETH".to_string(), quantity: dec!(10) },
        ]);

        let value = portfolio.total_value(&price_source).await.unwrap();

        assert_eq!(value, dec!(80000));  // 50000 + 30000
    }
}
```

### Using `mockall` Crate for Automatic Mocking

```rust
// Cargo.toml
[dev-dependencies]
mockall = "0.12"

// Your code
use mockall::predicate::*;
use mockall::mock;

mock! {
    PriceSource {
        async fn get_price(&self, symbol: &str) -> Result<Decimal, PriceError>;
    }
}

#[tokio::test]
async fn calculate_with_mocked_prices() {
    let mut mock = MockPriceSource::new();

    // Set expectations
    mock.expect_get_price()
        .with(eq("BTC"))
        .times(1)
        .returning(|_| Ok(dec!(50000)));

    mock.expect_get_price()
        .with(eq("ETH"))
        .times(1)
        .returning(|_| Ok(dec!(3000)));

    let portfolio = Portfolio::new(vec![
        Holding { symbol: "BTC".to_string(), quantity: dec!(1) },
        Holding { symbol: "ETH".to_string(), quantity: dec!(10) },
    ]);

    let value = portfolio.total_value(&mock).await.unwrap();

    assert_eq!(value, dec!(80000));
    // Expectations are verified automatically when mock is dropped
}
```

### Mocking HTTP Clients with `wiremock`

```rust
// Cargo.toml
[dev-dependencies]
wiremock = "0.5"

#[tokio::test]
async fn api_client_handles_server_error() {
    use wiremock::{Mock, MockServer, ResponseTemplate};
    use wiremock::matchers::method;

    let mock_server = MockServer::start().await;

    // Setup mock endpoint
    Mock::given(method("GET"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let client = ApiClient::new(&mock_server.uri());
    let result = client.get_prices().await;

    assert!(matches!(result, Err(ApiError::ServerError)));
}

#[tokio::test]
async fn api_client_parses_response() {
    use wiremock::{Mock, MockServer, ResponseTemplate};
    use wiremock::matchers::{method, path};

    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/prices"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "BTC": 50000,
            "ETH": 3000,
        })))
        .mount(&mock_server)
        .await;

    let client = ApiClient::new(&mock_server.uri());
    let prices = client.get_prices().await.unwrap();

    assert_eq!(prices.get("BTC"), Some(&dec!(50000)));
}
```

### Mocking Redis

Use trait abstraction or fake-redis for tests:

```rust
// Trait-based approach
pub trait Cache {
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, CacheError>;
    async fn set(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockCache {
        data: std::sync::Arc<tokio::sync::Mutex<std::collections::HashMap<String, Vec<u8>>>>,
    }

    impl MockCache {
        fn new() -> Self {
            Self {
                data: std::sync::Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new())),
            }
        }
    }

    #[async_trait::async_trait]
    impl Cache for MockCache {
        async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, CacheError> {
            Ok(self.data.lock().await.get(key).cloned())
        }

        async fn set(&self, key: &str, value: Vec<u8>, _ttl: Duration) -> Result<(), CacheError> {
            self.data.lock().await.insert(key.to_string(), value);
            Ok(())
        }
    }

    #[tokio::test]
    async fn cache_stores_and_retrieves_value() {
        let cache = MockCache::new();

        cache.set("key1", b"value1".to_vec(), Duration::from_secs(60)).await.unwrap();
        let value = cache.get("key1").await.unwrap();

        assert_eq!(value, Some(b"value1".to_vec()));
    }
}
```

---

## Test Fixtures and Factories

### Builder Pattern for Test Data

```rust
pub struct OrderBuilder {
    id: Uuid,
    symbol: String,
    side: Side,
    quantity: Decimal,
    price: Decimal,
    created_at: DateTime<Utc>,
}

impl OrderBuilder {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4(),
            symbol: "BTC-USD".to_string(),
            side: Side::Buy,
            quantity: dec!(1),
            price: dec!(50000),
            created_at: Utc::now(),
        }
    }

    pub fn symbol(mut self, symbol: &str) -> Self {
        self.symbol = symbol.to_string();
        self
    }

    pub fn quantity(mut self, qty: Decimal) -> Self {
        self.quantity = qty;
        self
    }

    pub fn side(mut self, side: Side) -> Self {
        self.side = side;
        self
    }

    pub fn build(self) -> Order {
        Order {
            id: self.id,
            symbol: self.symbol,
            side: self.side,
            quantity: self.quantity,
            price: self.price,
            created_at: self.created_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_with_custom_symbol() {
        let order = OrderBuilder::new()
            .symbol("ETH-USD")
            .quantity(dec!(10))
            .build();

        assert_eq!(order.symbol, "ETH-USD");
        assert_eq!(order.quantity, dec!(10));
    }
}
```

### Default Trait for Simple Test Data

```rust
impl Default for Order {
    fn default() -> Self {
        Order {
            id: Uuid::new_v4(),
            symbol: "BTC-USD".to_string(),
            side: Side::Buy,
            quantity: dec!(1),
            price: dec!(50000),
            created_at: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_with_default() {
        let mut order = Order::default();
        order.symbol = "ETH-USD".to_string();

        assert_eq!(order.symbol, "ETH-USD");
    }
}
```

### Shared Fixtures Module

```rust
// tests/fixtures.rs
pub mod orders {
    use super::*;

    pub fn btc_buy_order() -> Order {
        Order {
            symbol: "BTC-USD".to_string(),
            side: Side::Buy,
            ..Default::default()
        }
    }

    pub fn eth_sell_order() -> Order {
        Order {
            symbol: "ETH-USD".to_string(),
            side: Side::Sell,
            quantity: dec!(10),
            ..Default::default()
        }
    }
}

pub mod traders {
    pub fn alice_trader() -> Trader {
        Trader {
            id: uuid!("11111111-1111-1111-1111-111111111111"),
            name: "Alice".to_string(),
        }
    }
}

// In tests:
#[test]
fn test_something() {
    use crate::fixtures::orders::btc_buy_order;
    let order = btc_buy_order();
    // ...
}
```

---

## Property-Based Testing

Use `proptest` for testing with generated arbitrary data:

```rust
// Cargo.toml
[dev-dependencies]
proptest = "1.4"

use proptest::prelude::*;

proptest! {
    #[test]
    fn prop_calculate_slippage_is_between_zero_and_one(
        liquidity in 1_000_000.0f64..1_000_000_000.0,
        trade_size in 1_000.0f64..100_000.0,
    ) {
        let slippage = calculate_slippage(liquidity, trade_size);
        prop_assert!(slippage >= 0.0);
        prop_assert!(slippage <= 1.0);
    }
}

// Generating custom types
fn arb_order() -> impl Strategy<Value = Order> {
    (
        any::<u32>(),
        "[A-Z]{2,6}-[A-Z]{2,6}",
        any::<bool>(),
        1_000_000u64..1_000_000_000_000,
    )
    .prop_map(|(id, symbol, is_buy, qty_cents)| {
        Order {
            id: Uuid::new_v4(),
            symbol,
            side: if is_buy { Side::Buy } else { Side::Sell },
            quantity: Decimal::new(qty_cents as i64, 2),
            ..Default::default()
        }
    })
}

proptest! {
    #[test]
    fn prop_order_quantity_is_always_positive(order in arb_order()) {
        prop_assert!(order.quantity > dec!(0));
    }
}
```

---

## Benchmark Tests

Use `criterion` for performance-sensitive code:

```rust
// Cargo.toml
[dev-dependencies]
criterion = "0.5"

[[bench]]
name = "orderbook"
harness = false

// benches/orderbook.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use trading_engine::*;

fn orderbook_insert_benchmark(c: &mut Criterion) {
    c.bench_function("insert_order_1000x", |b| {
        b.iter(|| {
            let mut book = black_box(Orderbook::new());
            for i in 0..1000 {
                let order = Order {
                    price: dec!(50000) + Decimal::from(i),
                    ..Default::default()
                };
                book.insert(black_box(order));
            }
        })
    });
}

fn orderbook_query_benchmark(c: &mut Criterion) {
    let mut book = Orderbook::new();
    for i in 0..10000 {
        book.insert(Order {
            price: dec!(50000) + Decimal::from(i),
            ..Default::default()
        });
    }

    c.bench_function("find_price_1000x", |b| {
        b.iter(|| {
            book.find_price(black_box(dec!(50500)))
        })
    });
}

criterion_group!(benches, orderbook_insert_benchmark, orderbook_query_benchmark);
criterion_main!(benches);

// Run: cargo bench
```

---

## Error Testing

### Testing Specific Error Variants

```rust
#[test]
fn parse_order_fails_with_missing_symbol() {
    let json = r#"{"side":"Buy","qty":1.5}"#;
    let result = parse_order(json);

    // Check specific variant
    assert!(matches!(result, Err(ParseError::MissingField("symbol"))));
}

#[test]
fn parse_order_fails_with_correct_message() {
    let json = "invalid";
    let result = parse_order(json);

    match result {
        Err(e) => {
            assert!(e.to_string().contains("invalid JSON"));
        }
        Ok(_) => panic!("Expected error"),
    }
}

#[test]
fn error_provides_source() {
    let err = ParseError::InvalidJson(serde_json::error::Error::syntax(
        "test",
        42,
        0,
    ));

    assert!(err.source().is_some());
}
```

### Testing Panic with `#[should_panic]`

```rust
#[test]
#[should_panic(expected = "invalid quantity")]
fn create_order_panics_with_zero_quantity() {
    Order::new("BTC", dec!(0));  // Should panic
}

#[test]
#[should_panic]
fn unwrap_on_none_panics() {
    let opt: Option<i32> = None;
    opt.unwrap();
}
```

---

## WebSocket and Network Testing

### Testing WebSocket Message Handling

```rust
#[tokio::test]
async fn websocket_handler_parses_text_message() {
    let (tx, mut rx) = tokio::sync::mpsc::channel(10);

    // Create mock WebSocket
    let msg = Message::Text(r#"{"type":"subscribe","channel":"prices"}"#.to_string());

    handle_websocket_message(msg, &tx).await.unwrap();

    let command = rx.recv().await.unwrap();
    assert!(matches!(command, Command::Subscribe { channel: "prices" }));
}

#[tokio::test]
async fn websocket_handler_ignores_binary_messages() {
    let (tx, _) = tokio::sync::mpsc::channel(10);

    let msg = Message::Binary(vec![0, 1, 2, 3]);
    let result = handle_websocket_message(msg, &tx).await;

    assert!(result.is_ok());  // No error, just ignored
}

#[tokio::test]
async fn websocket_handler_responds_to_ping() {
    let (_, rx) = tokio::sync::mpsc::channel(10);

    let msg = Message::Ping(vec![]);
    let response = handle_websocket_message(msg, &rx).await.unwrap();

    assert!(matches!(response, Message::Pong(_)));
}
```

### Testing Reconnection Logic

```rust
#[tokio::test]
async fn websocket_client_reconnects_on_close() {
    let connect_count = Arc::new(std::sync::atomic::AtomicU32::new(0));
    let count_clone = connect_count.clone();

    let client = WebSocketClient::new_with_connector(move |_url| {
        let count = count_clone.clone();
        async move {
            count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            Err(io::Error::new(io::ErrorKind::ConnectionReset, ""))
        }
    });

    // Wait for reconnection attempts
    tokio::time::sleep(Duration::from_millis(100)).await;

    assert!(connect_count.load(std::sync::atomic::Ordering::SeqCst) > 1);
}
```

---

## Test Organization for CI

Organize tests by speed and type for efficient CI:

```bash
# Unit tests (fast, ~1s total)
cargo test --lib

# Integration tests (~5-10s total)
cargo test --test '*'

# Database tests (slower, needs test DB)
cargo test --lib -- --ignored

# Benchmarks (optional in CI)
cargo bench --no-run

# With coverage
cargo tarpaulin --out Html --exclude-files tests/

# Parallel execution
cargo test -- --test-threads=4
```

---

## Testing Checklist for Code Review

Before submitting for review, verify:

- [ ] Happy path tests exist for each public function?
- [ ] Error cases tested (wrong input, missing data, timeouts)?
- [ ] Async tests use `#[tokio::test]` or `#[tokio::test(flavor = "multi_thread")]`?
- [ ] Database tests use `#[sqlx::test]` or transaction rollback pattern?
- [ ] No `.unwrap()` in test setup without `.expect("reason")`?
- [ ] Tests can run in parallel (no shared mutable state)?
- [ ] No hardcoded ports, file paths, or environment variables?
- [ ] Mocks verify expectations, not just return values?
- [ ] Edge cases tested (zero, negative, overflow for financial calculations)?
- [ ] Flaky tests detected? (Use `cargo test -- --test-threads=1` to reproduce)
- [ ] No sleep-based timing (use `tokio::time::pause()` instead)?
- [ ] Integration tests have proper setup/teardown (database cleanup)?
- [ ] Coverage targets met (critical paths 90%+, business logic 80%+)?
