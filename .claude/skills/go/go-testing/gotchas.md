# Go Testing Gotchas

## 1. Test Database State Not Cleaned

**Symptom:** Tests pass in isolation but fail when run together; flaky tests.

**Cause:** Previous test data persists; no cleanup between tests.

```go
// ❌ WRONG — no cleanup between tests
func TestGetUser(t *testing.T) {
    db := setupTestDB(t)  // Shared state!
    db.CreateUser(context.Background(), "test@example.com", "Test User")
    user, _ := db.GetUser(context.Background(), "test-id")
    if user == nil {
        t.Errorf("expected user, got nil")  // Another test may have data
    }
}

// ✅ CORRECT — cleanup after each test
func setupTestDB(t *testing.T) *DB {
    db, _ := NewDB(testDSN)
    
    t.Cleanup(func() {
        // Truncate all tables
        db.pool.Exec(context.Background(), "TRUNCATE TABLE users CASCADE")
        db.Close()
    })
    
    return db
}

// Or use transactions that rollback
func setupTestDBTx(t *testing.T) (*DB, pgx.Tx) {
    db, _ := NewDB(testDSN)
    tx, _ := db.pool.Begin(context.Background())
    
    t.Cleanup(func() {
        tx.Rollback(context.Background())  // Undo all changes
        db.Close()
    })
    
    return db, tx
}
```

## 2. Mocking Without Interface

**Symptom:** Can't inject mock; forced to use real database in tests; tests slow.

**Cause:** Service depends on concrete type instead of interface.

```go
// ❌ WRONG — depends on concrete *DB type, can't mock
type UserService struct {
    db *DB  // Concrete type
}

func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    return s.db.GetUser(ctx, id)
}

// Can't create mock for tests!

// ✅ CORRECT — depends on interface, can mock
type UserStore interface {
    GetUser(ctx context.Context, id string) (*User, error)
}

type UserService struct {
    store UserStore  // Interface
}

// Mock implementation
type mockUserStore struct {
    users map[string]*User
}

func (m *mockUserStore) GetUser(ctx context.Context, id string) (*User, error) {
    if user, ok := m.users[id]; ok {
        return user, nil
    }
    return nil, fmt.Errorf("not found")
}

// Test with mock
func TestGetUser(t *testing.T) {
    mock := &mockUserStore{
        users: map[string]*User{
            "user-123": {ID: "user-123", Email: "test@example.com"},
        },
    }
    service := NewUserService(mock)
    user, _ := service.GetUser(context.Background(), "user-123")
    // Test is fast, no database!
}
```

## 3. Race Condition Not Caught

**Symptom:** Tests pass but crashes in production under load; intermittent failures.

**Cause:** Not running tests with `-race` flag.

```bash
# ❌ WRONG — race condition hidden
go test ./...

# ✅ CORRECT — detects race conditions
go test ./... -race
```

## 4. Helper Function Pollutes Test Output

**Symptom:** Test failure reports wrong line number; hard to debug.

**Cause:** Helper functions not marked with `t.Helper()`.

```go
// ❌ WRONG — test.log shows helper line, not test line
func assertError(t *testing.T, err error, expectedMsg string) {
    if err == nil {
        t.Errorf("expected error %q, got nil", expectedMsg)  // Reported here!
    }
}

func TestSomething(t *testing.T) {
    _, err := someFunc()
    assertError(t, err, "something failed")  // But error is actually here
}

// ✅ CORRECT — helper marked, line numbers correct
func assertError(t *testing.T, err error, expectedMsg string) {
    t.Helper()  // Mark as helper
    if err == nil {
        t.Errorf("expected error %q, got nil", expectedMsg)
    }
}
```

## 5. Context Not Cleaned Up

**Symptom:** Goroutines leak; tests slow down over time; memory usage grows.

**Cause:** Context operations (WithCancel, WithTimeout) not cancelled.

```go
// ❌ WRONG — context not cancelled
func TestWithTimeout(t *testing.T) {
    ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
    // Forgot to cancel! Context waits full 5s.
    someFunc(ctx)
}

// ✅ CORRECT — context cancelled
func TestWithTimeout(t *testing.T) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()  // Always cancel
    someFunc(ctx)
}
```

## 6. Test Uses Real External Service

**Symptom:** Tests fail if external API down; slow; flaky; can't test error cases.

**Cause:** Not mocking external dependencies.

```go
// ❌ WRONG — calls real API
func TestFetchUserFromAPI(t *testing.T) {
    client := NewAPIClient("https://api.example.com")
    user, err := client.GetUser(context.Background(), "123")
    // If API down, test fails!
}

// ✅ CORRECT — mock the API client
type APIClient interface {
    GetUser(ctx context.Context, id string) (*User, error)
}

type mockAPIClient struct {
    mockGetUser func(ctx context.Context, id string) (*User, error)
}

func (m *mockAPIClient) GetUser(ctx context.Context, id string) (*User, error) {
    return m.mockGetUser(ctx, id)
}

func TestFetchUserFromAPI(t *testing.T) {
    mock := &mockAPIClient{
        mockGetUser: func(ctx context.Context, id string) (*User, error) {
            return &User{ID: "123", Name: "Test"}, nil
        },
    }
    user, _ := mock.GetUser(context.Background(), "123")
    // Fast, reliable, no network calls
}
```
