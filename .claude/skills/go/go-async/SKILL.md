---
name: go-async
description: >
  Use when writing goroutines, context propagation, error coordination with errgroup,
  channels, or graceful shutdown patterns.
  Covers concurrent patterns, timeout handling, and cleanup.
  Assumes you've read go-dev/ first.
invocation: auto
---

# Go Async Patterns (Goroutines, Channels, Context)

> **Prerequisite:** Read `go-dev/SKILL.md` first. This skill assumes you understand error handling and DI.

## Errgroup for Goroutine Coordination

Never use bare `go func()`. Always use `errgroup.WithContext` to collect errors.

```go
import "golang.org/x/sync/errgroup"

// ✅ CORRECT — errgroup coordinates errors and context
func (c *Container) ProcessOrders(ctx context.Context, orderIDs []string) error {
    g, ctx := errgroup.WithContext(ctx)
    
    // Set concurrency limit
    g.SetLimit(5)  // Max 5 concurrent goroutines
    
    for _, id := range orderIDs {
        orderID := id  // Capture for closure
        g.Go(func() error {
            return c.processOrder(ctx, orderID)  // Error propagates
        })
    }
    
    return g.Wait()  // Return first error or nil
}

// Calls processOrder concurrently, respects context timeout,
// returns error if any goroutine fails.

// ❌ WRONG — bare goroutines, errors lost
func (c *Container) ProcessOrders(ctx context.Context, orderIDs []string) error {
    for _, id := range orderIDs {
        go func(oid string) {
            err := c.processOrder(ctx, oid)
            if err != nil {
                c.Logger.Error("process failed", "order", oid)  // Logged but lost
            }
        }(id)
    }
    return nil  // Returns before goroutines start!
}
```

## Context Propagation

Pass context as first argument through all layers. Respect cancellation and timeouts.

```go
// ✅ CORRECT — context propagated everywhere
func (c *Container) Handler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()  // Get from request
    result, err := c.service.DoWork(ctx)  // Pass down
    // ...
}

func (s *Service) DoWork(ctx context.Context) (interface{}, error) {
    data, err := s.db.FetchData(ctx)  // Pass down
    // ...
}

func (db *DB) FetchData(ctx context.Context) (interface{}, error) {
    // Use context for timeout
    return db.pool.QueryRow(ctx, sql).Scan(&data)
}

// If client disconnects, ctx.Done() signals cancellation up the stack.

// ❌ WRONG — context lost
func (c *Container) Handler(w http.ResponseWriter, r *http.Request) {
    // Ignores request context, uses background
    result, _ := c.service.DoWork(context.Background())  // Lost!
}
```

## Context with Timeout

Add timeout when calling external services or long operations.

```go
// ✅ CORRECT — timeout on slow operation
func (c *Container) FetchExternalData(ctx context.Context) (interface{}, error) {
    // Set 10s timeout for external API call
    ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()
    
    result, err := c.externalAPI.Get(ctx)
    if err == context.DeadlineExceeded {
        return nil, &AppError{
            StatusCode: http.StatusGatewayTimeout,
            Code:       "EXTERNAL_API_TIMEOUT",
            Message:    "External service timeout",
        }
    }
    return result, err
}

// ❌ WRONG — no timeout, hangs forever
func (c *Container) FetchExternalData(ctx context.Context) (interface{}, error) {
    result, err := c.externalAPI.Get(ctx)  // Could hang indefinitely
    return result, err
}
```

## Channels (When Appropriate)

Use channels sparingly. Prefer errgroup for simple worker pools.

```go
// ✅ CORRECT — channel for work distribution
func (c *Container) ProcessStream(ctx context.Context, items <-chan string) error {
    g, ctx := errgroup.WithContext(ctx)
    
    // Start worker goroutines
    for i := 0; i < 5; i++ {
        g.Go(func() error {
            for {
                select {
                case item, ok := <-items:
                    if !ok {
                        return nil  // Channel closed, done
                    }
                    if err := c.processItem(ctx, item); err != nil {
                        return fmt.Errorf("process item: %w", err)
                    }
                case <-ctx.Done():
                    return ctx.Err()  // Respect cancellation
                }
            }
        })
    }
    
    return g.Wait()
}

// ❌ WRONG — channel without respecting context
func (c *Container) ProcessStream(ctx context.Context, items <-chan string) error {
    for item := range items {  // Ignores context cancellation
        c.processItem(ctx, item)
    }
    return nil
}
```

## Graceful Shutdown

Handle SIGINT/SIGTERM to finish in-flight requests before exiting.

```go
// In cmd/server/main.go
func main() {
    // Create HTTP server
    mux := chi.NewRouter()
    container.RegisterRoutes(mux)
    
    server := &http.Server{
        Addr:              ":3000",
        Handler:           mux,
        ReadTimeout:       15 * time.Second,
        WriteTimeout:      15 * time.Second,
        IdleTimeout:       60 * time.Second,
        ReadHeaderTimeout: 5 * time.Second,
    }
    
    // Start server in background
    errChan := make(chan error, 1)
    go func() {
        logger.Info("server starting", "addr", server.Addr)
        errChan <- server.ListenAndServe()
    }()
    
    // Wait for SIGINT or SIGTERM
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
    
    select {
    case err := <-errChan:
        if err != http.ErrServerClosed {
            logger.Error("server error", "error", err)
        }
    case sig := <-sigChan:
        logger.Info("shutting down", "signal", sig)
        
        // Give in-flight requests 30 seconds to finish
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()
        
        if err := server.Shutdown(ctx); err != nil {
            logger.Error("shutdown error", "error", err)
        }
        logger.Info("server stopped")
    }
    
    // Cleanup
    db.Close()
    os.Exit(0)
}
```

## Worker Pool Pattern

Process items concurrently with bounded concurrency using errgroup.

```go
// ✅ CORRECT — errgroup with SetLimit
func (c *Container) BatchProcess(ctx context.Context, items []string) error {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(10)  // Max 10 concurrent
    
    for _, item := range items {
        item := item  // Capture for closure
        g.Go(func() error {
            return c.processOne(ctx, item)
        })
    }
    
    return g.Wait()
}

// ✅ CORRECT — manual worker pool with channels
func (c *Container) BatchProcess(ctx context.Context, items []string) error {
    g, ctx := errgroup.WithContext(ctx)
    
    // Create work channel
    workChan := make(chan string, 10)
    
    // Start workers
    for i := 0; i < 5; i++ {
        g.Go(func() error {
            for {
                select {
                case item, ok := <-workChan:
                    if !ok {
                        return nil
                    }
                    if err := c.processOne(ctx, item); err != nil {
                        return err
                    }
                case <-ctx.Done():
                    return ctx.Err()
                }
            }
        })
    }
    
    // Feed items to workers
    g.Go(func() error {
        defer close(workChan)
        for _, item := range items {
            select {
            case workChan <- item:
            case <-ctx.Done():
                return ctx.Err()
            }
        }
        return nil
    })
    
    return g.Wait()
}
```

## Context Value Storage

Use context values sparingly — only for request-scoped data like user ID.

```go
// ✅ CORRECT — store user ID in context
type contextKey string

const userIDKey contextKey = "userID"

// Middleware sets value
func (c *Container) AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userID := c.validateToken(r)
        ctx := context.WithValue(r.Context(), userIDKey, userID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Handler retrieves value
func (c *Container) GetProfile(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := ctx.Value(userIDKey).(string)
    profile, _ := c.service.GetProfile(ctx, userID)
    respondJSON(w, http.StatusOK, profile)
}

// ❌ WRONG — storing large objects in context
ctx := context.WithValue(r.Context(), "database", db)  // Don't!
// Use DI instead: pass container to handlers
```

## Implementation Checklist

- [ ] No bare `go func()` — always use `errgroup` or explicit error handling
- [ ] All goroutines respect context cancellation
- [ ] Context passed as first argument to all functions
- [ ] Timeouts applied to external service calls
- [ ] Graceful shutdown implemented in main
- [ ] Worker pools bounded (SetLimit or manual semaphore)
- [ ] Channels have select with ctx.Done()
- [ ] No goroutine leaks (all goroutines exit cleanly)
- [ ] Context values used only for request-scoped data
- [ ] Tests verify goroutine cleanup with race detector

## Before Commit

```bash
# Run with race detector to catch concurrency bugs
go test ./... -race

# Check for goroutine leaks (if using testing utilities)
# Ensure no select/defer/cleanup code is missing
```

## Related Skills

- Read `go-dev` for error handling and structure
- Read `go-handlers` for request context in handlers
- Read `go-testing` for testing concurrent code
- See `gotchas.md` for common async mistakes
