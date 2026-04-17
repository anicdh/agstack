# Go Gotchas

## Naked Error Returns

**Symptom:** Errors in logs say "not found" with no context — impossible to trace which call failed.
**Cause:** Returning `err` without wrapping adds no context about where the error occurred.
**Fix:** Always wrap errors with `fmt.Errorf("context: %w", err)`.

```go
// ❌ WRONG
return nil, err

// ✅ CORRECT
return nil, fmt.Errorf("get user %s: %w", id, err)
```

## SQL Injection via String Interpolation

**Symptom:** Security vulnerability — attacker can inject SQL via user input.
**Cause:** Using `fmt.Sprintf` to build queries instead of parameterized queries.
**Fix:** Always use `$1`, `$2` placeholders with pgx.

```go
// ❌ WRONG
query := fmt.Sprintf("SELECT * FROM users WHERE id = '%s'", id)

// ✅ CORRECT
row := pool.QueryRow(ctx, "SELECT * FROM users WHERE id = $1", id)
```

## Bare Goroutines

**Symptom:** Silent errors — goroutine panics or errors are never reported.
**Cause:** Using `go func()` without error handling or recovery.
**Fix:** Use `errgroup.WithContext` for parallel work with proper error propagation.

```go
// ❌ WRONG
go func() {
    result, _ := fetchData()
}()

// ✅ CORRECT
g, ctx := errgroup.WithContext(ctx)
g.Go(func() error {
    var err error
    result, err = fetchData(ctx)
    return err
})
if err := g.Wait(); err != nil { ... }
```

## log.Fatal in Library Code

**Symptom:** Application exits abruptly with no recovery possible.
**Cause:** Using `log.Fatal()` in packages other than `main` — callers can't handle the error.
**Fix:** Return errors to the caller. Only `main()` should decide to exit.

```go
// ❌ WRONG — in a service or db package
func NewPool(url string) *pgxpool.Pool {
    pool, err := pgxpool.New(ctx, url)
    if err != nil {
        log.Fatal(err)  // kills the process
    }
    return pool
}

// ✅ CORRECT
func NewPool(ctx context.Context, url string) (*pgxpool.Pool, error) {
    pool, err := pgxpool.New(ctx, url)
    if err != nil {
        return nil, fmt.Errorf("create pool: %w", err)
    }
    return pool, nil
}
```

## Missing Context Propagation

**Symptom:** Requests hang forever or can't be cancelled by the caller.
**Cause:** Not passing `context.Context` through the call chain.
**Fix:** Every function that does I/O or calls another service takes `ctx context.Context` as first parameter.

```go
// ❌ WRONG
func (s *Service) GetUser(id string) (*User, error) {
    return s.db.FindUser(id)  // no way to cancel or timeout
}

// ✅ CORRECT
func (s *Service) GetUser(ctx context.Context, id string) (*User, error) {
    return s.db.FindUser(ctx, id)
}
```
