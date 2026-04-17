# Go Dev Gotchas

## 1. Ignoring Context Cancellation

**Symptom:** Requests still processing after client disconnects; timeout not working.

**Cause:** Not checking `ctx.Done()` in loops or long-running operations.

```go
// ❌ WRONG — ignores context cancellation
func (db *DB) FetchLargeDataset(ctx context.Context) ([]*Record, error) {
    for i := 0; i < 10000; i++ {
        record, err := db.fetchOne(i)  // No ctx check
        if err != nil {
            return nil, err
        }
        records = append(records, record)
    }
    return records, nil
}

// ✅ CORRECT — respects context
func (db *DB) FetchLargeDataset(ctx context.Context) ([]*Record, error) {
    for i := 0; i < 10000; i++ {
        select {
        case <-ctx.Done():
            return nil, ctx.Err()  // Respect cancellation
        default:
        }
        record, err := db.fetchOne(ctx, i)
        if err != nil {
            return nil, err
        }
        records = append(records, record)
    }
    return records, nil
}
```

## 2. Error Not Wrapped

**Symptom:** Stack trace impossible to debug; don't know where error originated.

**Cause:** Returning bare error without wrapping with context.

```go
// ❌ WRONG — no context
if err != nil {
    return err  // Where did this error come from?
}

// ✅ CORRECT — wrapped
if err != nil {
    return fmt.Errorf("fetch user %s: %w", id, err)
}
```

## 3. Global Variables in Library Code

**Symptom:** Tests fail due to shared state; impossible to inject mocks.

**Cause:** Using package-level globals instead of DI.

```go
// ❌ WRONG — global state
package storage

var DB *pgxpool.Pool

func init() {
    db, _ := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
    DB = db  // Hard to test, can't inject mock
}

func GetUser(id string) (*User, error) {
    return DB.QueryRow(context.Background(), "SELECT ...").Scan(&user)
}

// ✅ CORRECT — constructor injection
type DB struct {
    pool *pgxpool.Pool
}

func NewDB(pool *pgxpool.Pool) *DB {
    return &DB{pool: pool}
}

func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    return db.pool.QueryRow(ctx, "SELECT ...").Scan(&user)
}
```

## 4. Concurrent Goroutines Without Error Handling

**Symptom:** Panics or errors silently disappear; unclear why feature fails.

**Cause:** Using bare `go func()` instead of `errgroup`.

```go
// ❌ WRONG — no error coordination
func (c *Container) ProcessOrders(ctx context.Context, orderIDs []string) error {
    for _, id := range orderIDs {
        go func(oid string) {
            err := c.processOrder(ctx, oid)  // Error is silently lost
            if err != nil {
                c.Logger.Error("process failed", "order", oid)  // Log only, caller doesn't know
            }
        }(id)
    }
    return nil  // Returns before goroutines finish
}

// ✅ CORRECT — use errgroup
import "golang.org/x/sync/errgroup"

func (c *Container) ProcessOrders(ctx context.Context, orderIDs []string) error {
    g, ctx := errgroup.WithContext(ctx)
    for _, id := range orderIDs {
        oid := id  // Capture for closure
        g.Go(func() error {
            return c.processOrder(ctx, oid)  // Errors are collected
        })
    }
    return g.Wait()  // Wait and return first error
}
```

## 5. Receiver Methods Named Inconsistently

**Symptom:** Code is confusing; unclear which methods belong to which type.

**Cause:** Using different receiver names across methods of same type.

```go
// ❌ WRONG — inconsistent receiver names
func (u *User) GetEmail() string { return u.Email }
func (this *User) GetID() string { return this.ID }
func (usr *User) Create(ctx context.Context) error { ... }

// ✅ CORRECT — consistent receiver
func (u *User) GetEmail() string { return u.Email }
func (u *User) GetID() string { return u.ID }
func (u *User) Create(ctx context.Context) error { ... }
```

## 6. Exported Func in `internal/` Without Doc Comment

**Symptom:** Linter warnings; documentation generation fails.

**Cause:** Exporting function without required comment.

```go
// ❌ WRONG — missing doc comment
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    // ...
}

// ✅ CORRECT
// GetUser retrieves a user by ID.
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    // ...
}
```
