---
name: go-testing
description: >
  Use when writing tests: table-driven tests, httptest for integration tests,
  mocking patterns, and test organization.
  Covers unit tests, handler tests, database tests, and concurrent testing.
  Assumes you've read go-dev/ first.
invocation: auto
---

# Go Testing Patterns

> **Prerequisite:** Read `go-dev/SKILL.md` first. This skill assumes you understand project structure and error handling.

## Table-Driven Tests (Standard Pattern)

All unit tests should be table-driven: define test cases in a slice, loop and run.

```go
// In internal/services/users_test.go
func TestGetUser(t *testing.T) {
    type args struct {
        ctx context.Context
        id  string
    }
    
    type want struct {
        user *User
        err  string
    }
    
    tests := []struct {
        name string
        args args
        want want
    }{
        {
            name: "valid user exists",
            args: args{ctx: context.Background(), id: "user-123"},
            want: want{
                user: &User{ID: "user-123", Email: "test@example.com"},
                err:  "",
            },
        },
        {
            name: "user not found",
            args: args{ctx: context.Background(), id: "nonexistent"},
            want: want{
                user: nil,
                err:  "user not found",
            },
        },
        {
            name: "empty id",
            args: args{ctx: context.Background(), id: ""},
            want: want{
                user: nil,
                err:  "invalid id",
            },
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            db := setupTestDB(t)
            user, err := db.GetUser(tt.args.ctx, tt.args.id)
            
            if err == nil && tt.want.err != "" {
                t.Errorf("expected error %q, got nil", tt.want.err)
            }
            if err != nil && !strings.Contains(err.Error(), tt.want.err) {
                t.Errorf("expected error %q, got %v", tt.want.err, err)
            }
            
            if user != nil && tt.want.user != nil {
                if user.ID != tt.want.user.ID {
                    t.Errorf("expected ID %q, got %q", tt.want.user.ID, user.ID)
                }
            }
        })
    }
}

// ❌ WRONG — one test function per case
func TestGetUser_ValidUser(t *testing.T) {
    // ...
}

func TestGetUser_NotFound(t *testing.T) {
    // ...
}

func TestGetUser_EmptyID(t *testing.T) {
    // ...
}
```

## HTTP Handler Tests with httptest

Use `httptest.Server` for integration tests; test full request/response cycle.

```go
// In internal/handlers/users_test.go
func TestCreateUserHandler(t *testing.T) {
    // Setup
    db := setupTestDB(t)
    container := &Container{DB: db, Logger: slog.Default()}
    
    // Create test server
    router := chi.NewRouter()
    container.RegisterRoutes(router)
    server := httptest.NewServer(router)
    defer server.Close()
    
    tests := []struct {
        name           string
        body           map[string]string
        expectedStatus int
        expectedCode   string
    }{
        {
            name:           "valid request",
            body:           map[string]string{"email": "test@example.com", "password": "secret123"},
            expectedStatus: http.StatusCreated,
            expectedCode:   "",
        },
        {
            name:           "missing email",
            body:           map[string]string{"password": "secret123"},
            expectedStatus: http.StatusBadRequest,
            expectedCode:   "VALIDATION_ERROR",
        },
        {
            name:           "invalid email",
            body:           map[string]string{"email": "not-an-email", "password": "secret123"},
            expectedStatus: http.StatusBadRequest,
            expectedCode:   "VALIDATION_ERROR",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Make request
            body, _ := json.Marshal(tt.body)
            req, _ := http.NewRequest("POST", server.URL+"/api/v1/users", bytes.NewReader(body))
            req.Header.Set("Content-Type", "application/json")
            
            resp, err := server.Client().Do(req)
            if err != nil {
                t.Fatal(err)
            }
            defer resp.Body.Close()
            
            // Check status
            if resp.StatusCode != tt.expectedStatus {
                t.Errorf("expected status %d, got %d", tt.expectedStatus, resp.StatusCode)
            }
            
            // Check response body
            var result map[string]interface{}
            json.NewDecoder(resp.Body).Decode(&result)
            
            if tt.expectedCode != "" {
                if errorMap, ok := result["error"].(map[string]interface{}); ok {
                    if code, ok := errorMap["code"].(string); ok && code != tt.expectedCode {
                        t.Errorf("expected code %q, got %q", tt.expectedCode, code)
                    }
                }
            }
        })
    }
}
```

## Mocking with Interfaces

Use interfaces for dependencies to inject mocks.

```go
// Define interface for storage layer
type UserStore interface {
    GetUser(ctx context.Context, id string) (*User, error)
    CreateUser(ctx context.Context, email, name string) (*User, error)
}

// Service depends on interface, not concrete DB
type UserService struct {
    store UserStore
}

func NewUserService(store UserStore) *UserService {
    return &UserService{store: store}
}

func (s *UserService) GetUser(ctx context.Context, id string) (*User, error) {
    return s.store.GetUser(ctx, id)
}

// Test with mock
type mockUserStore struct {
    mockGetUser func(ctx context.Context, id string) (*User, error)
}

func (m *mockUserStore) GetUser(ctx context.Context, id string) (*User, error) {
    return m.mockGetUser(ctx, id)
}

func TestUserService_GetUser(t *testing.T) {
    mock := &mockUserStore{
        mockGetUser: func(ctx context.Context, id string) (*User, error) {
            if id == "user-123" {
                return &User{ID: "user-123", Email: "test@example.com"}, nil
            }
            return nil, fmt.Errorf("not found")
        },
    }
    
    service := NewUserService(mock)
    user, err := service.GetUser(context.Background(), "user-123")
    if err != nil {
        t.Fatalf("expected no error, got %v", err)
    }
    if user.Email != "test@example.com" {
        t.Errorf("expected email test@example.com, got %s", user.Email)
    }
}
```

## Test Helpers

Extract common setup into helpers.

```go
// In internal/storage/db_test.go
func setupTestDB(t *testing.T) *DB {
    // Use test database URL from env or in-memory
    dsn := os.Getenv("TEST_DATABASE_URL")
    if dsn == "" {
        t.Skip("TEST_DATABASE_URL not set")
    }
    
    db, err := NewDB(dsn)
    if err != nil {
        t.Fatalf("failed to create test db: %v", err)
    }
    
    // Run migrations
    runMigrations(t, db.pool)
    
    // Cleanup function
    t.Cleanup(func() {
        // Truncate tables
        db.pool.Exec(context.Background(), "TRUNCATE TABLE users CASCADE")
        db.Close()
    })
    
    return db
}

// Helper to assert errors
func assertError(t *testing.T, err error, expectedMsg string) {
    t.Helper()  // Mark as test helper for stack trace
    if err == nil {
        t.Errorf("expected error %q, got nil", expectedMsg)
        return
    }
    if !strings.Contains(err.Error(), expectedMsg) {
        t.Errorf("expected error containing %q, got %v", expectedMsg, err)
    }
}

// Usage
func TestGetUser(t *testing.T) {
    db := setupTestDB(t)
    _, err := db.GetUser(context.Background(), "nonexistent")
    assertError(t, err, "not found")
}
```

## Testing Concurrent Code

Use race detector and synchronization helpers.

```go
// In internal/services/processor_test.go
func TestProcessOrdersConcurrently(t *testing.T) {
    // Run test with race detector:
    // go test ./... -race
    
    service := NewOrderService(setupTestDB(t))
    
    // Create test orders
    orderIDs := []string{"order-1", "order-2", "order-3"}
    
    // Process concurrently
    ctx := context.Background()
    err := service.ProcessOrders(ctx, orderIDs)
    if err != nil {
        t.Fatalf("processing failed: %v", err)
    }
    
    // Verify all orders processed
    for _, id := range orderIDs {
        order, err := service.GetOrder(ctx, id)
        if err != nil {
            t.Errorf("order %s not found: %v", id, err)
        }
        if order.Status != "processed" {
            t.Errorf("order %s status: expected processed, got %s", id, order.Status)
        }
    }
}
```

## Testing Context Cancellation

```go
func TestContextCancellation(t *testing.T) {
    service := NewUserService(setupTestDB(t))
    
    // Create cancelled context
    ctx, cancel := context.WithCancel(context.Background())
    cancel()  // Cancel immediately
    
    // Operation should fail with context error
    _, err := service.FetchLargeDataset(ctx)
    if err == nil || err != context.Canceled {
        t.Errorf("expected context.Canceled, got %v", err)
    }
}

func TestContextTimeout(t *testing.T) {
    service := NewUserService(setupTestDB(t))
    
    // Create context with short timeout
    ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
    defer cancel()
    
    // Slow operation should timeout
    _, err := service.SlowOperation(ctx)
    if err != context.DeadlineExceeded {
        t.Errorf("expected deadline exceeded, got %v", err)
    }
}
```

## Test Organization

```
internal/
├── handlers/
│   ├── users.go
│   └── users_test.go        # Test in same package
├── services/
│   ├── users.go
│   └── users_test.go
└── storage/
    ├── db.go
    ├── users.go
    └── users_test.go        # Test fixtures in _test.go files
```

## Implementation Checklist

- [ ] All exported functions have test coverage
- [ ] Tests use table-driven pattern
- [ ] Error cases included in test matrix
- [ ] HTTP handler tests use httptest.Server
- [ ] Mocks use interfaces, not concrete types
- [ ] Helper functions marked with `t.Helper()`
- [ ] Cleanup with `t.Cleanup()` or defer
- [ ] No hardcoded test data (use factories or setup)
- [ ] Tests pass with `-race` flag
- [ ] Tests pass with `-v` flag

## Before Commit

```bash
# Run all tests
go test ./... -v

# Run with race detector
go test ./... -race

# Check coverage
go test ./... -cover

# Coverage report
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## Related Skills

- Read `go-dev` for error handling in tests
- Read `go-handlers` for handler test patterns
- Read `go-db` for database test fixtures
- Read `go-async` for concurrent test patterns
- See `gotchas.md` for common testing mistakes
